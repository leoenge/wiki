import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  CaretDownIcon,
  CaretRightIcon,
  DotsSixVerticalIcon,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";

import type { PageElement } from "@ww/types";

import { useDeleteElement, useReorderElements } from "../../api/elements.js";
import { useAuth } from "../../lib/auth/AuthProvider.js";
import { contributorNameForImagePath } from "../../lib/userDisplay.js";
import {
  flatIdsFromElements,
  mergeVisibleFlatOrder,
  visibleFlatIds,
} from "../../lib/pageElementsTree.js";
import { StorageImage } from "../StorageImage.js";
import { SectionHeadingEditor } from "./SectionHeadingEditor.js";
import { ExpandedImageViewer } from "./ExpandedImageViewer.js";
import { SwipeToDeleteRow } from "./SwipeToDeleteRow.js";
import { TextElementEditor } from "./TextElementEditor.js";

type PageElementsListProps = {
  pageId: string;
  elements: PageElement[];
  accessToken: string | undefined;
  collapsedSectionIds: Readonly<Record<string, true>>;
  onToggleSectionCollapsed: (sectionId: string) => void;
};

function ImageElementRow({
  element,
  onExpand,
}: {
  element: PageElement;
  onExpand: (payload: { path: string; caption: string }) => void;
}) {
  if (!element.image_path) {
    return null;
  }

  return (
    <div className="bg-surface/50 flex min-w-0 flex-1 gap-4 rounded-sm">
      <button
        type="button"
        onClick={() =>
          onExpand({
            path: element.image_path!,
            caption: element.caption ?? "",
          })
        }
        className="shrink-0 cursor-zoom-in"
        aria-label="Expand image"
        data-swipe-exclude
      >
        <StorageImage
          path={element.image_path}
          className="size-40 rounded-sm object-cover"
        />
      </button>
      <div className="py-2">
        <p className="text-base leading-relaxed">{element.caption ?? ""}</p>
      </div>
    </div>
  );
}

type SortableRowProps = {
  element: PageElement;
  pageId: string;
  collapsedSectionIds: Readonly<Record<string, true>>;
  onToggleSectionCollapsed: (sectionId: string) => void;
  openSwipeElementId: string | null;
  onOpenSwipeChange: (elementId: string | null) => void;
  onDelete: (elementId: string) => void;
  onExpandImage: (payload: { path: string; caption: string }) => void;
};

function SortableRow({
  element,
  pageId,
  collapsedSectionIds,
  onToggleSectionCollapsed,
  openSwipeElementId,
  onOpenSwipeChange,
  onDelete,
  onExpandImage,
}: SortableRowProps) {
  const isSection = element.type === "section";
  const expanded = isSection && !collapsedSectionIds[element.id];
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: element.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={isDragging ? "relative z-10 opacity-90" : undefined}
    >
      <SwipeToDeleteRow
        elementId={element.id}
        openElementId={openSwipeElementId}
        onOpenChange={onOpenSwipeChange}
        onDelete={() => onDelete(element.id)}
      >
        <div className="flex items-start gap-1">
          <button
            type="button"
            data-swipe-exclude
            className={
              isSection
                ? "text-muted hover:text-foreground shrink-0 touch-none cursor-grab py-3 active:cursor-grabbing"
                : "text-muted hover:text-foreground shrink-0 touch-none cursor-grab py-4 active:cursor-grabbing"
            }
            aria-label="Drag to reorder"
            {...attributes}
            {...listeners}
          >
            <DotsSixVerticalIcon
              size={22}
              weight="bold"
              className="text-neutral-300"
            />
          </button>
          {isSection ? (
            <button
              type="button"
              data-swipe-exclude
              onClick={() => onToggleSectionCollapsed(element.id)}
              className="text-muted hover:text-foreground shrink-0 py-3"
              aria-label={expanded ? "Collapse section" : "Expand section"}
            >
              {expanded ? (
                <CaretDownIcon size={20} weight="bold" />
              ) : (
                <CaretRightIcon size={20} weight="bold" />
              )}
            </button>
          ) : null}
          <div className={`min-w-0 flex-1 ${isSection ? "py-1" : ""}`}>
            {element.type === "section" ? (
              <SectionHeadingEditor pageId={pageId} element={element} />
            ) : element.type === "text" ? (
              <TextElementEditor pageId={pageId} element={element} />
            ) : (
              <ImageElementRow element={element} onExpand={onExpandImage} />
            )}
          </div>
        </div>
      </SwipeToDeleteRow>
    </div>
  );
}

export function PageElementsList({
  pageId,
  elements,
  accessToken,
  collapsedSectionIds,
  onToggleSectionCollapsed,
}: PageElementsListProps) {
  const { user } = useAuth();
  const reorderElements = useReorderElements(accessToken);
  const deleteElementMutation = useDeleteElement(accessToken);
  const [expandedImage, setExpandedImage] = useState<{
    path: string;
    caption: string;
  } | null>(null);
  const [openSwipeElementId, setOpenSwipeElementId] = useState<string | null>(
    null,
  );
  const [flatIds, setFlatIds] = useState<string[]>(() =>
    flatIdsFromElements(elements),
  );

  const byId = useMemo(
    () => new Map(elements.map((element) => [element.id, element])),
    [elements],
  );

  useEffect(() => {
    setFlatIds(flatIdsFromElements(elements));
  }, [elements]);

  const visibleIds = useMemo(
    () => visibleFlatIds(flatIds, byId, collapsedSectionIds),
    [flatIds, byId, collapsedSectionIds],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function onDeleteElement(elementId: string) {
    setOpenSwipeElementId(null);
    void deleteElementMutation.mutate({ pageId, elementId });
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    const activeId = String(active.id);
    const overId = String(over.id);
    const oldIndex = visibleIds.indexOf(activeId);
    const newIndex = visibleIds.indexOf(overId);
    if (oldIndex < 0 || newIndex < 0) {
      return;
    }

    const nextVisible = arrayMove(visibleIds, oldIndex, newIndex);
    const nextFlat = mergeVisibleFlatOrder(
      flatIds,
      nextVisible,
      collapsedSectionIds,
      byId,
    );

    setFlatIds(nextFlat);
    void reorderElements.mutate({
      pageId,
      body: { element_ids: nextFlat },
    });
  }

  if (visibleIds.length === 0) {
    return null;
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext
          items={visibleIds}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-6">
            {visibleIds.map((id) => {
              const element = byId.get(id);
              if (!element) {
                return null;
              }

              return (
                <SortableRow
                  key={element.id}
                  element={element}
                  pageId={pageId}
                  collapsedSectionIds={collapsedSectionIds}
                  onToggleSectionCollapsed={onToggleSectionCollapsed}
                  openSwipeElementId={openSwipeElementId}
                  onOpenSwipeChange={setOpenSwipeElementId}
                  onDelete={onDeleteElement}
                  onExpandImage={(payload) => setExpandedImage(payload)}
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      <ExpandedImageViewer
        open={expandedImage !== null}
        onClose={() => setExpandedImage(null)}
        imagePath={expandedImage?.path ?? null}
        caption={expandedImage?.caption ?? ""}
        contributorName={
          expandedImage
            ? contributorNameForImagePath(expandedImage.path, user)
            : ""
        }
      />
    </>
  );
}
