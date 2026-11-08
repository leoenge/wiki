import { z } from "zod";

import type { Tables } from "../helpers.js";

export type ElementComment = Tables<"element_comments">;

export const postElementCommentBodySchema = z.object({
  body: z.string().trim().min(1),
});

export type PostElementCommentBody = z.infer<typeof postElementCommentBodySchema>;
