import {
  AdvancedMarker,
  Map,
  useMap,
} from "@vis.gl/react-google-maps";
import { useEffect } from "react";

import type { MapPlace } from "@ww/types";

import {
  DEFAULT_MAP_CENTER,
  PAGE_MAP_DEFAULT_ZOOM,
} from "../../lib/googleMaps.js";

type PageMapCanvasProps = {
  mapId: string;
  places: MapPlace[];
  focusPlaceId?: string | null;
  onMarkerClick?: (placeId: string) => void;
  className?: string;
};

function FocusMapOnPlace({
  places,
  focusPlaceId,
}: {
  places: MapPlace[];
  focusPlaceId?: string | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map || !focusPlaceId) {
      return;
    }

    const place = places.find((entry) => entry.id === focusPlaceId);
    if (!place) {
      return;
    }

    map.panTo({ lat: place.lat, lng: place.lng });
  }, [focusPlaceId, map, places]);

  return null;
}

function FitMapToPlaces({ places }: { places: MapPlace[] }) {
  const map = useMap();

  useEffect(() => {
    if (!map) {
      return;
    }

    if (places.length === 0) {
      map.setCenter(DEFAULT_MAP_CENTER);
      map.setZoom(PAGE_MAP_DEFAULT_ZOOM);
      return;
    }

    if (places.length === 1) {
      map.setCenter({ lat: places[0].lat, lng: places[0].lng });
      map.setZoom(14);
      return;
    }

    const bounds = new google.maps.LatLngBounds();
    for (const place of places) {
      bounds.extend({ lat: place.lat, lng: place.lng });
    }
    map.fitBounds(bounds, 48);
  }, [map, places]);

  return null;
}

export function PageMapCanvas({
  mapId,
  places,
  focusPlaceId,
  onMarkerClick,
  className,
}: PageMapCanvasProps) {
  const defaultCenter =
    places.length > 0
      ? { lat: places[0].lat, lng: places[0].lng }
      : DEFAULT_MAP_CENTER;

  return (
    <div
      className={[
        "aspect-[32/25] w-full overflow-hidden rounded-xl bg-surface",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <Map
        mapId={mapId}
        defaultCenter={defaultCenter}
        defaultZoom={PAGE_MAP_DEFAULT_ZOOM}
        gestureHandling="cooperative"
        mapTypeControl={false}
        streetViewControl={false}
        fullscreenControl={false}
        className="size-full"
      >
        <FitMapToPlaces places={places} />
        <FocusMapOnPlace places={places} focusPlaceId={focusPlaceId} />
        {places.map((place) => (
          <AdvancedMarker
            key={place.id}
            position={{ lat: place.lat, lng: place.lng }}
            title={place.name}
            onClick={
              onMarkerClick
                ? (event) => {
                    event.stopPropagation();
                    onMarkerClick(place.id);
                  }
                : undefined
            }
          />
        ))}
      </Map>
    </div>
  );
}
