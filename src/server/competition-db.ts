import type { CompetitionRecord } from "../shared/type.competition.js";
import type { TimedOp } from "../shared/util.competition.js";

export interface CompetitionTx {
  upsertUser(userId: string, email: string | null): Promise<void>;
  userIdForEmail(email: string): Promise<string | null>;
  timedOps(userId: string): Promise<TimedOp[]>;
  loadAll(): Promise<CompetitionRecord[]>;
  insert(record: CompetitionRecord): Promise<void>;
  replace(record: CompetitionRecord): Promise<void>;
  remove(id: string): Promise<void>;
  rememberEmails(hostUserId: string, emails: string[]): Promise<void>;
  suggestionEmails(hostUserId: string): Promise<string[]>;
}

export interface CompetitionDb {
  transaction<T>(work: (tx: CompetitionTx) => Promise<T>): Promise<T>;
}
