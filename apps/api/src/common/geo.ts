export const GAZA_BOUNDS = { latMin: 31.2, latMax: 31.6, lngMin: 34.2, lngMax: 34.6 };

export function inGaza(lat: number, lng: number): boolean {
  return lat >= GAZA_BOUNDS.latMin && lat <= GAZA_BOUNDS.latMax && lng >= GAZA_BOUNDS.lngMin && lng <= GAZA_BOUNDS.lngMax;
}

/** Round coordinates for public display (~1 km) */
export function roundCoord(x: number): number {
  return Math.round(x * 100) / 100;
}
