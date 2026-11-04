import { useEffect, useMemo, useState } from "react";

import { readImageMetadata } from "../../lib/images.js";
import { Button } from "../Button.js";
import { Dialog } from "../Dialog.js";
import { ImagePicker } from "../ImagePicker.js";

export type AddImageItem = {
  id: string;
  file: File;
  previewUrl: string;
  caption: string;
  takenAt: number;
  taken_at: string;
  latitude: number | null;
  longitude: number | null;
};

type AddImageDialogProps = {
  open: boolean;
  onClose: () => void;
  submitting: boolean;
  onSubmit: (items: AddImageItem[]) => void;
};

function sortByTakenAt(items: AddImageItem[]): AddImageItem[] {
  return [...items].sort((a, b) => a.takenAt - b.takenAt);
}

export function AddImageDialog({
  open,
  onClose,
  submitting,
  onSubmit,
}: AddImageDialogProps) {
  const [items, setItems] = useState<AddImageItem[]>([]);

  const sortedItems = useMemo(() => sortByTakenAt(items), [items]);

  function revokeAll(nextItems: AddImageItem[]) {
    for (const item of nextItems) {
      URL.revokeObjectURL(item.previewUrl);
    }
  }

  function reset() {
    revokeAll(items);
    setItems([]);
  }

  useEffect(() => {
    if (!open) {
      reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function handleClose() {
    reset();
    onClose();
  }

  async function handlePick(files: File[]) {
    const nextItems = await Promise.all(
      files.map(async (file) => {
        const meta = await readImageMetadata(file);
        const takenAt = new Date(meta.taken_at).getTime();
        return {
          id: crypto.randomUUID(),
          file,
          previewUrl: URL.createObjectURL(file),
          caption: "",
          takenAt,
          taken_at: meta.taken_at,
          latitude: meta.latitude ?? null,
          longitude: meta.longitude ?? null,
        };
      }),
    );

    setItems((previous) => sortByTakenAt([...previous, ...nextItems]));
  }

  function setCaption(id: string, caption: string) {
    setItems((previous) =>
      previous.map((item) => (item.id === id ? { ...item, caption } : item)),
    );
  }

  const count = sortedItems.length;
  const rowHeightClass = "h-16";

  return (
    <Dialog open={open} onClose={handleClose}>
      <div className="space-y-4">
        <ImagePicker
          multiple
          compact={count > 0}
          className={count > 0 ? rowHeightClass : undefined}
          onPick={(files: File[]) => void handlePick(files)}
        />

        {count > 0 ? (
          <div className="max-h-60 space-y-3 overflow-y-auto pr-1">
            {sortedItems.map((item) => (
              <div key={item.id} className="flex gap-3">
                <img
                  src={item.previewUrl}
                  alt=""
                  className={`${rowHeightClass} w-16 shrink-0 rounded-xs object-cover`}
                />
                <label
                  className={`flex ${rowHeightClass} min-w-0 flex-1 flex-col gap-1`}
                >
                  <span className="text-muted text-xs font-medium leading-none">
                    Caption
                  </span>
                  <input
                    type="text"
                    value={item.caption}
                    onChange={(event) =>
                      setCaption(item.id, event.target.value)
                    }
                    maxLength={500}
                    className="bg-surface text-foreground min-h-0 flex-1 rounded-xs px-3 py-2 text-base outline-none placeholder:text-muted"
                  />
                </label>
              </div>
            ))}
          </div>
        ) : null}

        <Button
          type="button"
          variant="primary"
          width="full"
          disabled={count === 0 || submitting}
          onClick={() => onSubmit(sortedItems)}
        >
          {submitting
            ? "Adding"
            : count === 1
              ? "Add image"
              : `Add ${count} images`}
        </Button>
      </div>
    </Dialog>
  );
}
