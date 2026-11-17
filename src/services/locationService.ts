import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { AttendanceLocation } from '../types';

export async function getCurrentAttendanceLocation(): Promise<{
  success: boolean;
  location?: AttendanceLocation;
  error?: string;
}> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return {
        success: false,
        error: 'Location permission is required for attendance check-in and check-out.',
      };
    }

    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    // Check for mock GPS on Android
    const isMocked = position.mocked === true;

    let address = 'Lat: ' + position.coords.latitude.toFixed(4) + ', Lng: ' + position.coords.longitude.toFixed(4);
    try {
      const reverse = await Location.reverseGeocodeAsync({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });

      if (reverse && reverse.length > 0) {
        const place = reverse[0];
        const parts = [place.name, place.street, place.district, place.city, place.region].filter(Boolean);
        if (parts.length > 0) {
          address = parts.join(', ');
        }
      }
    } catch {
      // Reverse geocode fallback
    }

    return {
      success: true,
      location: {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        address,
        isMocked,
      },
    };
  } catch (err: any) {
    // Web preview has no real GPS; on a phone a failed fix must block the punch.
    if (Platform.OS === 'web') {
      return {
        success: true,
        location: { latitude: 28.6139, longitude: 77.209, address: 'Web preview (no GPS)', isMocked: false },
      };
    }
    return {
      success: false,
      error: 'Could not get your GPS location. Turn on Location, move near a window or outdoors, and try again.',
    };
  }
}
