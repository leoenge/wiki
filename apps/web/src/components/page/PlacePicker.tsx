import { useMapsLibrary } from "@vis.gl/react-google-maps";
import { useEffect, useRef, useState } from "react";

import type { MapPlace } from "@ww/types";

export type PendingMapPlace = Omit<MapPlace, "id">;

type PlacePickerProps = {
  onAdd: (place: PendingMapPlace) => void;
};

export function PlacePicker({ onAdd }: PlacePickerProps) {
  const places = useMapsLibrary("places");
  const containerRef = useRef<HTMLDivElement>(null);
  const autocompleteRef = useRef<google.maps.places.PlaceAutocompleteElement | null>(
    null,
  );
  const onAddRef = useRef(onAdd);
  const [lookupError, setLookupError] = useState(false);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    onAddRef.current = onAdd;
  }, [onAdd]);

  useEffect(() => {
    if (!places || !containerRef.current) {
      return;
    }

    const autocomplete = new places.PlaceAutocompleteElement({
      includedRegionCodes: ["se"],
      requestedLanguage: "en",
      requestedRegion: "se",
    });
    autocomplete.placeholder = "Search for a place";
    autocomplete.classList.add("page-map-place-autocomplete");
    autocomplete.setAttribute("aria-label", "Search for a place");

    const handleInput = () => {
      setLookupError(false);
    };

    const handleSelect: EventListener = async (rawEvent) => {
      const selectEvent =
        rawEvent as google.maps.places.PlacePredictionSelectEvent;
      const place = selectEvent.placePrediction.toPlace();
      setResolving(true);
      setLookupError(false);

      try {
        await place.fetchFields({
          fields: ["id", "displayName", "formattedAddress", "location"],
        });

        if (!place.id || !place.location) {
          throw new Error("Selected place has no location");
        }

        const position = place.location.toJSON();
        const displayName = place.displayName;
        const name =
          typeof displayName === "string"
            ? displayName
            : (displayName as { text?: string } | null | undefined)?.text ??
              autocomplete.value;

        onAddRef.current({
          google_place_id: place.id,
          name,
          address: place.formattedAddress ?? null,
          lat: position.lat,
          lng: position.lng,
        });

        autocomplete.value = "";
      } catch {
        setLookupError(true);
      } finally {
        setResolving(false);
      }
    };

    autocomplete.addEventListener("input", handleInput);
    autocomplete.addEventListener("gmp-select", handleSelect);
    containerRef.current.replaceChildren(autocomplete);
    autocompleteRef.current = autocomplete;

    return () => {
      autocomplete.removeEventListener("input", handleInput);
      autocomplete.removeEventListener("gmp-select", handleSelect);
      autocomplete.remove();
      autocompleteRef.current = null;
    };
  }, [places]);

  return (
    <div className="space-y-3">
      <div ref={containerRef} className="relative z-20" />
      {lookupError ? (
        <p className="text-sm text-red-600">Could not load that place. Try again.</p>
      ) : null}
      {resolving ? <p className="text-muted text-sm">Adding place…</p> : null}
    </div>
  );
}
