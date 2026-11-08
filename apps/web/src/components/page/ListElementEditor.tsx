import {
  MAX_LIST_ITEMS,
  listStyleSchema,
  type DraftElementItem,
  type ListStyle,
  type PageElementWithItems,
} from "@ww/types";

import { ItemListEditor } from "./ItemListEditor.js";

type ListElementEditorProps = {
  element: PageElementWithItems;
  onItemsChange: (elementId: string, items: DraftElementItem[]) => void;
  onListStyleChange: (elementId: string, style: ListStyle) => void;
  removeNoteForItem?: (itemId: string) => string | null;
};

function parseListStyle(value: string | null): ListStyle {
  const parsed = listStyleSchema.safeParse(value ?? "bullet");
  return parsed.success ? parsed.data : "bullet";
}

export function ListElementEditor({
  element,
  onItemsChange,
  onListStyleChange,
  removeNoteForItem,
}: ListElementEditorProps) {
  const style = parseListStyle(element.list_style);
  const items: DraftElementItem[] = (element.items ?? []).map((item) => ({
    id: item.id,
    label: item.label,
    data: item.data as Record<string, unknown>,
  }));

  return (
    <div className="space-y-4 py-2">
      <div className="flex gap-2">
        {(["bullet", "numbered"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onListStyleChange(element.id, option)}
            className={`rounded-xs px-4 py-2 text-sm font-medium capitalize ${
              style === option
                ? "bg-surface text-foreground"
                : "text-muted hover:text-foreground"
            }`}
          >
            {option === "bullet" ? "Bullet" : "Numbered"}
          </button>
        ))}
      </div>

      <ItemListEditor
        items={items}
        onChange={(next) => onItemsChange(element.id, next)}
        placeholder="List item"
        maxItems={MAX_LIST_ITEMS}
        maxLabelLength={2000}
        removeNoteForItem={removeNoteForItem}
      />
    </div>
  );
}
