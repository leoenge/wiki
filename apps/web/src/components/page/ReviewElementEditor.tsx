import { MAX_REVIEW_ITEMS, type DraftElementItem, type PageElementWithItems } from "@ww/types";

import { ItemListEditor } from "./ItemListEditor.js";

type ReviewElementEditorProps = {
  element: PageElementWithItems;
  onItemsChange: (elementId: string, items: DraftElementItem[]) => void;
  removeNoteForItem?: (itemId: string) => string | null;
};

export function ReviewElementEditor({
  element,
  onItemsChange,
  removeNoteForItem,
}: ReviewElementEditorProps) {
  const items: DraftElementItem[] = (element.items ?? []).map((item) => ({
    id: item.id,
    label: item.label,
    data: item.data as Record<string, unknown>,
  }));

  return (
    <ItemListEditor
      items={items}
      onChange={(next) => onItemsChange(element.id, next)}
      placeholder="Name to review"
      maxItems={MAX_REVIEW_ITEMS}
      maxLabelLength={200}
      removeNoteForItem={removeNoteForItem}
    />
  );
}
