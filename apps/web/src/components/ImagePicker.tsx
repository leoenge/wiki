import { ImageSquareIcon, PlusIcon } from "@phosphor-icons/react";
import { type ChangeEvent, useRef } from "react";

type ImagePickerProps = {
  previewUrl?: string | null;
  onPick: (file: File) => void;
  className?: string;
  aspect?: "square" | "wide";
};

type ImagePickerMultipleProps = {
  multiple: true;
  onPick: (files: File[]) => void;
  className?: string;
  aspect?: "square" | "wide";
  compact?: boolean;
  previewUrl?: never;
};

export function ImagePicker(
  props: ImagePickerProps | ImagePickerMultipleProps,
) {
  const inputRef = useRef<HTMLInputElement>(null);
  const multiple = "multiple" in props && props.multiple;
  const compact = multiple && "compact" in props && props.compact;
  const aspect = props.aspect ?? "square";

  function onChange(event: ChangeEvent<HTMLInputElement>) {
    const fileList = event.target.files;
    if (!fileList?.length) {
      event.target.value = "";
      return;
    }

    if (multiple) {
      props.onPick(Array.from(fileList));
    } else if ("previewUrl" in props || !multiple) {
      const file = fileList[0];
      if (file) {
        (props as ImagePickerProps).onPick(file);
      }
    }
    event.target.value = "";
  }

  const aspectClass = aspect === "square" ? "aspect-square" : "aspect-[4/3]";
  const previewUrl =
    !multiple && "previewUrl" in props ? props.previewUrl : null;

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        multiple={multiple || undefined}
        onChange={onChange}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={[
          "bg-surface text-muted hover:text-foreground relative flex w-full overflow-hidden rounded-sm",
          ...(compact
            ? [
                "flex-row items-center justify-center gap-2",
                props.className ?? "h-14",
              ]
            : [
                "flex-col items-center justify-center gap-2",
                aspectClass,
                props.className,
              ]),
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
            <ImageSquareIcon size={compact ? 22 : 32} weight="duotone" />
            <span className="inline-flex items-center gap-1 text-sm font-medium">
              <PlusIcon size={14} weight="bold" />
              {multiple ? "Add photos" : "Add"}
            </span>
          </>
        )}
      </button>
    </>
  );
}
