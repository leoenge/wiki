import { useEffect, useState } from "react";

import { Button } from "../Button.js";
import { Dialog } from "../Dialog.js";
import { ImagePicker } from "../ImagePicker.js";
import { TextField } from "../TextField.js";

type AddImageDialogProps = {
  open: boolean;
  onClose: () => void;
  submitting: boolean;
  onSubmit: (payload: { file: File; caption: string }) => void;
};

export function AddImageDialog({
  open,
  onClose,
  submitting,
  onSubmit,
}: AddImageDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState("");

  function reset() {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setFile(null);
    setPreviewUrl(null);
    setCaption("");
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

  function handlePick(nextFile: File) {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setFile(nextFile);
    setPreviewUrl(URL.createObjectURL(nextFile));
  }

  return (
    <Dialog open={open} onClose={handleClose}>
      <div className="space-y-5">
        <ImagePicker previewUrl={previewUrl} onPick={handlePick} />
        <TextField
          label="Add caption"
          value={caption}
          onChange={(event) => setCaption(event.target.value)}
          maxLength={500}
        />
        <Button
          type="button"
          variant="primary"
          width="full"
          disabled={!file || submitting}
          onClick={() => {
            if (!file) {
              return;
            }
            onSubmit({ file, caption });
          }}
        >
          {submitting ? "Adding" : "Add"}
        </Button>
      </div>
    </Dialog>
  );
}
