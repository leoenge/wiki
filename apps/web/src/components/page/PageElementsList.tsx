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
  ChatCircleIcon,
  DotsSixVerticalIcon,
  PlusIcon,
} from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import { useEffect, useMemo, useState, type CSSProperties } from "react";

import type {
  DraftElementItem,
  ListStyle,
  MapPlace,
  PageElementWithItems,
} from "@ww/types";
import { useQuery } from "@tanstack/react-query";

import { type ItemReviewSummary, usePageReviews } from "../../api/reviews.js";
import { usePageCommentCounts } from "../../api/comments.js";
import { displayName, useProfiles } from "../../api/profiles.js";
import { supabase } from "../../lib/supabase.js";
import { useAuth } from "../../lib/auth/AuthProvider.js";
import { displayNameFromUser } from "../../lib/userDisplay.js";
import {
  flatIdsFromElements,
  flatInsertIndexFromVisibleSlot,
  mergeVisibleFlatOrder,
  visibleFlatIds,
} from "../../lib/pageElementsTree.js";
import { ListElementEditor } from "./ListElementEditor.js";
import { ListElementView } from "./ListElementView.js";
import { MapElementEditor } from "./MapElementEditor.js";
import { MapElementView } from "./MapElementView.js";
import { ReviewElementEditor } from "./ReviewElementEditor.js";
import { ReviewElementView } from "./ReviewElementView.js";
import { SectionHeadingEditor } from "./SectionHeadingEditor.js";
import { ExpandedImageViewer } from "./ExpandedImageViewer.js";
import { WikiImageThumb } from "./WikiImageThumb.js";
import { SwipeToDeleteRow } from "./SwipeToDeleteRow.js";
import { TextElementEditor } from "./TextElementEditor.js";

type PageElementsListProps = {
  elements: PageElementWithItems[];
  editable: boolean;
  pageId?: string;
  pageTag?: string;
  collapsedSectionIds: Readonly<Record<string, true>>;
  onToggleSectionCollapsed: (sectionId: string) => void;
  onUpdateElementText?: (elementId: string, text: string) => void;
  onUpdateMapPlaces?: (elementId: string, places: MapPlace[]) => void;
  onUpdateElementItems?: (elementId: string, items: DraftElementItem[]) => void;
  onSetListStyle?: (elementId: string, style: ListStyle) => void;
  onDeleteElement?: (elementId: string) => void;
  onReorderToFlatIds?: (flatIds: string[]) => void;
  onInsertAtFlatIndex?: (flatInsertIndex: number) => void;
};

export type ElementContentProps = {
  element: PageElementWithItems;
  editable?: boolean;
  viewMode?: boolean;
  pageId?: string;
  byItemId?: Map<string, ItemReviewSummary>;
  collapsedSectionIds?: Readonly<Record<string, true>>;
  onToggleSectionCollapsed?: (sectionId: string) => void;
  onExpandImage?: (payload: { path: string; caption: string }) => void;
  onUpdateElementText?: (elementId: string, text: string) => void;
  onUpdateMapPlaces?: (elementId: string, places: MapPlace[]) => void;
  onUpdateElementItems?: (elementId: string, items: DraftElementItem[]) => void;
  onSetListStyle?: (elementId: string, style: ListStyle) => void;
  removeNoteForItem?: (itemId: string) => string | null;
  showCommentLink?: boolean;
  commentCount?: number;
  pageTag?: string;
};

function ElementCommentLink({
  tag,
  elementId,
  count,
}: {
  tag: string;
  elementId: string;
  count: number;
}) {
  return (
    <Link
      to={`/${tag}/e/${elementId}`}
      className="text-muted hover:text-foreground inline-flex items-center gap-1 text-sm"
      data-swipe-exclude
    >
      <ChatCircleIcon size={20} weight="duotone" />
      {count > 0 ? <span>{count}</span> : null}
    </Link>
  );
}

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
  element: PageElementWithItems;
  onExpand: (payload: { path: string; caption: string }) => void;
}) {
  if (!element.image_path) {
    return null;
  }

  return (
    <WikiImageThumb
      path={element.image_path}
      caption={element.caption ?? ""}
      onExpand={() =>
        onExpand({
          path: element.image_path!,
          caption: element.caption ?? "",
        })
      }
    />
  );
}

type ElementRowProps = {
  element: PageElementWithItems;
  editable: boolean;
  viewMode: boolean;
  pageId?: string;
  pageTag?: string;
  byItemId?: Map<string, ItemReviewSummary>;
  commentCount?: number;
  collapsedSectionIds: Readonly<Record<string, true>>;
  onToggleSectionCollapsed: (sectionId: string) => void;
  openSwipeElementId: string | null;
  onOpenSwipeChange: (elementId: string | null) => void;
  onDelete: (elementId: string) => void;
  onExpandImage: (payload: { path: string; caption: string }) => void;
  onUpdateElementText?: (elementId: string, text: string) => void;
  onUpdateMapPlaces?: (elementId: string, places: MapPlace[]) => void;
  onUpdateElementItems?: (elementId: string, items: DraftElementItem[]) => void;
  onSetListStyle?: (elementId: string, style: ListStyle) => void;
  removeNoteForItem?: (itemId: string) => string | null;
  deleteHint?: string | null;
  isDragging?: boolean;
  setNodeRef?: (node: HTMLElement | null) => void;
  style?: CSSProperties;
};

