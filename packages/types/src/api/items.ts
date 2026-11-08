import { z } from "zod";

import type { MapPlace } from "./elements.js";
import type { Tables } from "../helpers.js";

export type PageElementItem = Tables<"page_element_items">;

export type PageElementWithItems = Tables<"page_elements"> & {
  items: PageElementItem[];
};

export const mapItemDataSchema = z.object({
  google_place_id: z.string().min(1).max(500),
  address: z.string().max(500).nullable(),
  lat: z.number().finite(),
  lng: z.number().finite(),
});

export type MapItemData = z.infer<typeof mapItemDataSchema>;

export const draftElementItemSchema = z.object({
  id: z.string().uuid(),
  label: z.string().trim().min(1).max(500),
  data: z.record(z.string(), z.unknown()),
});

export type DraftElementItem = z.infer<typeof draftElementItemSchema>;

export function mapPlaceFromItem(item: DraftElementItem | PageElementItem): MapPlace {
  const data = mapItemDataSchema.parse(item.data);
  return {
    id: item.id,
    google_place_id: data.google_place_id,
    name: item.label,
    address: data.address,
    lat: data.lat,
    lng: data.lng,
  };
}

export function itemFromMapPlace(place: MapPlace): DraftElementItem {
  return {
    id: place.id,
    label: place.name,
    data: {
      google_place_id: place.google_place_id,
      address: place.address,
      lat: place.lat,
      lng: place.lng,
    },
  };
}

export function mapPlacesFromItems(
  items: DraftElementItem[] | PageElementItem[],
): MapPlace[] {
  return items.map(mapPlaceFromItem);
}
