import { z } from "zod";

import type { Tables } from "../helpers.js";

export type PageElement = Tables<"page_elements">;

export const createImageElementBodySchema = z.object({
  type: z.literal("image"),
  image_path: z.string().min(1),
  caption: z.string().trim().max(500).optional().default(""),
});

export const createTextElementBodySchema = z.object({
  type: z.literal("text"),
  text: z.string().max(10000).default(""),
});

export const createElementBodySchema = z.discriminatedUnion("type", [
  createImageElementBodySchema,
  createTextElementBodySchema,
]);

export const updateElementBodySchema = z.union([
  z.object({ text: z.string().max(10000) }),
  z.object({ caption: z.string().trim().max(500) }),
]);

export const reorderElementsBodySchema = z.object({
  element_ids: z.array(z.string().uuid()),
});

export type CreateElementBody = z.infer<typeof createElementBodySchema>;
export type UpdateElementBody = z.infer<typeof updateElementBodySchema>;
export type ReorderElementsBody = z.infer<typeof reorderElementsBodySchema>;

export type PageWithElements = {
  page: Tables<"pages">;
  elements: PageElement[];
};
