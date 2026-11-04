import { MagnifyingGlassIcon } from "@phosphor-icons/react";
import { useMapsLibrary } from "@vis.gl/react-google-maps";
import { useEffect, useRef, useState } from "react";

import type { MapPlace } from "@ww/types";

export type PendingMapPlace = Omit<MapPlace, "id">;

type PlacePickerProps = {
  onAdd: (place: PendingMapPlace) => void;
};

type SuggestionRow = {
  key: string;
  label: string;
  prediction: google.maps.places.PlacePrediction;
};

export function PlacePicker({ onAdd }: PlacePickerProps) {
  const placesLib = useMapsLibrary("places");
  const onAddRef = useRef(onAdd);
  const sessionTokenRef =
    useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const requestIdRef = useRef(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SuggestionRow[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [lookupError, setLookupError] = useState(false);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    onAddRef.current = onAdd;
  }, [onAdd]);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [menuOpen]);

  function ensureSessionToken(): google.maps.places.AutocompleteSessionToken {
    if (!placesLib) {
      throw new Error("Places library not loaded");
    }
    if (!sessionTokenRef.current) {
      sessionTokenRef.current = new placesLib.AutocompleteSessionToken();
    }
    return sessionTokenRef.current;
  }

  function rotateSessionToken() {
    if (!placesLib) {
      return;
    }
    sessionTokenRef.current = new placesLib.AutocompleteSessionToken();
  }

  useEffect(() => {
    if (!placesLib) {
      return;
    }

    const trimmed = query.trim();
    if (!trimmed) {
      setSuggestions([]);
      setMenuOpen(false);
      return;
    }

    const requestId = ++requestIdRef.current;
    const timeout = setTimeout(() => {
      void (async () => {
        try {
          const { suggestions: raw } =
            await placesLib.AutocompleteSuggestion.fetchAutocompleteSuggestions({
              input: trimmed,
              sessionToken: ensureSessionToken(),
              includedRegionCodes: ["se"],
              language: "en",
              region: "se",
            });

          if (requestId !== requestIdRef.current) {
            return;
          }

          const rows: SuggestionRow[] = [];
          for (const [index, suggestion] of raw.entries()) {
            const prediction = suggestion.placePrediction;
            if (!prediction) {
              continue;
            }
            rows.push({
              key: `${index}-${prediction.text.toString()}`,
              label: prediction.text.toString(),
              prediction,
            });
          }

          setSuggestions(rows);
          setMenuOpen(rows.length > 0);
        } catch {
          if (requestId === requestIdRef.current) {
            setSuggestions([]);
            setMenuOpen(false);
          }
        }
      })();
    }, 200);

    return () => clearTimeout(timeout);
  }, [placesLib, query]);

  async function selectPrediction(prediction: google.maps.places.PlacePrediction) {
    if (!placesLib) {
      return;
    }

    setResolving(true);
    setLookupError(false);
    setMenuOpen(false);
    setSuggestions([]);

    try {
      const place = prediction.toPlace();
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
            prediction.text.toString();

      onAddRef.current({
        google_place_id: place.id,
        name,
        address: place.formattedAddress ?? null,
        lat: position.lat,
        lng: position.lng,
      });

      setQuery("");
      rotateSessionToken();
    } catch {
      setLookupError(true);
    } finally {
      setResolving(false);
    }
  }

  return (
    <div ref={rootRef} className="space-y-3">
      <div className="relative">
        <MagnifyingGlassIcon
          size={18}
          weight="bold"
          className="text-muted pointer-events-none absolute top-1/2 left-4 -translate-y-1/2"
          aria-hidden
        />
        <input
          type="search"
          value={query}
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="Search for a place"
          aria-label="Search for a place"
          aria-expanded={menuOpen}
          aria-controls="map-place-suggestions"
          disabled={resolving || !placesLib}
          onChange={(event) => {
            setLookupError(false);
            setQuery(event.target.value);
          }}
          onFocus={() => {
            if (suggestions.length > 0) {
              setMenuOpen(true);
            }
          }}
          className="bg-background text-foreground placeholder:text-muted w-full rounded-xs py-3 pr-4 pl-11 text-base outline-none [color-scheme:light]"
        />

        {menuOpen && suggestions.length > 0 ? (
          <ul
            id="map-place-suggestions"
            role="listbox"
            className="bg-background absolute top-full right-0 left-0 z-30 mt-1 max-h-60 overflow-y-auto rounded-xs py-1 shadow-[0_4px_24px_rgba(0,0,0,0.12)]"
          >
            {suggestions.map((row) => (
              <li key={row.key} role="presentation">
                <button
                  type="button"
                  role="option"
                  data-swipe-exclude
                  className="text-foreground hover:bg-surface w-full px-4 py-2.5 text-left text-base"
                  onClick={() => void selectPrediction(row.prediction)}
                >
                  {row.label}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {lookupError ? (
        <p className="text-sm text-red-600">Could not load that place. Try again.</p>
      ) : null}
      {resolving ? <p className="text-muted text-sm">Adding place…</p> : null}
    </div>
  );
}
