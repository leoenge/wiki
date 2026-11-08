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
import { DotsSixVerticalIcon, PlusIcon, XIcon } from "@phosphor-icons/react";
import { useState } from "react";

import type { DraftElementItem } from "@ww/types";

import { Button } from "../Button.js";

type ItemListEditorProps = {
  items: DraftElementItem[];
  onChange: (items: DraftElementItem[]) => void;
  placeholder: string;
  maxItems: number;
  maxLabelLength: number;
  removeNoteForItem?: (itemId: string) => string | null;
};

function SortableItemRow({
  item,
  removeNote,
  onRemove,
}: {
  item: DraftElementItem;
  removeNote: string | null;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <span
      ref={setNodeRef}
      style={style}
      className={`flex items-start gap-2 py-2 ${isDragging ? "opacity-80" : ""}`}
    >
      <button
        type="button"
        className="text-muted hover:text-foreground mt-0.5 shrink-0 touch-none cursor-grab active:cursor-grabbing"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <DotsSixVerticalIcon size={16} weight="bold" />
      </button>
      <span className="min-w-0 flex-1 text-base leading-relaxed">{item.label}</span>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <button
          type="button"
          onClick={onRemove}
          className="text-muted hover:text-foreground p-1"
          aria-label="Remove item"
          data-swipe-exclude
        >
          <XIcon size={18} weight="bold" />
        </button>
        {removeNote ? (
          <p className="text-muted max-w-48 text-right text-xs leading-snug">
            {removeNote}
          </p>
        ) : null}
      </div>
    </span>
  );
}

export function ItemListEditor({
  items,
  onChange,
  placeholder,
  maxItems,
  maxLabelLength,
  removeNoteForItem,
}: ItemListEditorProps) {
  const [value, setValue] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function addItem() {
    const trimmed = value.trim();
    if (!trimmed || items.length >= maxItems) {
      return;
    }
    const label = trimmed.slice(0, maxLabelLength);
    onChange([
      ...items,
      { id: crypto.randomUUID(), label, data: {} },
    ]);
    setValue("");
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }
    const oldIndex = items.findIndex((item) => item.id === active.id);
    const newIndex = items.findIndex((item) => item.id === over.id);
    if (oldIndex < 0 || newIndex < 0) {
      return;
    }
    onChange(arrayMove(items, oldIndex, newIndex));
  }

  return (
    <div className="space-y-3 py-2">
      {items.length > 0 ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <SortableContext
            items={items.map((item) => item.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex flex-col">
              {items.map((item) => (
                <SortableItemRow
                  key={item.id}
                  item={item}
                  removeNote={removeNoteForItem?.(item.id) ?? null}
                  onRemove={() =>
                    onChange(items.filter((row) => row.id !== item.id))
                  }
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : null}

      {items.length < maxItems ? (
        <div className="flex gap-2">
          <input
            type="text"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addItem();
              }
            }}
            placeholder={placeholder}
            maxLength={maxLabelLength}
            className="bg-surface text-foreground placeholder:text-muted min-w-0 flex-1 rounded-xs px-3 py-2.5 text-base outline-none"
          />
          <Button
            type="button"
            variant="secondary"
            onClick={addItem}
            disabled={!value.trim()}
            aria-label="Add item"
          >
            <PlusIcon size={20} weight="bold" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
