import { ImageSquare, Plus } from "@phosphor-icons/react";
import { type ChangeEvent, useRef } from "react";

type ImagePickerProps = {
  previewUrl?: string | null;
  onPick: (file: File) => void;
  className?: string;
  aspect?: "square" | "wide";
};

export function ImagePicker({
  previewUrl,
  onPick,
  className,
  aspect = "square",
}: ImagePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function onChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      onPick(file);
    }
    event.target.value = "";
  }

  const aspectClass = aspect === "square" ? "aspect-square" : "aspect-[4/3]";

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={onChange}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={[
          "bg-surface text-muted hover:text-foreground relative flex w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-lg",
          aspectClass,
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {previewUrl ? (
          <img
            src={previewUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <>
            <ImageSquare size={32} weight="duotone" />
            <span className="inline-flex items-center gap-1 text-sm font-medium">
              <Plus size={14} weight="bold" />
              Add
            </span>
          </>
        )}
      </button>
    </>
  );
}
