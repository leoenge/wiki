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

export const MAX_LIST_ITEMS = 200;
export const MAX_REVIEW_ITEMS = 100;

export const listStyleSchema = z.enum(["bullet", "numbered"]);
export type ListStyle = z.infer<typeof listStyleSchema>;

const emptyItemDataSchema = z.record(z.string(), z.unknown()).refine(
  (data) => Object.keys(data).length === 0,
  { message: "List and review items require empty data" },
);

const itemBearingTypes = new Set(["map", "list", "review"]);

function validateElementItems(
  element: {
    type: string;
    items?: z.infer<typeof draftElementItemSchema>[];
    list_style?: ListStyle | null;
  },
  context: z.RefinementCtx,
  pathPrefix: (string | number)[],
) {
  const items = element.items;

  if (itemBearingTypes.has(element.type)) {
    if (items === undefined) {
      context.addIssue({
        code: "custom",
        message: "This element type requires items",
        path: [...pathPrefix, "items"],
      });
      return;
    }

    const ids = new Set<string>();
    for (const [index, item] of items.entries()) {
      if (ids.has(item.id)) {
        context.addIssue({
          code: "custom",
          message: "Duplicate item id",
          path: [...pathPrefix, "items", index, "id"],
        });
      }
      ids.add(item.id);

      if (element.type === "map") {
        const parsed = mapItemDataSchema.safeParse(item.data);
        if (!parsed.success) {
          context.addIssue({
            code: "custom",
            message: "Invalid map item data",
            path: [...pathPrefix, "items", index, "data"],
          });
        }
        if (item.label.trim().length < 1 || item.label.length > 500) {
          context.addIssue({
            code: "custom",
            message: "Invalid map item label",
            path: [...pathPrefix, "items", index, "label"],
          });
        }
      }

      if (element.type === "list") {
        const trimmed = item.label.trim();
        if (trimmed.length < 1 || trimmed.length > 2000) {
          context.addIssue({
            code: "custom",
            message: "List item label must be 1 to 2000 characters",
            path: [...pathPrefix, "items", index, "label"],
          });
        }
        const dataOk = emptyItemDataSchema.safeParse(item.data);
        if (!dataOk.success) {
          context.addIssue({
            code: "custom",
            message: "List items require empty data",
            path: [...pathPrefix, "items", index, "data"],
          });
        }
      }

      if (element.type === "review") {
        const trimmed = item.label.trim();
        if (trimmed.length < 1 || trimmed.length > 200) {
          context.addIssue({
            code: "custom",
            message: "Review item label must be 1 to 200 characters",
            path: [...pathPrefix, "items", index, "label"],
          });
        }
        const dataOk = emptyItemDataSchema.safeParse(item.data);
        if (!dataOk.success) {
          context.addIssue({
            code: "custom",
            message: "Review items require empty data",
            path: [...pathPrefix, "items", index, "label"],
          });
        }
      }
    }

    if (element.type === "list" && items.length > MAX_LIST_ITEMS) {
      context.addIssue({
        code: "custom",
        message: `List may have at most ${MAX_LIST_ITEMS} items`,
        path: [...pathPrefix, "items"],
      });
    }

    if (element.type === "review" && items.length > MAX_REVIEW_ITEMS) {
      context.addIssue({
        code: "custom",
        message: `Review element may have at most ${MAX_REVIEW_ITEMS} items`,
        path: [...pathPrefix, "items"],
      });
    }

    if (element.type === "map" && items.length > MAX_MAP_PLACES) {
      context.addIssue({
        code: "custom",
        message: `Map may have at most ${MAX_MAP_PLACES} places`,
        path: [...pathPrefix, "items"],
      });
    }
  } else if (items !== undefined) {
    context.addIssue({
      code: "custom",
      message: "Only map, list, and review elements may have items",
      path: [...pathPrefix, "items"],
    });
  }

  if (element.type === "list") {
    const parsed = listStyleSchema.safeParse(element.list_style);
    if (!parsed.success) {
      context.addIssue({
        code: "custom",
        message: "List elements require list_style",
        path: [...pathPrefix, "list_style"],
      });
    }
  } else if (element.list_style != null) {
    context.addIssue({
      code: "custom",
      message: "Only list elements may have list_style",
      path: [...pathPrefix, "list_style"],
    });
  }
}

export const draftPageElementSchema = z
  .object({
    id: z.string().uuid(),
    type: z.enum(["image", "text", "section", "map", "list", "review"]),
    parent_id: z.string().uuid().nullable(),
    position: z.number().int().nonnegative(),
    text: z.string().nullable(),
    caption: z.string().nullable().optional(),
    image_path: z.string().nullable().optional(),
    image_meta: imageMetadataFieldsSchema.partial().optional(),
    image_id: z.string().uuid().nullable().optional(),
    list_style: listStyleSchema.nullable().optional(),
    items: z
      .array(draftElementItemSchema)
      .max(Math.max(MAX_MAP_PLACES, MAX_LIST_ITEMS, MAX_REVIEW_ITEMS))
      .optional(),
  })
  .superRefine((element, context) => {
    validateElementItems(element, context, []);
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
      if (!itemBearingTypes.has(element.type) || !element.items) {
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

function itemsFromElement(element: PageElementWithItems): DraftPageElement["items"] {
  return (element.items ?? []).map((item) => ({
    id: item.id,
    label: item.label,
    data: item.data as Record<string, unknown>,
  }));
}

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
    list_style:
      element.type === "list"
        ? listStyleSchema.parse(element.list_style ?? "bullet")
        : null,
  };

  if (element.type === "map" || element.type === "list" || element.type === "review") {
    return { ...base, items: itemsFromElement(element) };
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
      list_style:
        element.type === "list"
          ? (element.list_style ?? "bullet")
          : null,
      created_at: now,
      updated_at: now,
      items: [],
    };

    if (
      (element.type === "map" || element.type === "list" || element.type === "review") &&
      element.items
    ) {
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
