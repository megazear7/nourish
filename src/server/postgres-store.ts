import { Pool, neonConfig } from "@neondatabase/serverless";
import { getConnectionString } from "@netlify/database";
import { acceptOps } from "../shared/apply.js";
import { emptyState, type NutritionState } from "../shared/type.nutrition.js";
import type { Op } from "../shared/type.op.js";
import type { NourishStore, SyncOutcome } from "./store.js";

type Query = (text: string, params?: unknown[]) => Promise<unknown>;

type DbClient = {
  query: Query;
  release: () => void;
};

type DbPool = {
  connect: () => Promise<DbClient>;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function rowsOf(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) return result as Record<string, unknown>[];
  if (result && typeof result === "object" && "rows" in result) {
    const rows = (result as { rows?: unknown }).rows;
    return Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [];
  }
  return [];
}

function asIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return String(value ?? "");
}

function rowToOwned(row: Record<string, unknown>) {
  const body = typeof row.body === "string" ? JSON.parse(row.body) : row.body;
  const op = {
    opId: String(row.op_id),
    type: String(row.op_type),
    entityId: String(row.entity_id),
    occurredAt: asIso(row.occurred_at),
    body,
  } as Op;
  return { userId: String(row.user_id), op };
}

function idsOf(incoming: unknown[], key: "opId" | "entityId"): string[] {
  const ids = new Set<string>();
  for (const raw of incoming) {
    if (!raw || typeof raw !== "object" || !(key in raw)) continue;
    const value = (raw as Record<string, unknown>)[key];
    if (typeof value === "string" && UUID_RE.test(value)) ids.add(value);
  }
  return [...ids];
}

function connectionString(): string | null {
  const fromEnv = (
    process.env.NETLIFY_DB_URL ||
    process.env.NETLIFY_DATABASE_URL ||
    process.env.DATABASE_URL ||
    ""
  ).trim();
  if (fromEnv) return fromEnv;
  try {
    return getConnectionString();
  } catch {
    return null;
  }
}

export class PostgresStore implements NourishStore {
  constructor(private readonly pool: DbPool) {}

  async sync(
    userId: string,
    email: string | null,
    deviceId: string | null,
    incoming: unknown[],
  ): Promise<SyncOutcome> {
    const safeDevice = deviceId && UUID_RE.test(deviceId) ? deviceId : null;
    return this.withTx(async (query) => {
      await query(`SELECT pg_advisory_xact_lock(hashtext($1)::bigint)`, [
        userId,
      ]);
      const opIds = idsOf(incoming, "opId");
      const entityIds = idsOf(incoming, "entityId");
      const existing = await query(
        `SELECT op_id, user_id, entity_id, op_type, occurred_at, body
         FROM operations
         WHERE user_id = $1
            OR ($2::uuid[] IS NOT NULL AND op_id = ANY($2::uuid[]))`,
        [userId, opIds.length ? opIds : null],
      );
      const owners = entityIds.length
        ? await query(
            `SELECT id AS entity_id, user_id FROM calorie_entries WHERE id = ANY($1::uuid[])
             UNION ALL SELECT id, user_id FROM meals WHERE id = ANY($1::uuid[])
             UNION ALL SELECT id, user_id FROM goals WHERE id = ANY($1::uuid[])`,
            [entityIds],
          )
        : [];
      const outcome = acceptOps({
        userId,
        incoming,
        existing: rowsOf(existing).map(rowToOwned),
        entityOwners: rowsOf(owners).map((row) => ({
          entityId: String(row.entity_id),
          userId: String(row.user_id),
        })),
      });
      await query(
        `INSERT INTO nourish_users (user_id, email, created_at, updated_at)
         VALUES ($1, $2, NOW(), NOW())
         ON CONFLICT (user_id) DO UPDATE SET
           email = COALESCE(EXCLUDED.email, nourish_users.email),
           updated_at = NOW()`,
        [userId, email],
      );
      for (const op of outcome.accepted) {
        await query(
          `INSERT INTO operations
             (op_id, user_id, device_id, entity_id, op_type, occurred_at, received_at, body)
           VALUES ($1::uuid, $2, $3::uuid, $4::uuid, $5, $6::timestamptz, NOW(), $7::jsonb)
           ON CONFLICT (op_id) DO NOTHING`,
          [
            op.opId,
            userId,
            safeDevice,
            op.entityId,
            op.type,
            op.occurredAt,
            JSON.stringify(op.body),
          ],
        );
      }
      await query(`DELETE FROM calorie_entries WHERE user_id = $1`, [userId]);
      await query(`DELETE FROM meals WHERE user_id = $1`, [userId]);
      await query(`DELETE FROM goals WHERE user_id = $1`, [userId]);
      for (const entry of outcome.state.entries) {
        await query(
          `INSERT INTO calorie_entries
             (id, user_id, calories, eaten_at, meal_id, meal_title, meal_description, removed, updated_at)
           VALUES ($1::uuid, $2, $3, $4::timestamptz, $5::uuid, $6, $7, $8, NOW())`,
          [
            entry.id,
            userId,
            entry.calories,
            entry.timestamp,
            entry.mealId ?? null,
            entry.mealTitle ?? null,
            entry.mealDescription ?? null,
            Boolean(entry.removed),
          ],
        );
      }
      for (const meal of outcome.state.meals) {
        await query(
          `INSERT INTO meals (id, user_id, title, description, calories, removed, updated_at)
           VALUES ($1::uuid, $2, $3, $4, $5, $6, NOW())`,
          [
            meal.id,
            userId,
            meal.title,
            meal.description,
            meal.calories,
            Boolean(meal.removed),
          ],
        );
      }
      for (const goal of outcome.state.goals) {
        await query(
          `INSERT INTO goals (id, user_id, calories, set_at, updated_at)
           VALUES ($1::uuid, $2, $3, $4::timestamptz, NOW())`,
          [goal.id, userId, goal.calories, goal.setAt],
        );
      }
      return { results: outcome.results, state: outcome.state };
    });
  }

  async read(userId: string, email: string | null): Promise<NutritionState> {
    const client = await this.pool.connect();
    try {
      await client.query(
        `INSERT INTO nourish_users (user_id, email, created_at, updated_at)
         VALUES ($1, $2, NOW(), NOW())
         ON CONFLICT (user_id) DO NOTHING`,
        [userId, email],
      );
      const existing = await client.query(
        `SELECT op_id, user_id, entity_id, op_type, occurred_at, body
         FROM operations WHERE user_id = $1`,
        [userId],
      );
      const ops = rowsOf(existing).map(rowToOwned);
      if (!ops.length) return emptyState();
      return acceptOps({
        userId,
        incoming: [],
        existing: ops,
        entityOwners: [],
      }).state;
    } finally {
      client.release();
    }
  }

  private async withTx<T>(work: (query: Query) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await work((text, params) => client.query(text, params));
      await client.query("COMMIT");
      return result;
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {
        /* The connection may already be closed. */
      }
      throw error;
    } finally {
      client.release();
    }
  }
}

let cached: PostgresStore | null = null;

export function liveStore(): NourishStore {
  if (cached) return cached;
  const url = connectionString();
  if (!url) throw new Error("NETLIFY_DB_URL is not set");
  const config = neonConfig as { poolQueryViaFetch?: boolean };
  config.poolQueryViaFetch = true;
  cached = new PostgresStore(
    new Pool({ connectionString: url }) as unknown as DbPool,
  );
  return cached;
}
