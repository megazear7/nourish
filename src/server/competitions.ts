import type {
  CompetitionKind,
  CompetitionList,
  CompetitionRecord,
  CompetitionView,
  MemberRecord,
  MemberView,
} from "../shared/type.competition.js";
import { fold } from "../shared/fold.js";
import {
  hasPositiveGoal,
  scoreCompetition,
  type ScoredPlayer,
} from "../shared/util.competition.js";
import {
  dateKeyInZone,
  isTimeZone,
  lastDayOfMonth,
} from "../shared/util.zone.js";
import type { CompetitionDb, CompetitionTx } from "./competition-db.js";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class CompetitionError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export type Viewer = { userId: string; email: string | null };

function normalizeEmail(value: string): string | null {
  const email = value.trim().toLowerCase();
  if (!email || email.length > 254 || !EMAIL.test(email)) return null;
  return email;
}

function requireZone(value: string): string {
  const zone = value.trim();
  if (!isTimeZone(zone)) throw new CompetitionError("Unknown timezone.", 400);
  return zone;
}

function viewerEmail(viewer: Viewer): string {
  const email = viewer.email ? normalizeEmail(viewer.email) : null;
  if (!email) {
    throw new CompetitionError("Your account has no email address.", 400);
  }
  return email;
}

async function goalToday(
  tx: CompetitionTx,
  userId: string,
  timeZone: string,
  now: Date,
): Promise<boolean> {
  const ops = await tx.timedOps(userId);
  const state = fold(ops.map((row) => row.op));
  return hasPositiveGoal(state.goals, dateKeyInZone(now, timeZone), timeZone);
}

/** Accepted seats are bound to a user id. Only a pending invite matches by email. */
function isViewer(
  member: MemberRecord,
  viewer: Viewer,
  email: string | null,
): boolean {
  if (member.userId === viewer.userId) return true;
  return (
    member.status === "pending" && email !== null && member.email === email
  );
}

function visible(
  record: CompetitionRecord,
  viewer: Viewer,
  email: string | null,
) {
  return record.members.some((member) => isViewer(member, viewer, email));
}

function linkViewer(
  record: CompetitionRecord,
  viewer: Viewer,
  email: string | null,
): boolean {
  if (!email) return false;
  let changed = false;
  for (const member of record.members) {
    if (
      member.status === "pending" &&
      member.email === email &&
      member.userId !== viewer.userId
    ) {
      member.userId = viewer.userId;
      changed = true;
    }
  }
  return changed;
}

async function boardFor(
  tx: CompetitionTx,
  record: CompetitionRecord,
  now: Date,
) {
  if (!record.startedAt || !record.startDay) return null;
  const players: ScoredPlayer[] = [];
  for (const member of record.members) {
    if (member.status !== "accepted" || !member.userId) continue;
    players.push({
      email: member.email,
      timeZone: member.timezone || record.hostTimezone,
      ops: await tx.timedOps(member.userId),
    });
  }
  return scoreCompetition({
    kind: record.kind,
    startDay: record.startDay,
    monthEnd: record.monthEnd,
    players,
    now,
  });
}

async function toView(
  tx: CompetitionTx,
  record: CompetitionRecord,
  viewer: Viewer,
  email: string | null,
  now: Date,
): Promise<CompetitionView> {
  const board = await boardFor(tx, record, now);
  const host = record.hostUserId === viewer.userId;
  const winners = board?.winners ?? [];
  const members: MemberView[] = record.members.map((member) => {
    const row = board?.players.find((player) => player.email === member.email);
    let standing: MemberView["standing"] = null;
    if (board && member.status === "accepted") {
      if (row?.winner) standing = "winner";
      else if (row && !row.alive) standing = "out";
      else standing = "in";
    }
    return {
      email: member.email,
      host: member.role === "host",
      invite: member.status,
      you: isViewer(member, viewer, email),
      standing,
      points: row?.points ?? null,
      knockedOutOn: row?.knockedOutOn ?? null,
      today: row?.today ?? null,
      caloriesToday: row?.caloriesToday ?? null,
      safeToday: row?.safeToday ?? null,
    };
  });
  const started = Boolean(record.startedAt);
  const phase = !started
    ? "waiting"
    : board?.completed
      ? "completed"
      : "active";
  return {
    id: record.id,
    kind: record.kind,
    phase,
    startDay: record.startDay,
    monthEnd: record.monthEnd,
    host,
    canStart:
      host &&
      !started &&
      record.members.length >= 2 &&
      record.members.every((member) => member.status === "accepted"),
    winners,
    members,
  };
}

