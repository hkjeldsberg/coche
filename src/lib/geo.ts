export const OSLO = { lat: 59.9139, lon: 10.7522 };
/** Slider max; at this value the distance filter is off. */
export const DISTANCE_NO_LIMIT = 1000;

/** Straight-line (great-circle) distance in km. */
export function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export function distanceFromOslo(lat: number | null, lon: number | null): number | null {
  return lat == null || lon == null ? null : Math.round(distanceKm(OSLO, { lat, lon }));
}

/** Fylke + kommune for a WGS84 point via Kartverket (free, no key). */
export async function reverseGeocode(lat: number, lon: number): Promise<{ fylke: string; kommune: string } | null> {
  const url = `https://api.kartverket.no/kommuneinfo/v1/punkt?nord=${lat}&ost=${lon}&koordsys=4258`;
  const res = await fetch(url, { cache: "no-store" });
  if (res.status === 404) return null; // point outside Norway / at sea
  if (!res.ok) throw new Error(`Kartverket ${res.status}`);
  const j = (await res.json()) as { fylkesnavn?: string; kommunenavn?: string };
  return j.fylkesnavn ? { fylke: j.fylkesnavn, kommune: j.kommunenavn ?? "" } : null;
}
