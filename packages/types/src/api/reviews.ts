import { z } from "zod";

import type { Tables } from "../helpers.js";

export type Review = Tables<"reviews">;

export const upsertReviewBodySchema = z
  .object({
    rating: z.number().int().min(0).max(10).nullable(),
    comment: z.string().nullable(),
  })
  .superRefine((body, context) => {
    if (body.rating === null && (body.comment === null || body.comment.trim() === "")) {
      context.addIssue({
        code: "custom",
        message: "At least one of rating or comment is required",
      });
    }
    if (body.comment !== null && body.comment.trim() === "") {
      context.addIssue({
        code: "custom",
        message: "Comment cannot be empty",
        path: ["comment"],
      });
    }
  });

export type UpsertReviewBody = z.infer<typeof upsertReviewBodySchema>;
