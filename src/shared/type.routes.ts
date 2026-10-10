import z from "zod";

export const RoutePath = z.string();
export type RoutePath = z.infer<typeof RoutePath>;

export const RouteName = z.enum([
  "home",
  "history",
  "meals",
  "goal",
  "not_found",
]);
export type RouteName = z.infer<typeof RouteName>;

export const RouteConfig = z.object({
  name: RouteName,
  path: RoutePath,
});
export type RouteConfig = z.infer<typeof RouteConfig>;
