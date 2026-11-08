import { PictureInPictureIcon } from "@phosphor-icons/react";

import { StorageImage } from "../StorageImage.js";

/** Default width of a standard Wikipedia thumbnail (`.thumbinner`). */
const DEFAULT_THUMB_WIDTH_PX = 220;

type WikiImageThumbProps = {
  path: string;
  caption: string;
  onExpand: () => void;
  widthPx?: number;
};

export function WikiImageThumb({
  path,
  caption,
  onExpand,
  widthPx = DEFAULT_THUMB_WIDTH_PX,
}: WikiImageThumbProps) {
  const captionText = caption.trim();

  return (
    <figure
      className="inline-block max-w-full"
      style={{ width: widthPx }}
    >
      <div className="border-wiki-thumb-border bg-wiki-thumb-bg border p-[3px]">
        <button
          type="button"
          onClick={onExpand}
          className="block w-full cursor-zoom-in border-0 bg-transparent p-0"
          aria-label="Expand image"
          data-swipe-exclude
        >
          <StorageImage
            path={path}
            className="border-wiki-thumb-border bg-background block w-full border"
          />
        </button>
        <figcaption className="flex items-end gap-1 px-[3px] pt-[3px] text-left text-[94%] leading-[1.4]">
          {captionText ? (
            <span className="min-w-0 flex-1">{captionText}</span>
          ) : (
            <span className="min-w-0 flex-1" aria-hidden />
          )}
          <button
            type="button"
            onClick={onExpand}
            className="text-wiki-thumb-muted hover:text-foreground shrink-0 cursor-pointer border-0 bg-transparent p-0 leading-none"
            aria-label="Expand image"
            data-swipe-exclude
          >
            <PictureInPictureIcon size={15} weight="regular" />
          </button>
        </figcaption>
      </div>
    </figure>
  );
}
