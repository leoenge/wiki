import type { PageElement } from "@ww/types";
import { useEffect, useRef, useState } from "react";

import { useUpdateElement } from "../../api/elements.js";
import { useAuth } from "../../lib/auth/AuthProvider.js";

type TextElementEditorProps = {
  pageId: string;
  element: PageElement;
};

export function TextElementEditor({ pageId, element }: TextElementEditorProps) {
  const { accessToken } = useAuth();
  const updateElement = useUpdateElement(accessToken);
  const [text, setText] = useState(element.text ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef(text);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function adjustHeight() {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }

  useEffect(() => {
    setText(element.text ?? "");
    latestRef.current = element.text ?? "";
  }, [element.id, element.text]);

  useEffect(() => {
    adjustHeight();
  }, [text]);

  function clearScheduledSave() {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }

  async function persist(value: string) {
    if (value === (element.text ?? "")) {
      setStatus("idle");
      return;
    }

    setStatus("saving");
    try {
      await updateElement.mutateAsync({
        pageId,
        elementId: element.id,
        body: { text: value },
      });
      setStatus("saved");
    } catch {
      setStatus("idle");
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
    <div className="space-y-2">
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(event) => {
          const value = event.target.value;
          setText(value);
          setStatus("idle");
          scheduleSave(value);
        }}
        onBlur={() => {
          clearScheduledSave();
          void persist(latestRef.current);
        }}
        rows={1}
        placeholder="Write something"
        className="text-foreground w-full resize-none overflow-hidden rounded-lg py-3 text-base leading-normal outline-none placeholder:text-muted"
      />
    </div>
  );
}
