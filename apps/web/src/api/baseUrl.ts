/**
 * Origin of the API server. Empty in dev, where Vite proxies `/api` on the same origin.
 * Set `VITE_API_BASE_URL` at build time (see `.env.production`) to call a separate host.
 */
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");

export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}
