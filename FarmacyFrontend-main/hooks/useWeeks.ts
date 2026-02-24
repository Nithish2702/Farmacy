import { useState, useEffect, useCallback, useRef } from 'react';
import { cropService, Week } from '@/api/cropService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';

interface UseWeeksProps {
  cropId: string | null;
}

interface UseWeeksReturn {
  weeks: Week[];
  currentWeek: Week | null;
  selectedWeek: number;
  loading: boolean;
  error: string | null;
  setSelectedWeek: (weekNumber: number) => void;
  fetchWeeks: () => Promise<void>;
}

// Cache configuration
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
const CACHE_KEY_PREFIX = 'crop_weeks_';

export const useWeeks = ({ cropId }: UseWeeksProps): UseWeeksReturn => {
  const { language } = useAuth();
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [currentWeek, setCurrentWeek] = useState<Week | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const lastFetchRef = useRef<{ [key: string]: number }>({});
  const lastLanguageRef = useRef<string | null>(null);
  const isMountedRef = useRef(true);

  // Cache utilities
  const getCacheKey = useCallback((id: string) => `${CACHE_KEY_PREFIX}${id}`, []);

  const saveToCache = useCallback(async (id: string, data: Week[]) => {
    try {
      const cacheData = {
        timestamp: Date.now(),
        weeks: data
      };
      await AsyncStorage.setItem(getCacheKey(id), JSON.stringify(cacheData));
      lastFetchRef.current[id] = Date.now();
    } catch (error) {
      console.error('Error saving weeks to cache:', error);
    }
  }, [getCacheKey]);

  const loadFromCache = useCallback(async (id: string): Promise<Week[] | null> => {
    try {
      const cached = await AsyncStorage.getItem(getCacheKey(id));
      if (cached) {
        const { timestamp, weeks } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_DURATION) {
          lastFetchRef.current[id] = timestamp;
          return weeks;
        }
      }
      return null;
    } catch (error) {
      console.error('Error loading weeks from cache:', error);
      return null;
    }
  }, [getCacheKey]);

  const fetchWeeks = useCallback(async (forceRefresh: boolean = false) => {
    if (!cropId || !isMountedRef.current) return;

    try {
      setLoading(true);
      setError(null);

      // Set a timeout to clear loading state if it gets stuck
      const loadingTimeout = setTimeout(() => {
        if (isMountedRef.current) {
          setLoading(false);
          console.warn('[useWeeks] Loading timeout, clearing state');
        }
      }, 30000); // 30 second timeout

      const numericCropId = parseInt(cropId, 10);
      if (isNaN(numericCropId)) {
        throw new Error('Invalid crop ID');
      }

      // Check if we have recently fetched this data and not forcing refresh
      const lastFetch = lastFetchRef.current[cropId];
      if (!forceRefresh && lastFetch && Date.now() - lastFetch < CACHE_DURATION) {
        clearTimeout(loadingTimeout);
        return;
      }

      // Try to load from cache first if not forcing refresh
      if (!forceRefresh) {
        const cachedWeeks = await loadFromCache(cropId);
        if (cachedWeeks) {
          setWeeks(cachedWeeks);
          const currentWeekData = cachedWeeks.find(w => w.week_number === selectedWeek);
          setCurrentWeek(currentWeekData || null);
          clearTimeout(loadingTimeout);
          return;
        }
      }

      // If not in cache or expired, fetch from API
      const weeksData = await cropService.getCropWeeks(numericCropId, forceRefresh);
      
      if (weeksData && Array.isArray(weeksData)) {
        setWeeks(weeksData);
        // Set current week based on selected week number
        const currentWeekData = weeksData.find(w => w.week_number === selectedWeek);
        setCurrentWeek(currentWeekData || null);
        // Save to cache
        await saveToCache(cropId, weeksData);
      } else {
        throw new Error('Invalid weeks data received');
      }

      clearTimeout(loadingTimeout);
    } catch (err: any) {
      console.error('Error fetching weeks:', err);
      const errorMessage = err?.response?.data?.detail || err?.message || 'Failed to load week data';
      setError(errorMessage);
      setWeeks([]);
      setCurrentWeek(null);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [cropId, selectedWeek, loadFromCache, saveToCache]);

  // Fetch weeks when cropId changes
  useEffect(() => {
    if (cropId) {
      fetchWeeks();
    } else {
      setWeeks([]);
      setCurrentWeek(null);
    }
  }, [cropId]); // Remove fetchWeeks dependency to prevent infinite loops

  // Update current week when selected week changes
  useEffect(() => {
    const weekData = weeks.find(w => w.week_number === selectedWeek);
    setCurrentWeek(weekData || null);
  }, [selectedWeek, weeks]);

  // Handle language changes with proper dependency management
  useEffect(() => {
    if (language && lastLanguageRef.current !== language && cropId) {
      console.log(`[useWeeks] Language changed from ${lastLanguageRef.current} to ${language}, clearing cache for crop ${cropId}`);
      lastLanguageRef.current = language;
      
      const clearCacheAndRefetch = async () => {
        try {
          await AsyncStorage.removeItem(getCacheKey(cropId));
          lastFetchRef.current = {};
          // Force refresh when language changes
          await fetchWeeks(true);
        } catch (error) {
          console.error('Error clearing cache:', error);
        }
      };
      
      clearCacheAndRefetch();
    }
  }, [language, cropId, getCacheKey]); // Remove fetchWeeks dependency

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return {
    weeks,
    currentWeek,
    selectedWeek,
    loading,
    error,
    setSelectedWeek,
    fetchWeeks
  };
}; 