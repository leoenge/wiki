import { APIProvider } from "@vis.gl/react-google-maps";
import { useState } from "react";

import { mapPlacesFromItems, type PageElementWithItems } from "@ww/types";

import { type ItemReviewSummary } from "../../api/reviews.js";
import { readGoogleMapsConfig } from "../../lib/googleMaps.js";
import { ItemReviews } from "./ItemReviews.js";
import { MapPlaceCard } from "./MapPlaceCard.js";
import { PageMapCanvas } from "./PageMapCanvas.js";

type MapElementViewProps = {
  element: PageElementWithItems;
  pageId?: string;
  byItemId?: Map<string, ItemReviewSummary>;
};

function MapElementViewContent({
  element,
  mapId,
  pageId,
  byItemId,
}: MapElementViewProps & { mapId: string }) {
  const places = mapPlacesFromItems(element.items ?? []);
  const [focusPlaceId, setFocusPlaceId] = useState<string | null>(null);
  const showReviews = Boolean(pageId && byItemId);

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
          <div key={place.id} className="py-1">
            <MapPlaceCard
              place={place}
              highlighted={focusPlaceId === place.id}
              onSelect={() => setFocusPlaceId(place.id)}
            />
            {showReviews ? (
              <ItemReviews
                pageId={pageId!}
                itemId={place.id}
                summary={byItemId!.get(place.id)}
              />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export function MapElementView({ element, pageId, byItemId }: MapElementViewProps) {
  const config = readGoogleMapsConfig();

  if (!config) {
    return null;
  }

  return (
    <APIProvider apiKey={config.apiKey} region="SE">
      <MapElementViewContent
        element={element}
        mapId={config.mapId}
        pageId={pageId}
        byItemId={byItemId}
      />
    </APIProvider>
  );
}
