import { APIProvider } from "@vis.gl/react-google-maps";
import { useState } from "react";

import {
  mapPlacesFromItems,
  type MapPlace,
  type PageElementWithItems,
} from "@ww/types";

import { readGoogleMapsConfig } from "../../lib/googleMaps.js";
import { MapPlaceCard } from "./MapPlaceCard.js";
import { PageMapCanvas } from "./PageMapCanvas.js";
import { PlacePicker, type PendingMapPlace } from "./PlacePicker.js";

type MapElementEditorProps = {
  element: PageElementWithItems;
  onPlacesChange: (elementId: string, places: MapPlace[]) => void;
};

function MapElementEditorContent({
  element,
  mapId,
  onPlacesChange,
}: MapElementEditorProps & { mapId: string }) {
  const places = mapPlacesFromItems(element.items ?? []);
  const [focusPlaceId, setFocusPlaceId] = useState<string | null>(null);

  function addPlace(pending: PendingMapPlace) {
    onPlacesChange(element.id, [
      ...places,
      { ...pending, id: crypto.randomUUID() },
    ]);
  }

  function removePlace(placeId: string) {
    onPlacesChange(
      element.id,
      places.filter((place) => place.id !== placeId),
    );
    if (focusPlaceId === placeId) {
      setFocusPlaceId(null);
    }
  }

  return (
    <div className="space-y-4 py-2">
      <PageMapCanvas
        mapId={mapId}
        places={places}
        focusPlaceId={focusPlaceId}
        onMarkerClick={setFocusPlaceId}
      />

      {places.length > 0 ? (
        <div>
          {places.map((place) => (
            <MapPlaceCard
              key={place.id}
              place={place}
              editable
              highlighted={focusPlaceId === place.id}
              onSelect={() => setFocusPlaceId(place.id)}
              onRemove={() => removePlace(place.id)}
            />
          ))}
        </div>
      ) : null}

      <PlacePicker onAdd={addPlace} />
    </div>
  );
}

export function MapElementEditor({
  element,
  onPlacesChange,
}: MapElementEditorProps) {
  const config = readGoogleMapsConfig();

  if (!config) {
    return (
      <p className="text-muted py-2 text-sm">
        Add VITE_GOOGLE_MAPS_API_KEY and VITE_GOOGLE_MAP_ID to show maps.
      </p>
    );
  }

  return (
    <APIProvider apiKey={config.apiKey} region="SE">
      <MapElementEditorContent
        element={element}
        mapId={config.mapId}
        onPlacesChange={onPlacesChange}
      />
    </APIProvider>
  );
}
