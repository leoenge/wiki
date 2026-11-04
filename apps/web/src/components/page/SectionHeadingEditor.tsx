import type { PageElement } from "@ww/types";
import { useEffect, useRef, useState } from "react";

type SectionHeadingEditorProps = {
  element: PageElement;
  editable: boolean;
  onTextChange?: (elementId: string, text: string) => void;
};

export function SectionHeadingEditor({
  element,
  editable,
  onTextChange,
}: SectionHeadingEditorProps) {
  const [text, setText] = useState(element.text ?? "");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef(text);

  useEffect(() => {
    setText(element.text ?? "");
    latestRef.current = element.text ?? "";
  }, [element.id, element.text]);

  function clearScheduledSave() {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }

  function persist(value: string) {
    if (value === (element.text ?? "")) {
      return;
    }

    onTextChange?.(element.id, value);
  }

  function scheduleSave(value: string) {
    latestRef.current = value;
    clearScheduledSave();
    timeoutRef.current = setTimeout(() => {
      persist(value);
    }, 800);
  }

  useEffect(() => {
    return () => {
      clearScheduledSave();
      persist(latestRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [element.id]);

  if (!editable) {
    return (
      <h2 className="font-serif text-2xl tracking-tight py-1">
        {element.text?.trim() || "Untitled section"}
      </h2>
    );
  }

  return (
    <input
      type="text"
      value={text}
      onChange={(event) => {
        const value = event.target.value;
        setText(value);
        scheduleSave(value);
      }}
      onBlur={() => {
        clearScheduledSave();
        persist(latestRef.current);
      }}
      placeholder="Section title"
      className="font-serif text-foreground w-full min-w-0 bg-transparent text-2xl tracking-tight outline-none placeholder:text-muted"
    />
  );
}
