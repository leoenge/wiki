import { XIcon } from "@phosphor-icons/react";

import type { MapPlace } from "@ww/types";

type MapPlaceCardProps = {
  place: MapPlace;
  editable?: boolean;
  highlighted?: boolean;
  onSelect?: () => void;
  onRemove?: () => void;
};

export function MapPlaceCard({
  place,
  editable = false,
  highlighted = false,
  onSelect,
  onRemove,
}: MapPlaceCardProps) {
  const content = (
    <>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="font-serif text-base leading-snug">{place.name}</p>
        {place.address ? (
          <p className="text-muted text-sm leading-snug">{place.address}</p>
        ) : null}
      </div>
      {editable && onRemove ? (
        <button
          type="button"
          data-swipe-exclude
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
          className="text-muted hover:text-foreground shrink-0 p-1"
          aria-label={`Remove ${place.name}`}
        >
          <XIcon size={18} weight="bold" />
        </button>
      ) : null}
    </>
  );

  if (onSelect) {
    return (
      <button
        type="button"
        data-swipe-exclude
        onClick={onSelect}
        className={[
          "flex w-full items-start gap-2 py-1.5 text-left transition-colors",
          highlighted ? "bg-surface/80 -mx-3 px-3 rounded-lg" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {content}
      </button>
    );
  }

  return (
    <div
      className={[
        "flex items-start gap-2 py-1.5",
        highlighted ? "bg-surface/80 -mx-3 px-3 rounded-lg" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {content}
    </div>
  );
}
