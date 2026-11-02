import { z } from "zod";

import type { Tables } from "../helpers.js";

export const RESERVED_TAGS = ["auth", "create", "api"] as const;

export const tagSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9][a-z0-9-]{1,29}$/, "Invalid tag format")
  .refine(
    (tag) => !RESERVED_TAGS.includes(tag as (typeof RESERVED_TAGS)[number]),
    "Tag is reserved",
  );

export const createPageBodySchema = z.object({
  name: z.string().trim().min(1).max(100),
  tag: tagSchema,
});

export const updatePageBodySchema = z.object({
  main_image_path: z.string().min(1).nullable(),
});

export type CreatePageBody = z.infer<typeof createPageBodySchema>;
export type UpdatePageBody = z.infer<typeof updatePageBodySchema>;

export type Page = Tables<"pages">;
