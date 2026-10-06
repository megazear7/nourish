import z from "zod";

export const LoadingStatus = z.enum(["idle", "loading", "success", "error"]);
export type LoadingStatus = z.infer<typeof LoadingStatus>;