async function loadVisible(
  tx: CompetitionTx,
  viewer: Viewer,
  email: string | null,
): Promise<CompetitionRecord[]> {
  const all = await tx.loadAll();
  const mine = all.filter((record) => visible(record, viewer, email));
  for (const record of mine) {
    if (linkViewer(record, viewer, email)) await tx.replace(record);
  }
  return mine;
}

function suggestionsFrom(emails: string[]): string[] {
  return [...new Set(emails)].sort();
}

function sortViews(views: CompetitionView[]): CompetitionView[] {
  const rank = { active: 0, waiting: 1, completed: 2 };
  return views.slice().sort((a, b) => rank[a.phase] - rank[b.phase]);
}

async function requireRecord(
  tx: CompetitionTx,
  id: string,
  viewer: Viewer,
  email: string | null,
): Promise<CompetitionRecord> {
  const all = await tx.loadAll();
  const record = all.find((item) => item.id === id);
  if (!record || !visible(record, viewer, email)) {
    throw new CompetitionError("That competition is not here.", 404);
  }
  if (linkViewer(record, viewer, email)) await tx.replace(record);
  return record;
}

function hostMember(record: CompetitionRecord, viewer: Viewer): MemberRecord {
  const member = record.members.find((item) => item.userId === viewer.userId);
  if (
    !member ||
    member.role !== "host" ||
    record.hostUserId !== viewer.userId
  ) {
    throw new CompetitionError("Only the host can do that.", 403);
  }
  return member;
}

function assertWaiting(record: CompetitionRecord): void {
  if (record.startedAt) {
    throw new CompetitionError("This competition has already started.", 400);
  }
}

export async function listCompetitions(
  db: CompetitionDb,
  viewer: Viewer,
  timeZone: string,
  now = new Date(),
): Promise<CompetitionList> {
  requireZone(timeZone);
  return db.transaction(async (tx) => {
    await tx.upsertUser(viewer.userId, viewer.email);
    const email = viewer.email ? normalizeEmail(viewer.email) : null;
    const mine = await loadVisible(tx, viewer, email);
    const views = await Promise.all(
      mine.map((record) => toView(tx, record, viewer, email, now)),
    );
    return {
      suggestions: suggestionsFrom(await tx.suggestionEmails(viewer.userId)),
      competitions: sortViews(views),
    };
  });
}

export async function readCompetition(
  db: CompetitionDb,
  viewer: Viewer,
  id: string,
  timeZone: string,
  now = new Date(),
): Promise<CompetitionView> {
  requireZone(timeZone);
  return db.transaction(async (tx) => {
    await tx.upsertUser(viewer.userId, viewer.email);
    const email = viewer.email ? normalizeEmail(viewer.email) : null;
    const record = await requireRecord(tx, id, viewer, email);
    return toView(tx, record, viewer, email, now);
  });
}

export async function createCompetition(
  db: CompetitionDb,
  viewer: Viewer,
  input: { kind: CompetitionKind; emails: string[]; timezone: string },
  now = new Date(),
): Promise<CompetitionView> {
  const zone = requireZone(input.timezone);
  const email = viewerEmail(viewer);
  const invited = uniqueEmails(input.emails, email);
  return db.transaction(async (tx) => {
    await tx.upsertUser(viewer.userId, viewer.email);
    if (!(await goalToday(tx, viewer.userId, zone, now))) {
      throw new CompetitionError(
        "Set a goal before you start a competition.",
        400,
      );
    }
    const members: MemberRecord[] = [
      {
        email,
        userId: viewer.userId,
        role: "host",
        status: "accepted",
        timezone: zone,
      },
    ];
    for (const address of invited) {
      members.push({
        email: address,
        userId: await tx.userIdForEmail(address),
        role: "player",
        status: "pending",
        timezone: null,
      });
    }
    const record: CompetitionRecord = {
      id: crypto.randomUUID(),
      kind: input.kind,
      hostUserId: viewer.userId,
      hostTimezone: zone,
      createdAt: now.toISOString(),
      startedAt: null,
      startDay: null,
      monthEnd: null,
      members,
    };
    await tx.insert(record);
    await tx.rememberEmails(viewer.userId, invited);
    return toView(tx, record, viewer, email, now);
  });
}

function uniqueEmails(values: string[], hostEmail: string): string[] {
  if (!values.length) {
    throw new CompetitionError("Add at least one email.", 400);
  }
  const emails: string[] = [];
  for (const value of values) {
    const email = normalizeEmail(value);
    if (!email) throw new CompetitionError("Enter an email address.", 400);
    if (email === hostEmail) {
      throw new CompetitionError("You can't add yourself.", 400);
    }
    if (emails.includes(email)) {
      throw new CompetitionError(
        "That email is already in this competition.",
        400,
      );
    }
    emails.push(email);
  }
  return emails;
}

