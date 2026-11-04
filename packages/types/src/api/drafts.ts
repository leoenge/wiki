import { z } from "zod";

import {
  assertUniqueMapPlaceIds,
  mapPlacesSchema,
  parseMapPlaces,
  type PageElement,
} from "./elements.js";
import { imageMetadataFieldsSchema } from "./images.js";
import type { Page } from "./pages.js";
import type { Tables } from "../helpers.js";
import {
  applyAssignmentsToElements,
  assignmentsFromFlatOrder,
  flattenPageElements,
} from "../pageElementOrder.js";

export type PageDraft = Tables<"page_drafts">;

export const draftPageElementSchema = z
  .object({
    id: z.string().uuid(),
    type: z.enum(["image", "text", "section", "map"]),
    parent_id: z.string().uuid().nullable(),
    position: z.number().int().nonnegative(),
    text: z.string().nullable(),
    caption: z.string().nullable().optional(),
    image_path: z.string().nullable().optional(),
    image_meta: imageMetadataFieldsSchema.partial().optional(),
    places: mapPlacesSchema.optional(),
  })
  .superRefine((element, context) => {
    if (element.type === "map") {
      if (element.places === undefined) {
        context.addIssue({
          code: "custom",
          message: "Map elements require places",
          path: ["places"],
        });
      } else {
        try {
          assertUniqueMapPlaceIds(element.places);
        } catch {
          context.addIssue({
            code: "custom",
            message: "Duplicate map place id",
            path: ["places"],
          });
        }
      }
    } else if (element.places !== undefined) {
      context.addIssue({
        code: "custom",
        message: "Only map elements may have places",
        path: ["places"],
      });
    }
  });

export const pageDraftContentSchema = z.object({
  main_image_path: z.string().nullable(),
  main_image_meta: imageMetadataFieldsSchema.partial().optional(),
  elements: z.array(draftPageElementSchema),
});

export const upsertPageDraftBodySchema = pageDraftContentSchema;

export type DraftPageElement = z.infer<typeof draftPageElementSchema>;
export type PageDraftContent = z.infer<typeof pageDraftContentSchema>;
export type UpsertPageDraftBody = z.infer<typeof upsertPageDraftBodySchema>;

export function pageElementToDraftElement(element: PageElement): DraftPageElement {
  const base = {
    id: element.id,
    type: element.type,
    parent_id: element.parent_id,
    position: element.position,
    text: element.text,
    caption: element.caption,
    image_path: element.image_path,
  };

  if (element.type === "map") {
    return {
      ...base,
      places: parseMapPlaces(element.places),
    };
  }

  return base;
}

export function buildPageDraftContent(
  mainImagePath: string | null,
  mainImageMeta: PageDraftContent["main_image_meta"],
  elements: PageElement[],
): PageDraftContent {
  const flatIds = flattenPageElements(elements).map((element) => element.id);
  const byId = new Map(
    elements.map((element) => [
      element.id,
      { id: element.id, type: element.type },
    ]),
  );
  const assignments = assignmentsFromFlatOrder(flatIds, byId);
  const ordered = applyAssignmentsToElements(elements, assignments);

  return {
    main_image_path: mainImagePath,
    main_image_meta: mainImageMeta,
    elements: ordered.map(pageElementToDraftElement),
  };
}

export function draftContentToPageElements(
  pageId: string,
  content: PageDraftContent,
): PageElement[] {
  const now = new Date().toISOString();

  return content.elements.map((element) => ({
    id: element.id,
    page_id: pageId,
    type: element.type,
    parent_id: element.parent_id,
    position: element.position,
    text: element.text,
    caption: element.caption ?? null,
    image_path: element.image_path ?? null,
    image_id: null,
    places: element.type === "map" ? (element.places ?? []) : null,
    created_at: now,
    updated_at: now,
  }));
}

export function liveSnapshotToDraftContent(
  page: Pick<Page, "main_image_path">,
  elements: PageElement[],
): PageDraftContent {
  return buildPageDraftContent(page.main_image_path, undefined, elements);
}
