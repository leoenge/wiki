import type { PageElement } from "@ww/types";
import { useEffect, useRef, useState } from "react";

type TextElementEditorProps = {
  element: PageElement;
  editable: boolean;
  onTextChange?: (elementId: string, text: string) => void;
};

export function TextElementEditor({
  element,
  editable,
  onTextChange,
}: TextElementEditorProps) {
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

  function persist(value: string) {
    if (value === (element.text ?? "")) {
      setStatus("idle");
      return;
    }

    if (!onTextChange) {
      return;
    }

    setStatus("saving");
    onTextChange(element.id, value);
    setStatus("saved");
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
    const body = element.text?.trim();
    if (!body) {
      return null;
    }

    return (
      <p className="py-3 text-base leading-relaxed whitespace-pre-wrap">
        {body}
      </p>
    );
  }

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
          persist(latestRef.current);
        }}
        rows={1}
        placeholder="Write something"
        className="text-foreground w-full resize-none overflow-hidden rounded-lg py-3 text-base leading-normal outline-none placeholder:text-muted"
      />
      {status === "saving" ? (
        <p className="text-muted text-xs">Saving</p>
      ) : null}
    </div>
  );
}
