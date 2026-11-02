import type { PageElement } from "@ww/types";
import { useEffect, useRef, useState } from "react";

import { useUpdateElement } from "../../api/elements.js";
import { useAuth } from "../../lib/auth/AuthProvider.js";

type SectionHeadingEditorProps = {
  pageId: string;
  element: PageElement;
};

export function SectionHeadingEditor({
  pageId,
  element,
}: SectionHeadingEditorProps) {
  const { accessToken } = useAuth();
  const updateElement = useUpdateElement(accessToken);
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

  async function persist(value: string) {
    if (value === (element.text ?? "")) {
      return;
    }

    try {
      await updateElement.mutateAsync({
        pageId,
        elementId: element.id,
        body: { text: value },
      });
    } catch {
      // keep local value
    }
  }

  function scheduleSave(value: string) {
    latestRef.current = value;
    clearScheduledSave();
    timeoutRef.current = setTimeout(() => {
      void persist(value);
    }, 800);
  }

  useEffect(() => {
    return () => {
      clearScheduledSave();
      void persist(latestRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [element.id]);

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
        void persist(latestRef.current);
      }}
      placeholder="Section title"
      className="font-serif text-foreground w-full min-w-0 bg-transparent text-2xl tracking-tight outline-none placeholder:text-muted"
    />
  );
}
