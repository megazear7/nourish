import z from "zod";

export const CompetitionKind = z.enum(["last_one_standing", "best_of_month"]);
export type CompetitionKind = z.infer<typeof CompetitionKind>;

export const DayCall = z.enum([
  "on-track",
  "drifting",
  "running-hot",
  "over",
  "miss",
]);
export type DayCall = z.infer<typeof DayCall>;

export const MemberView = z.object({
  email: z.string(),
  host: z.boolean(),
  invite: z.enum(["accepted", "pending"]),
  you: z.boolean(),
  standing: z.enum(["in", "out", "winner"]).nullable(),
  points: z.number().int().nullable(),
  knockedOutOn: z.string().nullable(),
  today: DayCall.nullable(),
  caloriesToday: z.number().int().nullable(),
});
export type MemberView = z.infer<typeof MemberView>;

export const CompetitionView = z.object({
  id: z.string(),
  kind: CompetitionKind,
  phase: z.enum(["waiting", "active", "completed"]),
  startDay: z.string().nullable(),
  monthEnd: z.string().nullable(),
  host: z.boolean(),
  canStart: z.boolean(),
  winners: z.array(z.string()),
  members: z.array(MemberView),
});
export type CompetitionView = z.infer<typeof CompetitionView>;

export const CompetitionList = z.object({
  suggestions: z.array(z.string()),
  competitions: z.array(CompetitionView),
});
export type CompetitionList = z.infer<typeof CompetitionList>;

export type MemberRecord = {
  email: string;
  userId: string | null;
  role: "host" | "player";
  status: "accepted" | "pending";
  timezone: string | null;
};

export type CompetitionRecord = {
  id: string;
  kind: CompetitionKind;
  hostUserId: string;
  hostTimezone: string;
  createdAt: string;
  startedAt: string | null;
  startDay: string | null;
  monthEnd: string | null;
  members: MemberRecord[];
};
