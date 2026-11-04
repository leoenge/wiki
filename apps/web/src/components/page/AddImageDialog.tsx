import { useEffect, useMemo, useState } from "react";

import { XIcon } from "@phosphor-icons/react";

import { readImageMetadata } from "../../lib/images.js";
import { Button } from "../Button.js";
import { Dialog } from "../Dialog.js";
import { ImagePicker } from "../ImagePicker.js";
import { TextField } from "../TextField.js";

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

  function removeItem(id: string) {
    setItems((previous) => {
      const target = previous.find((item) => item.id === id);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return previous.filter((item) => item.id !== id);
    });
  }

  function setCaption(id: string, caption: string) {
    setItems((previous) =>
      previous.map((item) =>
        item.id === id ? { ...item, caption } : item,
      ),
    );
  }

  const count = sortedItems.length;

  return (
    <Dialog open={open} onClose={handleClose}>
      <div className="space-y-5">
        <ImagePicker
          multiple
          onPick={(files: File[]) => void handlePick(files)}
        />

        {count > 0 ? (
          <div className="max-h-72 space-y-4 overflow-y-auto pr-1">
            {sortedItems.map((item) => (
              <div key={item.id} className="flex items-start gap-3">
                <img
                  src={item.previewUrl}
                  alt=""
                  className="size-14 shrink-0 rounded-sm object-cover"
                />
                <TextField
                  label="Caption"
                  value={item.caption}
                  onChange={(event) => setCaption(item.id, event.target.value)}
                  maxLength={500}
                  className="min-w-0 flex-1"
                />
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  className="text-muted hover:text-foreground shrink-0 p-2"
                  aria-label="Remove image"
                >
                  <XIcon size={18} weight="bold" />
                </button>
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
