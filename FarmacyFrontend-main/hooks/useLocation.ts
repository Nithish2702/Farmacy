import { useState, useCallback, useEffect, useRef } from 'react';
import { Platform, Alert, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Safe import with fallback
let Location: any = null;
try {
  Location = require('expo-location');
} catch (error) {
  console.warn('expo-location not available:', error);
}

const LOCATION_CACHE_KEY = 'cached_user_location';
const LOCATION_CACHE_EXPIRY = 30 * 60 * 1000; // 30 minutes

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export const useLocation = () => {
  const [location, setLocation] = useState<LocationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Protection against concurrent location requests
  const locationPromise = useRef<Promise<LocationData | null> | null>(null);
  const isInitialized = useRef(false);

  // Cache functions
  const saveLocationToCache = useCallback(async (locationData: LocationData) => {
    try {
      const cacheData = {
        location: locationData,
        timestamp: Date.now(),
      };
      await AsyncStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify(cacheData));
      // console.log('📍 Location saved to cache:', locationData);
    } catch (error) {
      console.error('📍 Failed to save location to cache:', error);
    }
  }, []);

  const loadLocationFromCache = useCallback(async (): Promise<LocationData | null> => {
    try {
      const cachedData = await AsyncStorage.getItem(LOCATION_CACHE_KEY);
      if (!cachedData) return null;

      const { location: cachedLocation, timestamp } = JSON.parse(cachedData);
      const isExpired = Date.now() - timestamp > LOCATION_CACHE_EXPIRY;

      if (isExpired) {
        console.log('📍 Cached location expired');
        await AsyncStorage.removeItem(LOCATION_CACHE_KEY);
        return null;
      }

      // console.log('📍 Loaded location from cache');
      return cachedLocation;
    } catch (error) {
      console.error('📍 Failed to load location from cache:', error);
      return null;
    }
  }, []);

  const getCurrentLocation = useCallback(async (forceRefresh = false): Promise<LocationData | null> => {
    // If there's already a location request in progress, return that promise
    if (locationPromise.current && !forceRefresh) {
      console.log('📍 Location request already in progress, returning existing promise');
      return locationPromise.current;
    }

    console.log('📍 Starting new location request (forceRefresh:', forceRefresh, ')');

    if (!Location) {
      console.error('📍 expo-location module not available');
      setError('Location services not available');
      setLoading(false);
      return null;
    }

    // Create the location request promise
    locationPromise.current = (async () => {
      setLoading(true);
      setError(null);

      try {
        // Try to load from cache first (unless force refresh)
        if (!forceRefresh) {
          const cachedLocation = await loadLocationFromCache();
          if (cachedLocation) {
            setLocation(cachedLocation);
            setLoading(false);
            return cachedLocation;
          }
        }

        // Check if location services are enabled
        const enabled = await Location.hasServicesEnabledAsync();
        console.log('📍 Location services enabled:', enabled);
        
        if (!enabled) {
          Alert.alert(
            'Location Services Disabled',
            'Please enable location services in your device settings to get accurate location data.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings() }
            ]
          );
          setError('Location services are disabled');
          setLoading(false);
          setLocation(null);
          return null;
        }

        // Request permission
        const { status } = await Location.requestForegroundPermissionsAsync();
        console.log('📍 Location permission status:', status);
        
        if (status !== 'granted') {
          Alert.alert(
            'Location Permission Required',
            'This app needs location access to provide accurate weather information and location-based features.',
            [
              {
                text: 'Cancel',
                style: 'cancel',
                onPress: () => {
                  setError('Location permission denied');
                  setLoading(false);
                  setLocation(null);
                }
              },
              {
                text: 'Open Settings',
                onPress: () => {
                  Linking.openSettings();
                  setError('Please enable location in settings');
                  setLoading(false);
                  setLocation(null);
                }
              }
            ]
          );
          return null;
        }

        // Get current location
        console.log('📍 Fetching current position...');
        const locationResult = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 20000, // 20 seconds timeout
          maximumAge: 60000, // Accept location up to 1 minute old
        });
        
        // console.log('📍 Location fetched successfully');

        const locationData: LocationData = {
          latitude: locationResult.coords.latitude,
          longitude: locationResult.coords.longitude,
          accuracy: locationResult.coords.accuracy || undefined,
        };

        // Save to cache
        await saveLocationToCache(locationData);

        setLocation(locationData);
        setLoading(false);
        return locationData;

      } catch (err: any) {
        console.error('📍 Location error:', err);
        setError(err.message || 'Failed to get location');
        setLoading(false);
        setLocation(null);
        return null;
      }
    })();

    // Wait for the promise to complete and then clear it
    try {
      const result = await locationPromise.current;
      return result;
    } finally {
      locationPromise.current = null;
      console.log('📍 Location request completed and promise cleared');
    }
  }, [loadLocationFromCache, saveLocationToCache]);

  // Initialize location on mount (only once)
  useEffect(() => {
    if (!isInitialized.current) {
      console.log('📍 Initializing location (first time)...');
      isInitialized.current = true;
      getCurrentLocation();
    }
  }, []); // Empty dependency array to run only once

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!Location) {
      setError('Location services not available');
      return false;
    }

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Error requesting location permission:', error);
      return false;
    }
  }, []);

  const checkPermission = useCallback(async (): Promise<boolean> => {
    if (!Location) {
      setError('Location services not available');
      return false;
    }

    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Error checking location permission:', error);
      return false;
    }
  }, []);

  return {
    location,
    loading,
    error: error as string | null,
    getCurrentLocation,
    requestPermission,
    checkPermission,
  };
}; 