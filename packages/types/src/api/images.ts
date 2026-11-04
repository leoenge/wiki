import { z } from "zod";

import type { Tables } from "../helpers.js";

export type Image = Tables<"images">;

export const imageMetadataFieldsSchema = z.object({
  taken_at: z.string().datetime(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
});

export type ImageMetadataFields = z.infer<typeof imageMetadataFieldsSchema>;
