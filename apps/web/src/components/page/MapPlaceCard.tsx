import { XIcon } from "@phosphor-icons/react";

import type { MapPlace } from "@ww/types";

type MapPlaceCardProps = {
  place: MapPlace;
  editable?: boolean;
  highlighted?: boolean;
  onSelect?: () => void;
  onRemove?: () => void;
  removeNote?: string | null;
};

const rowClass = (highlighted: boolean) =>
  [
    "flex w-full items-start gap-2 py-1.5",
    highlighted ? "bg-surface/80 -mx-3 px-3 rounded-lg" : "",
  ]
    .filter(Boolean)
    .join(" ");

export function MapPlaceCard({
  place,
  editable = false,
  highlighted = false,
  onSelect,
  onRemove,
  removeNote,
}: MapPlaceCardProps) {
  const placeDetails = (
    <div className="min-w-0 flex-1 space-y-0.5">
      <p className="font-serif text-base leading-snug">{place.name}</p>
      {place.address ? (
        <p className="text-muted text-sm leading-snug">{place.address}</p>
      ) : null}
    </div>
  );

  const removeControl =
    editable && onRemove ? (
      <div className="flex shrink-0 flex-col items-end gap-1">
        <button
          type="button"
          data-swipe-exclude
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
          className="text-muted hover:text-foreground p-1"
          aria-label={`Remove ${place.name}`}
        >
          <XIcon size={18} weight="bold" />
        </button>
        {removeNote ? (
          <p className="text-muted max-w-48 text-right text-xs leading-snug">
            {removeNote}
          </p>
        ) : null}
      </div>
    ) : null;

  if (onSelect && removeControl) {
    return (
      <div className={rowClass(highlighted)}>
        <button
          type="button"
          data-swipe-exclude
          onClick={onSelect}
          className="flex min-w-0 flex-1 items-start gap-2 text-left transition-colors"
        >
          {placeDetails}
        </button>
        {removeControl}
      </div>
    );
  }

  if (onSelect) {
    return (
      <button
        type="button"
        data-swipe-exclude
        onClick={onSelect}
        className={[
          rowClass(highlighted),
          "text-left transition-colors",
        ].join(" ")}
      >
        {placeDetails}
      </button>
    );
  }

  return (
    <div className={rowClass(highlighted)}>
      {placeDetails}
      {removeControl}
    </div>
  );
}
