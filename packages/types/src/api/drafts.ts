import { z } from "zod";

import { imageMetadataFieldsSchema } from "./images.js";
import {
  draftElementItemSchema,
  itemFromMapPlace,
  mapItemDataSchema,
  mapPlaceFromItem,
  mapPlacesFromItems,
  type PageElementItem,
  type PageElementWithItems,
} from "./items.js";
import type { Page } from "./pages.js";
import type { Json } from "../database.gen.js";
import type { Tables } from "../helpers.js";
import {
  applyAssignmentsToElements,
  assignmentsFromFlatOrder,
  flattenPageElements,
} from "../pageElementOrder.js";
import { MAX_MAP_PLACES } from "./elements.js";

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
    image_id: z.string().uuid().nullable().optional(),
    items: z.array(draftElementItemSchema).max(MAX_MAP_PLACES).optional(),
  })
  .superRefine((element, context) => {
    if (element.type === "map") {
      if (element.items === undefined) {
        context.addIssue({
          code: "custom",
          message: "Map elements require items",
          path: ["items"],
        });
        return;
      }
      const ids = new Set<string>();
      for (const [index, item] of element.items.entries()) {
        if (ids.has(item.id)) {
          context.addIssue({
            code: "custom",
            message: "Duplicate item id",
            path: ["items", index, "id"],
          });
        }
        ids.add(item.id);
        const parsed = mapItemDataSchema.safeParse(item.data);
        if (!parsed.success) {
          context.addIssue({
            code: "custom",
            message: "Invalid map item data",
            path: ["items", index, "data"],
          });
        }
      }
    } else if (element.items !== undefined) {
      context.addIssue({
        code: "custom",
        message: "Only map elements may have items",
        path: ["items"],
      });
    }
  });

export const pageDraftContentSchema = z
  .object({
    main_image_path: z.string().nullable(),
    main_image_meta: imageMetadataFieldsSchema.partial().optional(),
    main_image_id: z.string().uuid().nullable().optional(),
    elements: z.array(draftPageElementSchema),
  })
  .superRefine((content, context) => {
    const ids = new Set<string>();
    for (const [index, element] of content.elements.entries()) {
      if (ids.has(element.id)) {
        context.addIssue({
          code: "custom",
          message: "Duplicate element id",
          path: ["elements", index, "id"],
        });
      }
      ids.add(element.id);
    }

    const itemIds = new Set<string>();
    for (const element of content.elements) {
      if (element.type !== "map" || !element.items) {
        continue;
      }
      for (const item of element.items) {
        if (itemIds.has(item.id)) {
          context.addIssue({
            code: "custom",
            message: "Item ids must be unique across the draft",
            path: ["elements"],
          });
          return;
        }
        itemIds.add(item.id);
      }
    }
  });

export const upsertPageDraftBodySchema = z.intersection(
  pageDraftContentSchema,
  z.object({
    base_version: z.number().int().positive(),
  }),
);

export const publishPageDraftBodySchema = z.object({
  force: z.boolean().optional(),
});

export type DraftPageElement = z.infer<typeof draftPageElementSchema>;
export type PageDraftContent = z.infer<typeof pageDraftContentSchema>;
export type UpsertPageDraftBody = z.infer<typeof upsertPageDraftBodySchema>;
export type PublishPageDraftBody = z.infer<typeof publishPageDraftBodySchema>;

export function pageElementToDraftElement(
  element: PageElementWithItems,
): DraftPageElement {
  const base = {
    id: element.id,
    type: element.type,
    parent_id: element.parent_id,
    position: element.position,
    text: element.text,
    caption: element.caption,
    image_path: element.image_path,
    image_id: element.image_id,
  };

  if (element.type === "map") {
    const items = (element.items ?? []).map((item) => ({
      id: item.id,
      label: item.label,
      data: item.data as Record<string, unknown>,
    }));
    return { ...base, items };
  }

  return base;
}

export function buildPageDraftContent(
  mainImagePath: string | null,
  mainImageMeta: PageDraftContent["main_image_meta"],
  mainImageId: string | null,
  elements: PageElementWithItems[],
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
  const itemsById = new Map(elements.map((element) => [element.id, element.items]));

  return {
    main_image_path: mainImagePath,
    main_image_meta: mainImageMeta,
    main_image_id: mainImageId,
    elements: ordered.map((element) =>
      pageElementToDraftElement({
        ...element,
        items: itemsById.get(element.id) ?? [],
      }),
    ),
  };
}

export function draftContentToPageElements(
  pageId: string,
  content: PageDraftContent,
): PageElementWithItems[] {
  const now = new Date().toISOString();

  return content.elements.map((element) => {
    const base: PageElementWithItems = {
      id: element.id,
      page_id: pageId,
      type: element.type,
      parent_id: element.parent_id,
      position: element.position,
      text: element.text,
      caption: element.caption ?? null,
      image_path: element.image_path ?? null,
      image_id: element.image_id ?? null,
      created_at: now,
      updated_at: now,
      items: [],
    };

    if (element.type === "map" && element.items) {
      base.items = element.items.map(
        (item, index): PageElementItem => ({
          id: item.id,
          element_id: element.id,
          page_id: pageId,
          position: index,
          label: item.label,
          data: item.data as NonNullable<Json>,
          created_at: now,
          updated_at: now,
        }),
      );
    }

    return base;
  });
}

export function liveSnapshotToDraftContent(
  page: Pick<Page, "main_image_path" | "main_image_id">,
  elements: PageElementWithItems[],
): PageDraftContent {
  return buildPageDraftContent(
    page.main_image_path,
    undefined,
    page.main_image_id,
    elements,
  );
}

export { mapPlaceFromItem, itemFromMapPlace, mapPlacesFromItems };
