import { APIProvider } from "@vis.gl/react-google-maps";
import { useState } from "react";

import { parseMapPlaces, type PageElement } from "@ww/types";

import { readGoogleMapsConfig } from "../../lib/googleMaps.js";
import { MapPlaceCard } from "./MapPlaceCard.js";
import { PageMapCanvas } from "./PageMapCanvas.js";

type MapElementViewProps = {
  element: PageElement;
};

function MapElementViewContent({
  element,
  mapId,
}: MapElementViewProps & { mapId: string }) {
  const places = parseMapPlaces(element.places);
  const [focusPlaceId, setFocusPlaceId] = useState<string | null>(null);

  if (places.length === 0) {
    return (
      <p className="text-muted py-2 text-sm">No places on this map yet.</p>
    );
  }

  return (
    <div className="space-y-4 py-2">
      <PageMapCanvas
        mapId={mapId}
        places={places}
        focusPlaceId={focusPlaceId}
        onMarkerClick={setFocusPlaceId}
      />
      <div>
        {places.map((place) => (
          <MapPlaceCard
            key={place.id}
            place={place}
            highlighted={focusPlaceId === place.id}
            onSelect={() => setFocusPlaceId(place.id)}
          />
        ))}
      </div>
    </div>
  );
}

export function MapElementView({ element }: MapElementViewProps) {
  const config = readGoogleMapsConfig();

  if (!config) {
    return null;
  }

  return (
    <APIProvider apiKey={config.apiKey} region="SE">
      <MapElementViewContent element={element} mapId={config.mapId} />
    </APIProvider>
  );
}
