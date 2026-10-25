import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { CompetitionRecord } from "../shared/type.competition.js";
import type { NutritionState } from "../shared/type.nutrition.js";
import type { TimedOp } from "../shared/util.competition.js";
import type { CompetitionDb, CompetitionTx } from "./competition-db.js";
import {
  applyPersisted,
  blankPersisted,
  readPersisted,
  type NourishStore,
  type Persisted,
} from "./store.js";

export class FileStore implements NourishStore, CompetitionDb {
  private chain: Promise<unknown> = Promise.resolve();

  constructor(private readonly filePath: string) {}

  async sync(
    userId: string,
    email: string | null,
    _deviceId: string | null,
    incoming: unknown[],
  ) {
    return this.exclusive(async () => {
      const data = await this.load();
      const next = applyPersisted(data, userId, email, incoming);
      await this.save(next.data);
      return next.outcome;
    });
  }

  async read(userId: string, email: string | null): Promise<NutritionState> {
    return this.exclusive(async () => {
      const data = await this.load();
      if (email && !data.users.some((user) => user.userId === userId)) {
        data.users.push({ userId, email });
        await this.save(data);
      }
      return readPersisted(data, userId);
    });
  }

  async transaction<T>(work: (tx: CompetitionTx) => Promise<T>): Promise<T> {
    return this.exclusive(async () => {
      const data = await this.load();
      if (!data.competitions) data.competitions = [];
      if (!data.suggestions) data.suggestions = [];
      const result = await work(txFor(data));
      await this.save(data);
      return result;
    });
  }

  private exclusive<T>(work: () => Promise<T>): Promise<T> {
    const run = this.chain.then(work, work);
    this.chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private async load(): Promise<Persisted> {
    try {
      return JSON.parse(await readFile(this.filePath, "utf8")) as Persisted;
    } catch {
      return blankPersisted();
    }
  }

  private async save(data: Persisted): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(data));
  }
}

function txFor(data: Persisted): CompetitionTx {
  const competitions = () => {
    if (!data.competitions) data.competitions = [];
    return data.competitions;
  };
  return {
    async upsertUser(userId, email) {
      const user = data.users.find((item) => item.userId === userId);
      if (!user) data.users.push({ userId, email });
      else if (email) user.email = email;
    },
    async userIdForEmail(email) {
      const found = data.users.find(
        (user) => user.email?.trim().toLowerCase() === email,
      );
      return found?.userId ?? null;
    },
    async timedOps(userId): Promise<TimedOp[]> {
      return data.ops
        .filter((row) => row.userId === userId)
        .map((row) => ({
          op: row.op,
          receivedAt: row.receivedAt ?? row.op.occurredAt,
        }));
    },
    async loadAll() {
      return competitions();
    },
    async insert(record: CompetitionRecord) {
      competitions().push(record);
    },
    async replace(record: CompetitionRecord) {
      const all = competitions();
      const index = all.findIndex((item) => item.id === record.id);
      if (index >= 0) all[index] = record;
      else all.push(record);
    },
    async rememberEmails(hostUserId, emails) {
      if (!data.suggestions) data.suggestions = [];
      for (const email of emails) {
        if (
          data.suggestions.some(
            (item) => item.hostUserId === hostUserId && item.email === email,
          )
        ) {
          continue;
        }
        data.suggestions.push({ hostUserId, email });
      }
    },
    async suggestionEmails(hostUserId) {
      return (data.suggestions ?? [])
        .filter((item) => item.hostUserId === hostUserId)
        .map((item) => item.email)
        .sort();
    },
  };
}