export async function addCompetitionEmail(
  db: CompetitionDb,
  viewer: Viewer,
  id: string,
  address: string,
  timeZone: string,
  now = new Date(),
): Promise<CompetitionView> {
  requireZone(timeZone);
  const email = viewerEmail(viewer);
  const invited = normalizeEmail(address);
  if (!invited) throw new CompetitionError("Enter an email address.", 400);
  if (invited === email) {
    throw new CompetitionError("You can't add yourself.", 400);
  }
  return db.transaction(async (tx) => {
    await tx.upsertUser(viewer.userId, viewer.email);
    const record = await requireRecord(tx, id, viewer, email);
    hostMember(record, viewer);
    assertWaiting(record);
    if (record.members.some((member) => member.email === invited)) {
      throw new CompetitionError(
        "That email is already in this competition.",
        400,
      );
    }
    record.members.push({
      email: invited,
      userId: await tx.userIdForEmail(invited),
      role: "player",
      status: "pending",
      timezone: null,
    });
    await tx.replace(record);
    await tx.rememberEmails(viewer.userId, [invited]);
    return toView(tx, record, viewer, email, now);
  });
}

export async function removeCompetitionEmail(
  db: CompetitionDb,
  viewer: Viewer,
  id: string,
  address: string,
  timeZone: string,
  now = new Date(),
): Promise<CompetitionView> {
  requireZone(timeZone);
  const email = viewerEmail(viewer);
  const target = normalizeEmail(address);
  if (!target) throw new CompetitionError("Enter an email address.", 400);
  return db.transaction(async (tx) => {
    await tx.upsertUser(viewer.userId, viewer.email);
    const record = await requireRecord(tx, id, viewer, email);
    hostMember(record, viewer);
    assertWaiting(record);
    if (target === email) {
      throw new CompetitionError("You can't remove yourself.", 400);
    }
    const next = record.members.filter((member) => member.email !== target);
    if (next.length === record.members.length) {
      throw new CompetitionError("That email is not in this competition.", 404);
    }
    record.members = next;
    await tx.replace(record);
    return toView(tx, record, viewer, email, now);
  });
}

export async function acceptCompetition(
  db: CompetitionDb,
  viewer: Viewer,
  id: string,
  timeZone: string,
  now = new Date(),
): Promise<CompetitionView> {
  const zone = requireZone(timeZone);
  const email = viewerEmail(viewer);
  return db.transaction(async (tx) => {
    await tx.upsertUser(viewer.userId, viewer.email);
    const record = await requireRecord(tx, id, viewer, email);
    assertWaiting(record);
    const member = record.members.find((item) => item.email === email);
    if (!member || member.role === "host" || member.status !== "pending") {
      throw new CompetitionError("There is no invite to accept.", 404);
    }
    if (!(await goalToday(tx, viewer.userId, zone, now))) {
      throw new CompetitionError("Set a goal before you join.", 400);
    }
    member.status = "accepted";
    member.userId = viewer.userId;
    member.timezone = zone;
    await tx.replace(record);
    return toView(tx, record, viewer, email, now);
  });
}

export async function declineCompetition(
  db: CompetitionDb,
  viewer: Viewer,
  id: string,
  timeZone: string,
): Promise<null> {
  requireZone(timeZone);
  const email = viewerEmail(viewer);
  return db.transaction(async (tx) => {
    await tx.upsertUser(viewer.userId, viewer.email);
    const record = await requireRecord(tx, id, viewer, email);
    assertWaiting(record);
    const member = record.members.find((item) => item.email === email);
    if (!member || member.role === "host" || member.status !== "pending") {
      throw new CompetitionError("There is no invite to decline.", 404);
    }
    record.members = record.members.filter((item) => item.email !== email);
    await tx.replace(record);
    return null;
  });
}

export async function startCompetition(
  db: CompetitionDb,
  viewer: Viewer,
  id: string,
  timeZone: string,
  now = new Date(),
): Promise<CompetitionView> {
  requireZone(timeZone);
  const email = viewerEmail(viewer);
  return db.transaction(async (tx) => {
    await tx.upsertUser(viewer.userId, viewer.email);
    const record = await requireRecord(tx, id, viewer, email);
    hostMember(record, viewer);
    assertWaiting(record);
    if (
      record.members.length < 2 ||
      record.members.some((member) => member.status !== "accepted")
    ) {
      throw new CompetitionError(
        "Everyone has to accept before you can start.",
        400,
      );
    }
    const startDay = dateKeyInZone(now, record.hostTimezone);
    record.startedAt = now.toISOString();
    record.startDay = startDay;
    record.monthEnd =
      record.kind === "best_of_month" ? lastDayOfMonth(startDay) : null;
    await tx.replace(record);
    return toView(tx, record, viewer, email, now);
  });
}
