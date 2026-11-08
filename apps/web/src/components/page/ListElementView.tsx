import { listStyleSchema, type PageElementWithItems } from "@ww/types";

type ListElementViewProps = {
  element: PageElementWithItems;
};

export function ListElementView({ element }: ListElementViewProps) {
  const items = element.items ?? [];
  if (items.length === 0) {
    return null;
  }

  const style = listStyleSchema.safeParse(element.list_style ?? "bullet");
  const listStyle = style.success ? style.data : "bullet";

  const ListTag = listStyle === "numbered" ? "ol" : "ul";
  const listClass =
    listStyle === "numbered"
      ? "list-decimal pl-6"
      : "list-disc pl-6";

  return (
    <ListTag className={`space-y-2 py-2 text-base leading-relaxed ${listClass}`}>
      {items.map((item) => (
        <li key={item.id}>{item.label}</li>
      ))}
    </ListTag>
  );
}
