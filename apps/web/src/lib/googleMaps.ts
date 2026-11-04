export const PAGE_MAP_DEFAULT_ZOOM = 12;

export const DEFAULT_MAP_CENTER = { lat: 59.3293, lng: 18.0686 };

export type GoogleMapsConfig = {
  apiKey: string;
  mapId: string;
};

export function readGoogleMapsConfig(): GoogleMapsConfig | null {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim();
  const mapId = import.meta.env.VITE_GOOGLE_MAP_ID?.trim();

  if (!apiKey || !mapId) {
    return null;
  }

  return { apiKey, mapId };
}
