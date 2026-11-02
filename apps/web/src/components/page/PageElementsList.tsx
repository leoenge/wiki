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
import { DotsSixVertical } from "@phosphor-icons/react";

import type { PageElement } from "@ww/types";

import { useReorderElements } from "../../api/elements.js";
import { StorageImage } from "../StorageImage.js";
import { TextElementEditor } from "./TextElementEditor.js";

type PageElementsListProps = {
  pageId: string;
  elements: PageElement[];
  accessToken: string | undefined;
};

function ImageElementRow({ element }: { element: PageElement }) {
  if (!element.image_path) {
    return null;
  }

  return (
    <div className="bg-surface/50 flex min-w-0 flex-1 gap-4 rounded-lg">
      <StorageImage
        path={element.image_path}
        className="size-32 shrink-0 rounded-lg object-cover"
      />
      <div className="py-2">
        <p className="text-base leading-relaxed">{element.caption ?? ""}</p>
      </div>
    </div>
  );
}

type SortablePageElementProps = {
  element: PageElement;
  pageId: string;
};

function SortablePageElement({ element, pageId }: SortablePageElementProps) {
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
      <div className="flex items-start gap-1 -ml-4">
        <button
          type="button"
          className="text-muted hover:text-foreground shrink-0 touch-none cursor-grab py-4 active:cursor-grabbing"
          aria-label="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          <DotsSixVertical size={22} weight="bold" />
        </button>
        <div className="min-w-0 flex-1">
          {element.type === "text" ? (
            <TextElementEditor pageId={pageId} element={element} />
          ) : (
            <ImageElementRow element={element} />
          )}
        </div>
      </div>
    </div>
  );
}

export function PageElementsList({
  pageId,
  elements,
  accessToken,
}: PageElementsListProps) {
  const reorderElements = useReorderElements(accessToken);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = elements.findIndex((element) => element.id === active.id);
    const newIndex = elements.findIndex((element) => element.id === over.id);
    if (oldIndex < 0 || newIndex < 0) {
      return;
    }

    const nextOrder = arrayMove(elements, oldIndex, newIndex);
    void reorderElements.mutate({
      pageId,
      body: { element_ids: nextOrder.map((element) => element.id) },
    });
  }

  if (elements.length === 0) {
    return null;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
    >
      <SortableContext
        items={elements.map((element) => element.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-6">
          {elements.map((element) => (
            <SortablePageElement
              key={element.id}
              element={element}
              pageId={pageId}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
