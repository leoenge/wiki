import { XIcon } from "@phosphor-icons/react";
import { type ReactNode, useEffect, useRef } from "react";

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
};

export function Dialog({ open, onClose, title, children }: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    if (open && !dialog.open) {
      dialog.showModal();
    }

    if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="bg-background rounded-lg shadow-lg"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) {
          onClose();
        }
      }}
    >
      <div className="p-4">
        <div className="mb-4 flex items-start gap-4">
          {title ? (
            <h2 className="font-serif flex-1 text-xl leading-snug">{title}</h2>
          ) : (
            <span className="flex-1" />
          )}
          <button
            type="button"
            onClick={onClose}
            className="text-muted hover:text-foreground shrink-0 p-1"
            aria-label="Close"
          >
            <XIcon size={20} weight="bold" />
          </button>
        </div>

        {children}
      </div>
    </dialog>
  );
}
