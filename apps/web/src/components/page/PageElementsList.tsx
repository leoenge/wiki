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
  PlusIcon,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";

import type { MapPlace, PageElement } from "@ww/types";

import { displayName, useProfiles } from "../../api/profiles.js";
import { useAuth } from "../../lib/auth/AuthProvider.js";
import { displayNameFromUser } from "../../lib/userDisplay.js";
import {
  flatIdsFromElements,
  flatInsertIndexFromVisibleSlot,
  mergeVisibleFlatOrder,
  visibleFlatIds,
} from "../../lib/pageElementsTree.js";
import { StorageImage } from "../StorageImage.js";
import { MapElementEditor } from "./MapElementEditor.js";
import { MapElementView } from "./MapElementView.js";
import { SectionHeadingEditor } from "./SectionHeadingEditor.js";
import { ExpandedImageViewer } from "./ExpandedImageViewer.js";
import { SwipeToDeleteRow } from "./SwipeToDeleteRow.js";
import { TextElementEditor } from "./TextElementEditor.js";

type PageElementsListProps = {
  elements: PageElement[];
  editable: boolean;
  collapsedSectionIds: Readonly<Record<string, true>>;
  onToggleSectionCollapsed: (sectionId: string) => void;
  onUpdateElementText?: (elementId: string, text: string) => void;
  onUpdateMapPlaces?: (elementId: string, places: MapPlace[]) => void;
  onDeleteElement?: (elementId: string) => void;
  onReorderToFlatIds?: (flatIds: string[]) => void;
  onInsertAtFlatIndex?: (flatInsertIndex: number) => void;
};

function ElementInsertSlot({
  onClick,
  className,
}: {
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-swipe-exclude
      className={[
        "bg-surface/70 border border-surface-strong/80 text-foreground/70 hover:bg-surface pointer-events-auto flex size-8 items-center justify-center rounded-full shadow-[0_2px_10px_rgba(0,0,0,0.14)]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="Add element here"
    >
      <PlusIcon size={18} weight="bold" />
    </button>
  );
}

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
    <div className="bg-surface/50 flex min-w-0 flex-1 gap-4 rounded-xs">
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
          className="size-40 rounded-xs object-cover"
        />
      </button>
      <div className="py-2">
        <p className="text-base leading-relaxed">{element.caption ?? ""}</p>
      </div>
    </div>
  );
}

type ElementRowProps = {
  element: PageElement;
  editable: boolean;
  collapsedSectionIds: Readonly<Record<string, true>>;
  onToggleSectionCollapsed: (sectionId: string) => void;
  openSwipeElementId: string | null;
  onOpenSwipeChange: (elementId: string | null) => void;
  onDelete: (elementId: string) => void;
  onExpandImage: (payload: { path: string; caption: string }) => void;
  onUpdateElementText?: (elementId: string, text: string) => void;
  onUpdateMapPlaces?: (elementId: string, places: MapPlace[]) => void;
  isDragging?: boolean;
  setNodeRef?: (node: HTMLElement | null) => void;
  style?: CSSProperties;
};

function ElementRowContent({
  element,
  editable,
  collapsedSectionIds,
  onToggleSectionCollapsed,
  onExpandImage,
  onUpdateElementText,
  onUpdateMapPlaces,
}: Pick<
  ElementRowProps,
  | "element"
  | "editable"
  | "collapsedSectionIds"
  | "onToggleSectionCollapsed"
  | "onExpandImage"
  | "onUpdateElementText"
  | "onUpdateMapPlaces"
>) {
  const isSection = element.type === "section";
  const expanded = isSection && !collapsedSectionIds[element.id];
  return (
    <div className="flex items-start gap-1">
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
          <SectionHeadingEditor
            element={element}
            editable={editable}
            onTextChange={onUpdateElementText}
          />
        ) : element.type === "text" ? (
          <TextElementEditor
            element={element}
            editable={editable}
            onTextChange={onUpdateElementText}
          />
        ) : element.type === "map" ? (
          editable && onUpdateMapPlaces ? (
            <MapElementEditor
              element={element}
              onPlacesChange={onUpdateMapPlaces}
            />
          ) : (
            <MapElementView element={element} />
          )
        ) : (
          <ImageElementRow element={element} onExpand={onExpandImage} />
        )}
      </div>
    </div>
  );
}

function SortableRow(props: ElementRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.element.id, disabled: !props.editable });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    ...props.style,
  };

  const row = (
    <ElementRowContent
      element={props.element}
      editable={props.editable}
      collapsedSectionIds={props.collapsedSectionIds}
      onToggleSectionCollapsed={props.onToggleSectionCollapsed}
      onExpandImage={props.onExpandImage}
      onUpdateElementText={props.onUpdateElementText}
      onUpdateMapPlaces={props.onUpdateMapPlaces}
    />
  );

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={isDragging ? "relative z-10 opacity-90" : "relative"}
    >
      {props.editable ? (
        <button
          type="button"
          className={`text-muted hover:text-foreground absolute right-full z-10 mr-0.5 touch-none cursor-grab active:cursor-grabbing ${
            props.element.type === "section"
              ? "top-0 py-4"
              : props.element.type === "map"
                ? "top-0 py-3"
                : "top-0 py-5"
          }`}
          aria-label="Drag to reorder"
          {...(attributes as unknown as Record<string, unknown>)}
          {...(listeners as Record<string, unknown> | undefined)}
        >
          <DotsSixVerticalIcon
            size={18}
            weight="bold"
            className="text-neutral-300"
          />
        </button>
      ) : null}
      {props.editable ? (
        <SwipeToDeleteRow
          elementId={props.element.id}
          openElementId={props.openSwipeElementId}
          onOpenChange={props.onOpenSwipeChange}
          onDelete={() => props.onDelete(props.element.id)}
        >
          {row}
        </SwipeToDeleteRow>
      ) : (
        row
      )}
    </div>
  );
}

