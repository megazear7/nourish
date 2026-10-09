import z from "zod";

export const OP_TYPES = [
  "entry.create",
  "entry.patch",
  "entry.remove",
  "meal.create",
  "meal.update",
  "meal.remove",
  "goal.create",
] as const;

export type OpType = (typeof OP_TYPES)[number];

const id = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    "expected a UUID",
  );
const iso = z.string().min(1);

const entryCreateBody = z.object({
  calories: z.number().int().positive(),
  eatenAt: iso,
  mealId: id.optional(),
  mealTitle: z.string().optional(),
  mealDescription: z.string().optional(),
});

const entryPatchBody = z
  .object({
    calories: z.number().int().positive().optional(),
    eatenAt: iso.optional(),
    mealTitle: z.string().optional(),
    mealDescription: z.string().optional(),
  })
  .refine(
    (body) =>
      body.calories !== undefined ||
      body.eatenAt !== undefined ||
      body.mealTitle !== undefined ||
      body.mealDescription !== undefined,
    { message: "patch needs a field" },
  );

const mealBody = z.object({
  title: z.string().trim().min(1),
  description: z.string(),
  calories: z.number().int().nonnegative(),
});

const goalBody = z.object({
  calories: z.number().int().positive(),
  setAt: iso,
});

const emptyBody = z.object({}).strict();

const bodies = {
  "entry.create": entryCreateBody,
  "entry.patch": entryPatchBody,
  "entry.remove": emptyBody,
  "meal.create": mealBody,
  "meal.update": mealBody,
  "meal.remove": emptyBody,
  "goal.create": goalBody,
} as const;

export const Op = z
  .object({
    opId: id,
    type: z.enum(OP_TYPES),
    entityId: id,
    occurredAt: iso,
    body: z.unknown(),
  })
  .superRefine((op, ctx) => {
    const parsed = bodies[op.type].safeParse(op.body ?? {});
    if (!parsed.success) {
      ctx.addIssue({
        code: "custom",
        message: parsed.error.issues[0]?.message ?? "invalid body",
        path: ["body"],
      });
    }
  })
  .transform((op) => {
    const body = bodies[op.type].parse(op.body ?? {});
    return { ...op, body };
  });

export type Op = z.infer<typeof Op>;

export type OpResult = {
  opId: string;
  status: "applied" | "duplicate" | "rejected";
  reason?: string;
};
