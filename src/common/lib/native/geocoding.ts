import { reverseGeocodeAsync } from 'expo-location';

export async function reverseGeocodeArea(point: { latitude: number; longitude: number }) {
  const [address] = await reverseGeocodeAsync(point);
  return address ? { district: address.district, city: address.city, region: address.region } : null;
}
