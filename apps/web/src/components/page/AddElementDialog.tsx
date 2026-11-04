import { ImageIcon, MapTrifoldIcon, RowsIcon, TextTIcon } from "@phosphor-icons/react";

import { Button } from "../Button.js";
import { Dialog } from "../Dialog.js";

type AddElementDialogProps = {
  open: boolean;
  onClose: () => void;
  onChooseImage: () => void;
  onChooseText: () => void;
  onChooseMap?: () => void;
  onChooseSection?: () => void;
  showSection?: boolean;
};

export function AddElementDialog({
  open,
  onClose,
  onChooseImage,
  onChooseText,
  onChooseMap,
  onChooseSection,
  showSection = true,
}: AddElementDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title="Choose element to add">
      <div className="space-y-3">
        {showSection && onChooseSection ? (
          <Button
            type="button"
            variant="secondary"
            width="full"
            className="justify-start gap-4 py-4"
            onClick={() => {
              onClose();
              onChooseSection();
            }}
          >
            <span className="bg-background flex size-12 shrink-0 items-center justify-center rounded-lg">
              <RowsIcon size={28} weight="duotone" />
            </span>
            <span className="text-lg font-medium">Section</span>
          </Button>
        ) : null}
        <Button
          type="button"
          variant="secondary"
          width="full"
          className="justify-start gap-4 py-4"
          onClick={() => {
            onClose();
            onChooseImage();
          }}
        >
          <span className="bg-background flex size-12 shrink-0 items-center justify-center rounded-lg">
            <ImageIcon size={28} weight="duotone" />
          </span>
          <span className="text-lg font-medium">Image</span>
        </Button>
        <Button
          type="button"
          variant="secondary"
          width="full"
          className="justify-start gap-4 py-4"
          onClick={() => {
            onClose();
            onChooseText();
          }}
        >
          <span className="bg-background flex size-12 shrink-0 items-center justify-center rounded-lg">
            <TextTIcon size={28} weight="duotone" />
          </span>
          <span className="text-lg font-medium">Text</span>
        </Button>
        {onChooseMap ? (
          <Button
            type="button"
            variant="secondary"
            width="full"
            className="justify-start gap-4 py-4"
            onClick={() => {
              onClose();
              onChooseMap();
            }}
          >
            <span className="bg-background flex size-12 shrink-0 items-center justify-center rounded-lg">
              <MapTrifoldIcon size={28} weight="duotone" />
            </span>
            <span className="text-lg font-medium">Map</span>
          </Button>
        ) : null}
      </div>
    </Dialog>
  );
}
