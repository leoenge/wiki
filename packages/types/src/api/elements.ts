import { z } from "zod";

import { imageMetadataFieldsSchema } from "./images.js";
import type { Json } from "../database.gen.js";
import type { Tables } from "../helpers.js";

export type PageElement = Tables<"page_elements">;

export const MAX_MAP_PLACES = 100;

export const mapPlaceSchema = z.object({
  id: z.string().uuid(),
  google_place_id: z.string().min(1).max(500),
  name: z.string().min(1).max(500),
  address: z.string().max(500).nullable(),
  lat: z.number().finite(),
  lng: z.number().finite(),
});

export const mapPlacesSchema = z.array(mapPlaceSchema).max(MAX_MAP_PLACES);

export type MapPlace = z.infer<typeof mapPlaceSchema>;

export function parseMapPlaces(value: Json | null | undefined): MapPlace[] {
  if (value === null || value === undefined) {
    return [];
  }
  return mapPlacesSchema.parse(value);
}

export function assertUniqueMapPlaceIds(places: MapPlace[]): void {
  const ids = new Set<string>();
  for (const place of places) {
    if (ids.has(place.id)) {
      throw new Error("Duplicate map place id");
    }
    ids.add(place.id);
  }
}

const targetSectionIdSchema = z.string().uuid().optional();

const createImageItemSchema = z
  .object({
    image_path: z.string().min(1),
    caption: z.string().trim().max(500).optional().default(""),
  })
  .merge(imageMetadataFieldsSchema);

export const createImageElementBodySchema = z
  .object({
    type: z.literal("image"),
    target_section_id: targetSectionIdSchema,
  })
  .merge(createImageItemSchema);

export const createImageElementsBatchBodySchema = z.object({
  images: z.array(createImageItemSchema).min(1).max(50),
  target_section_id: targetSectionIdSchema,
});

export const createTextElementBodySchema = z.object({
  type: z.literal("text"),
  text: z.string().max(10000).default(""),
  target_section_id: targetSectionIdSchema,
});

export const createSectionElementBodySchema = z.object({
  type: z.literal("section"),
  text: z.string().trim().max(200).default(""),
});

export const createMapElementBodySchema = z.object({
  type: z.literal("map"),
  places: mapPlacesSchema.default([]),
  target_section_id: targetSectionIdSchema,
});

export const createElementBodySchema = z.discriminatedUnion("type", [
  createImageElementBodySchema,
  createTextElementBodySchema,
  createSectionElementBodySchema,
  createMapElementBodySchema,
]);

export const updateElementBodySchema = z.union([
  z.object({ text: z.string().max(10000) }),
  z.object({ caption: z.string().trim().max(500) }),
  z.object({ places: mapPlacesSchema }),
]);

export const reorderElementsBodySchema = z.object({
  element_ids: z.array(z.string().uuid()),
});

export type CreateElementBody = z.infer<typeof createElementBodySchema>;
export type CreateImageElementsBatchBody = z.infer<
  typeof createImageElementsBatchBodySchema
>;
export type UpdateElementBody = z.infer<typeof updateElementBodySchema>;
export type ReorderElementsBody = z.infer<typeof reorderElementsBodySchema>;

export type PageWithElements = {
  page: Tables<"pages">;
  elements: PageElement[];
};
