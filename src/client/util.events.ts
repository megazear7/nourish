import z from "zod";

export const ToastEventData = z.object({
  name: z.literal("nourish-toast"),
  detail: z.object({ message: z.string(), type: z.enum(["info", "success", "warning", "error"]) }),
});
export type ToastEventData = z.infer<typeof ToastEventData>;

export const NavigationEventData = z.object([
  z.object({ name: z.literal("nourish-navigate"), detail: z.object({ path: z.string() }) }),
]);
export type NavigationEventData = z.infer<typeof NavigationEventData>;

export const NourishEvent = z.union([ToastEventData, ...NavigationEventData]);
export type NourishEvent = z.infer<typeof NourishEvent>;

export const stopProp = (event: Event): void => {
  event.stopPropagation();
);

export const dispatch = (element: HTMLElement, event: NourishEvent): void => {
  element.dispatchEvent(
    new CustomEvent(event.name, {
      detail: event.detail,
      bubbles: true,
      composed: true,
    }),
  );
);
