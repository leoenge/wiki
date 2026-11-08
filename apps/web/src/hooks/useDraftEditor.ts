import { useCallback, useEffect, useRef, useState } from "react";

import {
  applyAssignmentsToElements,
  assignmentsFromFlatOrder,
  buildPageDraftContent,
  draftContentToPageElements,
  flattenPageElements,
  itemFromMapPlace,
  type ImageMetadataFields,
  type Json,
  type MapPlace,
  type Page,
  type PageDraftContent,
  type PageElementItem,
  type PageElementWithItems,
} from "@ww/types";

import { ApiError } from "../api/client.js";
import { useSavePageDraft } from "../api/drafts.js";

const AUTOSAVE_MS = 800;

type UseDraftEditorOptions = {
  page: Page;
  liveElements: PageElementWithItems[];
  liveMainImagePath: string | null;
  draftContent: PageDraftContent | null;
  draftBaseVersion: number | undefined;
  isEditing: boolean;
  accessToken: string | undefined;
  onDraftAccessLost?: () => void;
};

function imageMetaMapFromDraft(content: PageDraftContent): Map<string, ImageMetadataFields> {
  const map = new Map<string, ImageMetadataFields>();

  for (const element of content.elements) {
    if (element.type === "image" && element.image_path && element.image_meta) {
      map.set(element.image_path, {
        taken_at: element.image_meta.taken_at ?? new Date().toISOString(),
        latitude: element.image_meta.latitude ?? null,
        longitude: element.image_meta.longitude ?? null,
      });
    }
  }

  return map;
}

function applyFlatOrderToElements(
  elements: PageElementWithItems[],
  flatIds: string[],
): PageElementWithItems[] {
  const byId = new Map(
    elements.map((element) => [
      element.id,
      { id: element.id, type: element.type },
    ]),
  );
  const assignments = assignmentsFromFlatOrder(flatIds, byId);
  const reordered = applyAssignmentsToElements(elements, assignments);
  const itemsById = new Map(elements.map((element) => [element.id, element.items]));
  return reordered.map((element) => ({
    ...element,
    items: itemsById.get(element.id) ?? [],
  }));
}

function newElement(
  pageId: string,
  partial: Pick<PageElementWithItems, "type"> &
    Partial<
      Pick<
        PageElementWithItems,
        "text" | "caption" | "image_path" | "parent_id" | "position" | "items"
      >
    >,
): PageElementWithItems {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    page_id: pageId,
    type: partial.type,
    parent_id: partial.parent_id ?? null,
    position: partial.position ?? 0,
    text: partial.text ?? null,
    caption: partial.caption ?? null,
    image_path: partial.image_path ?? null,
    image_id: null,
    items: partial.items ?? [],
    created_at: now,
    updated_at: now,
  };
}

function mapPlacesToItems(places: MapPlace[]): PageElementItem[] {
  const now = new Date().toISOString();
  return places.map((place, index) => {
    const draftItem = itemFromMapPlace(place);
    return {
      id: draftItem.id,
      element_id: "",
      page_id: "",
      position: index,
      label: draftItem.label,
      data: draftItem.data as NonNullable<Json>,
      created_at: now,
      updated_at: now,
    };
  });
}