function StaticRow(props: ElementRowProps) {
  return (
    <ElementRowContent
      element={props.element}
      editable={false}
      collapsedSectionIds={props.collapsedSectionIds}
      onToggleSectionCollapsed={props.onToggleSectionCollapsed}
      onExpandImage={props.onExpandImage}
      onUpdateMapPlaces={props.onUpdateMapPlaces}
    />
  );
}

export function PageElementsList({
  elements,
  editable,
  collapsedSectionIds,
  onToggleSectionCollapsed,
  onUpdateElementText,
  onUpdateMapPlaces,
  onDeleteElement,
  onReorderToFlatIds,
  onInsertAtFlatIndex,
}: PageElementsListProps) {
  const { user } = useAuth();
  const [expandedImage, setExpandedImage] = useState<{
    path: string;
    caption: string;
  } | null>(null);
  const expandedUploaderId = expandedImage?.path.split("/")[0] ?? "";
  const { getProfile, isLoading: profilesLoading } = useProfiles(
    expandedUploaderId ? [expandedUploaderId] : [],
  );
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

  function handleDelete(elementId: string) {
    setOpenSwipeElementId(null);
    onDeleteElement?.(elementId);
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !onReorderToFlatIds) {
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
    onReorderToFlatIds(nextFlat);
  }

  function handleInsertAtVisibleSlot(visibleSlotIndex: number) {
    if (!onInsertAtFlatIndex) {
      return;
    }

    const flatInsertIndex = flatInsertIndexFromVisibleSlot(
      flatIds,
      visibleIds,
      visibleSlotIndex,
    );
    onInsertAtFlatIndex(flatInsertIndex);
  }

  const rowProps = {
    editable,
    collapsedSectionIds,
    onToggleSectionCollapsed,
    openSwipeElementId,
    onOpenSwipeChange: setOpenSwipeElementId,
    onDelete: handleDelete,
    onExpandImage: (payload: { path: string; caption: string }) =>
      setExpandedImage(payload),
    onUpdateElementText,
    onUpdateMapPlaces,
  };

  const showInsertSlots = editable && Boolean(onInsertAtFlatIndex);

  const listBody = (
    <div
      className={["flex flex-col gap-4", showInsertSlots ? "pt-4 pb-4" : ""]
        .filter(Boolean)
        .join(" ")}
    >
      {visibleIds.length === 0 && showInsertSlots ? (
        <div className="flex justify-center py-2">
          <ElementInsertSlot onClick={() => handleInsertAtVisibleSlot(0)} />
        </div>
      ) : null}
      {visibleIds.map((id, index) => {
        const element = byId.get(id);
        if (!element) {
          return null;
        }

        const row = editable ? (
          <SortableRow element={element} {...rowProps} />
        ) : (
          <StaticRow element={element} {...rowProps} />
        );

        if (!showInsertSlots) {
          return (
            <div key={element.id} className="min-w-0">
              {row}
            </div>
          );
        }

        return (
          <div key={element.id} className="relative min-w-0">
            {index === 0 ? (
              <ElementInsertSlot
                className="absolute top-0 left-1/2 z-20 -translate-x-1/2 -translate-y-1/2"
                onClick={() => handleInsertAtVisibleSlot(0)}
              />
            ) : null}
            {row}
            <ElementInsertSlot
              className="absolute bottom-0 left-1/2 z-20 -translate-x-1/2 translate-y-1/2"
              onClick={() => handleInsertAtVisibleSlot(index + 1)}
            />
          </div>
        );
      })}
    </div>
  );

  if (!editable && visibleIds.length === 0) {
    return null;
  }

  return (
    <>
      {editable ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <SortableContext
            items={visibleIds}
            strategy={verticalListSortingStrategy}
          >
            {listBody}
          </SortableContext>
        </DndContext>
      ) : (
        listBody
      )}

      <ExpandedImageViewer
        open={expandedImage !== null}
        onClose={() => setExpandedImage(null)}
        imagePath={expandedImage?.path ?? null}
        caption={expandedImage?.caption ?? ""}
        contributorName={
          expandedImage
            ? (() => {
                const profile = getProfile(expandedUploaderId);
                if (profile) {
                  return displayName(profile);
                }
                if (profilesLoading && user?.id === expandedUploaderId) {
                  return displayNameFromUser(user);
                }
                return displayName(profile, { loading: profilesLoading });
              })()
            : ""
        }
      />
    </>
  );
}
