import { Linking, Platform } from 'react-native';
import { isHttpUrl } from './format';

/** External navigation deep links (PRD: no proprietary navigation engine). */
export function mapsUrl(lat: number, lng: number, label?: string) {
  const q = encodeURIComponent(label ? `${label}` : `${lat},${lng}`);
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}&query_place_id=&q=${q}`;
}
export function directionsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}
export async function openUrl(url: string | null | undefined) {
  if (!isHttpUrl(url)) return false;
  try {
    if (Platform.OS === 'web') {
      window.open(url as string, '_blank', 'noopener');
      return true;
    }
    await Linking.openURL(url as string);
    return true;
  } catch {
    return false;
  }
}
export const openMap = (lat: number | null, lng: number | null, label?: string) =>
  lat != null && lng != null ? openUrl(mapsUrl(lat, lng, label)) : Promise.resolve(false);
export const openDirections = (lat: number | null, lng: number | null) =>
  lat != null && lng != null ? openUrl(directionsUrl(lat, lng)) : Promise.resolve(false);
