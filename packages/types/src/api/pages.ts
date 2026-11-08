import { z } from "zod";

import type { Tables } from "../helpers.js";

export const RESERVED_TAGS = ["auth", "create", "api", "join"] as const;

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

const pageNameSchema = z.string().trim().min(1).max(100);

export const updatePageBodySchema = z
  .object({
    name: pageNameSchema.optional(),
    tag: tagSchema.optional(),
  })
  .refine((body) => body.name !== undefined || body.tag !== undefined, {
    message: "At least one field is required",
  });

export type CreatePageBody = z.infer<typeof createPageBodySchema>;
export type UpdatePageBody = z.infer<typeof updatePageBodySchema>;

export type Page = Tables<"pages">;
export type Profile = Tables<"profiles">;
