import { XIcon } from "@phosphor-icons/react";
import { useEffect } from "react";
import { createPortal } from "react-dom";

import { useImageUrl } from "../../lib/useImageUrl.js";

type ExpandedImageViewerProps = {
  open: boolean;
  onClose: () => void;
  imagePath: string | null;
  caption: string;
  contributorName: string;
};

export function ExpandedImageViewer({
  open,
  onClose,
  imagePath,
  caption,
  contributorName,
}: ExpandedImageViewerProps) {
  const urlQuery = useImageUrl(open ? imagePath : null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open || !imagePath) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex h-[100dvh] flex-col bg-black text-white">
      <header className="shrink-0 px-4 pt-4">
        <button
          type="button"
          onClick={onClose}
          className="p-1 text-white/90 hover:text-white"
          aria-label="Close"
        >
          <XIcon size={28} weight="regular" />
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 items-center justify-center">
          {urlQuery.data ? (
            <img
              src={urlQuery.data}
              alt=""
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <div className="size-48 animate-pulse bg-white/10" />
          )}
        </div>

        {caption.trim() ? (
          <div className="shrink-0 px-5 pb-4">
            <p className="text-base leading-relaxed text-white/95">{caption}</p>
          </div>
        ) : null}
      </div>

      <footer className="shrink-0 px-5 pb-8">
        <p className="text-sm text-white/65">{contributorName}</p>
      </footer>
    </div>,
    document.body,
  );
}