export function useDraftEditor({
  page,
  liveElements,
  liveMainImagePath,
  draftContent,
  draftBaseVersion,
  isEditing,
  accessToken,
  onDraftAccessLost,
}: UseDraftEditorOptions) {
  const saveDraft = useSavePageDraft(accessToken);
  const [mainImagePath, setMainImagePathState] = useState<string | null>(
    liveMainImagePath,
  );
  const [mainImageMeta, setMainImageMeta] = useState<
    PageDraftContent["main_image_meta"]
  >(undefined);
  const [elements, setElements] = useState<PageElementWithItems[]>(liveElements);
  const [imageMetaByPath, setImageMetaByPath] = useState<
    Map<string, ImageMetadataFields>
  >(() => new Map());
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestContentRef = useRef<PageDraftContent | null>(null);
  const seededRef = useRef<string | null>(null);
  const baseVersionRef = useRef<number>(page.version);

  useEffect(() => {
    baseVersionRef.current = draftBaseVersion ?? page.version;
  }, [draftBaseVersion, page.version]);

  const buildContent = useCallback((): PageDraftContent => {
    const base = buildPageDraftContent(
      mainImagePath,
      mainImageMeta,
      page.main_image_id,
      elements,
    );

    return {
      ...base,
      elements: base.elements.map((element) => {
        if (element.type !== "image" || !element.image_path) {
          return element;
        }

        const meta = imageMetaByPath.get(element.image_path);
        return meta ? { ...element, image_meta: meta } : element;
      }),
    };
  }, [elements, imageMetaByPath, mainImageMeta, mainImagePath, page.main_image_id]);

  const persist = useCallback(
    async (content: PageDraftContent) => {
      if (!accessToken) {
        return;
      }

      latestContentRef.current = content;
      setSaveStatus("saving");
      try {
        await saveDraft.mutateAsync({
          pageId: page.id,
          body: content,
          baseVersion: baseVersionRef.current,
        });
        setSaveStatus("saved");
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          onDraftAccessLost?.();
          return;
        }
        setSaveStatus("error");
      }
    },
    [accessToken, onDraftAccessLost, page.id, saveDraft],
  );

  const clearScheduledSave = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const scheduleSave = useCallback(() => {
    if (!isEditing) {
      return;
    }

    clearScheduledSave();
    timeoutRef.current = setTimeout(() => {
      void persist(buildContent());
    }, AUTOSAVE_MS);
  }, [buildContent, clearScheduledSave, isEditing, persist]);

  useEffect(() => {
    if (!isEditing || !accessToken) {
      return;
    }

    scheduleSave();

    return () => {
      clearScheduledSave();
    };
  }, [
    accessToken,
    clearScheduledSave,
    elements,
    imageMetaByPath,
    isEditing,
    mainImageMeta,
    mainImagePath,
    scheduleSave,
  ]);

  const flushSave = useCallback(() => {
    clearScheduledSave();
    if (!isEditing || !accessToken) {
      return;
    }
    const content = buildContent();
    latestContentRef.current = content;
    void persist(content);
  }, [accessToken, buildContent, clearScheduledSave, isEditing, persist]);

  const saveNow = useCallback(async () => {
    clearScheduledSave();
    if (!isEditing || !accessToken) {
      return;
    }
    const content = buildContent();
    latestContentRef.current = content;
    await persist(content);
  }, [accessToken, buildContent, clearScheduledSave, isEditing, persist]);

  useEffect(() => {
    if (!isEditing) {
      seededRef.current = null;
      return;
    }

    const seedKey = `${page.id}:${draftContent ? "draft" : "live"}`;
    if (seededRef.current === seedKey) {
      return;
    }

    if (draftContent) {
      setMainImagePathState(draftContent.main_image_path);
      setMainImageMeta(draftContent.main_image_meta);
      setElements(draftContentToPageElements(page.id, draftContent));
      setImageMetaByPath(imageMetaMapFromDraft(draftContent));
    } else {
      setMainImagePathState(liveMainImagePath);
      setMainImageMeta(undefined);
      setElements(liveElements);
      setImageMetaByPath(new Map());
    }

    seededRef.current = seedKey;
  }, [draftContent, isEditing, liveElements, liveMainImagePath, page.id]);

  useEffect(() => {
    return () => {
      clearScheduledSave();
    };
  }, [clearScheduledSave]);

  const updateElementText = useCallback(
    (elementId: string, text: string) => {
      setElements((previous) =>
        previous.map((element) =>
          element.id === elementId ? { ...element, text } : element,
        ),
      );
    },
    [],
  );

  const deleteElementById = useCallback(
    (elementId: string) => {
      setElements((previous) => {
        const next = previous.filter((element) => element.id !== elementId);
        const flat = flattenPageElements(next).map((element) => element.id);
        return applyFlatOrderToElements(next, flat);
      });
    },
    [],
  );

  const reorderToFlatIds = useCallback(
    (flatIds: string[]) => {
      setElements((previous) => applyFlatOrderToElements(previous, flatIds));
    },
    [],
  );

  const setMainImage = useCallback((path: string, meta: ImageMetadataFields) => {
    setMainImagePathState(path);
    setMainImageMeta(meta);
  }, []);

  const addTextElementAt = useCallback(
    (insertAtFlatIndex: number) => {
      const created = newElement(page.id, { type: "text", text: "" });
      setElements((previous) => {
        const flat = flattenPageElements(previous).map((element) => element.id);
        const insertAt = Math.max(0, Math.min(insertAtFlatIndex, flat.length));
        const nextFlat = [
          ...flat.slice(0, insertAt),
          created.id,
          ...flat.slice(insertAt),
        ];
        return applyFlatOrderToElements([...previous, created], nextFlat);
      });
      return created;
    },
    [page.id],
  );

  const addSectionElementAt = useCallback(
    (insertAtFlatIndex: number) => {
      const created = newElement(page.id, { type: "section", text: "" });
      setElements((previous) => {
        const flat = flattenPageElements(previous).map((element) => element.id);
        const insertAt = Math.max(0, Math.min(insertAtFlatIndex, flat.length));
        const nextFlat = [
          ...flat.slice(0, insertAt),
          created.id,
          ...flat.slice(insertAt),
        ];
        return applyFlatOrderToElements([...previous, created], nextFlat);
      });
      return created;
    },
    [page.id],
  );

  const addImageElementsAt = useCallback(
    (
      insertAtFlatIndex: number,
      items: {
        image_path: string;
        caption: string;
        taken_at: string;
        latitude: number | null | undefined;
        longitude: number | null | undefined;
      }[],
    ) => {
      const sorted = [...items].sort(
        (a, b) =>
          new Date(a.taken_at).getTime() - new Date(b.taken_at).getTime(),
      );

      const created = sorted.map((item) =>
        newElement(page.id, {
          type: "image",
          image_path: item.image_path,
          caption: item.caption,
        }),
      );

      setImageMetaByPath((previous) => {
        const next = new Map(previous);
        for (const item of sorted) {
          next.set(item.image_path, {
            taken_at: item.taken_at,
            latitude: item.latitude,
            longitude: item.longitude,
          });
        }
        return next;
      });

      setElements((previous) => {
        const flat = flattenPageElements(previous).map((element) => element.id);
        const insertAt = Math.max(0, Math.min(insertAtFlatIndex, flat.length));
        const newIds = created.map((element) => element.id);
        const nextFlat = [
          ...flat.slice(0, insertAt),
          ...newIds,
          ...flat.slice(insertAt),
        ];
        return applyFlatOrderToElements([...previous, ...created], nextFlat);
      });
    },
    [page.id],
  );

  const addMapElementAt = useCallback(
    (insertAtFlatIndex: number) => {
      const created = newElement(page.id, { type: "map", items: [] });
      setElements((previous) => {
        const flat = flattenPageElements(previous).map((element) => element.id);
        const insertAt = Math.max(0, Math.min(insertAtFlatIndex, flat.length));
        const nextFlat = [
          ...flat.slice(0, insertAt),
          created.id,
          ...flat.slice(insertAt),
        ];
        return applyFlatOrderToElements([...previous, created], nextFlat);
      });
      return created;
    },
    [page.id],
  );

  const updateMapPlaces = useCallback(
    (elementId: string, places: MapPlace[]) => {
      const items = mapPlacesToItems(places);
      setElements((previous) =>
        previous.map((element) =>
          element.id === elementId
            ? { ...element, items: items.map((item, index) => ({
                ...item,
                element_id: elementId,
                page_id: page.id,
                position: index,
              })) }
            : element,
        ),
      );
    },
    [page.id],
  );

  const resetToLive = useCallback(() => {
    clearScheduledSave();
    setMainImagePathState(liveMainImagePath);
    setMainImageMeta(undefined);
    setElements(liveElements);
    setImageMetaByPath(new Map());
    setSaveStatus("idle");
    seededRef.current = `${page.id}:live`;
  }, [clearScheduledSave, liveElements, liveMainImagePath, page.id]);

  return {
    elements,
    mainImagePath,
    saveStatus,
    updateElementText,
    deleteElementById,
    reorderToFlatIds,
    setMainImage,
    addTextElementAt,
    addSectionElementAt,
    addImageElementsAt,
    addMapElementAt,
    updateMapPlaces,
    flushSave,
    saveNow,
    resetToLive,
  };
}