export function ElementContent({
  element,
  editable = false,
  viewMode = false,
  pageId,
  byItemId,
  collapsedSectionIds = {},
  onToggleSectionCollapsed,
  onExpandImage,
  onUpdateElementText,
  onUpdateMapPlaces,
  onUpdateElementItems,
  onSetListStyle,
  removeNoteForItem,
  showCommentLink = false,
  commentCount = 0,
  pageTag,
}: ElementContentProps) {
  const isSection = element.type === "section";
  const expanded = isSection && !collapsedSectionIds[element.id];
  const showReviews = viewMode && pageId && byItemId;

  const elementBody =
    element.type === "section" ? (
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
          removeNoteForItem={removeNoteForItem}
        />
      ) : (
        <MapElementView
          element={element}
          pageId={showReviews ? pageId : undefined}
          byItemId={byItemId}
        />
      )
    ) : element.type === "list" ? (
      editable && onUpdateElementItems && onSetListStyle ? (
        <ListElementEditor
          element={element}
          onItemsChange={onUpdateElementItems}
          onListStyleChange={onSetListStyle}
          removeNoteForItem={removeNoteForItem}
        />
      ) : (
        <ListElementView element={element} />
      )
    ) : element.type === "review" ? (
      editable && onUpdateElementItems ? (
        <ReviewElementEditor
          element={element}
          onItemsChange={onUpdateElementItems}
          removeNoteForItem={removeNoteForItem}
        />
      ) : (
        <ReviewElementView
          element={element}
          pageId={pageId ?? ""}
          byItemId={byItemId ?? new Map()}
        />
      )
    ) : (
      <ImageElementRow
        element={element}
        onExpand={onExpandImage ?? (() => {})}
      />
    );

  const commentRow =
    showCommentLink && pageTag ? (
      <div className="flex justify-end">
        <ElementCommentLink
          tag={pageTag}
          elementId={element.id}
          count={commentCount}
        />
      </div>
    ) : null;

  return (
    <div className="flex items-start gap-1">
      {isSection && onToggleSectionCollapsed ? (
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
      <div
        className={`min-w-0 flex-1 ${isSection ? "py-1" : ""}`}
      >
        {elementBody}
        {commentRow}
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
    <ElementContent
      element={props.element}
      editable={props.editable}
      viewMode={props.viewMode}
      pageId={props.pageId}
      pageTag={props.pageTag}
      byItemId={props.byItemId}
      collapsedSectionIds={props.collapsedSectionIds}
      onToggleSectionCollapsed={props.onToggleSectionCollapsed}
      onExpandImage={props.onExpandImage}
      onUpdateElementText={props.onUpdateElementText}
      onUpdateMapPlaces={props.onUpdateMapPlaces}
      onUpdateElementItems={props.onUpdateElementItems}
      onSetListStyle={props.onSetListStyle}
      removeNoteForItem={props.removeNoteForItem}
      showCommentLink={props.viewMode && props.element.type !== "section"}
      commentCount={props.commentCount ?? 0}
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
          deleteHint={props.deleteHint}
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
    <ElementContent
      element={props.element}
      editable={false}
      viewMode={props.viewMode}
      pageId={props.pageId}
      pageTag={props.pageTag}
      byItemId={props.byItemId}
      collapsedSectionIds={props.collapsedSectionIds}
      onToggleSectionCollapsed={props.onToggleSectionCollapsed}
      onExpandImage={props.onExpandImage}
      onUpdateMapPlaces={props.onUpdateMapPlaces}
      showCommentLink={props.viewMode && props.element.type !== "section"}
      commentCount={props.commentCount ?? 0}
    />
  );
}

export function PageElementsList({
  elements,
  editable,
  pageId,
  pageTag,
  collapsedSectionIds,
  onToggleSectionCollapsed,
  onUpdateElementText,
  onUpdateMapPlaces,
  onUpdateElementItems,
  onSetListStyle,
  onDeleteElement,
  onReorderToFlatIds,
  onInsertAtFlatIndex,
}: PageElementsListProps) {
  const { user } = useAuth();
  const viewMode = !editable;
  const { byItemId, removeNoteForItem, removeNoteForElement } = usePageReviews(
    pageId,
  );
  const { countByElementId } = usePageCommentCounts(viewMode ? pageId : undefined);
  const [expandedImage, setExpandedImage] = useState<{
    path: string;
    caption: string;
  } | null>(null);
  const expandedImagePath = expandedImage?.path ?? null;
  const imageMetaQuery = useQuery({
    queryKey: ["image-meta", expandedImagePath],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("images")
        .select("owner_id")
        .eq("path", expandedImagePath!)
        .maybeSingle();
      if (error) {
        throw error;
      }
      return data;
    },
    enabled: Boolean(expandedImagePath),
  });

  const expandedUploaderId = imageMetaQuery.data?.owner_id ?? "";
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
    viewMode,
    pageId,
    pageTag,
    byItemId,
    collapsedSectionIds,
    onToggleSectionCollapsed,
    openSwipeElementId,
    onOpenSwipeChange: setOpenSwipeElementId,
    onDelete: handleDelete,
    onExpandImage: (payload: { path: string; caption: string }) =>
      setExpandedImage(payload),
    onUpdateElementText,
    onUpdateMapPlaces,
    onUpdateElementItems,
    onSetListStyle,
    removeNoteForItem: editable ? removeNoteForItem : undefined,
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

        const deleteHint =
          editable &&
          (element.type === "map" || element.type === "review")
            ? removeNoteForElement(
                (element.items ?? []).map((item) => item.id),
              )
            : null;

        const row = editable ? (
          <SortableRow
            element={element}
            {...rowProps}
            commentCount={countByElementId.get(element.id) ?? 0}
            deleteHint={deleteHint}
          />
        ) : (
          <StaticRow
            element={element}
            {...rowProps}
            commentCount={countByElementId.get(element.id) ?? 0}
          />
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
