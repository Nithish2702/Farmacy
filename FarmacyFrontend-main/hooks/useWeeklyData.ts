import { useState, useEffect, useCallback, useRef } from 'react';
import { useCrops } from './useCrops';
import { Week } from '@/api/cropService';

interface WeeklyDataState {
  weeks: Week[];
  loading: boolean;
  error: { message: string; code: string } | null;
}

export const useWeeklyData = (cropId?: number) => {
  const { loadCropWeeks, weeks, loading, error } = useCrops();
  const [weeklyData, setWeeklyData] = useState<WeeklyDataState>({
    weeks: [],
    loading: false,
    error: null
  });
  const lastCropIdRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);

  const fetchWeeklyData = useCallback(async (id: number, forceRefresh: boolean = false) => {
    if (!isMountedRef.current || lastCropIdRef.current === id && !forceRefresh) {
      return;
    }

    try {
      setWeeklyData(prev => ({ ...prev, loading: true, error: null }));
      lastCropIdRef.current = id;
      
      // Set a timeout to clear loading state if it gets stuck
      const loadingTimeout = setTimeout(() => {
        if (isMountedRef.current) {
          setWeeklyData(prev => ({ ...prev, loading: false }));
          console.warn('[useWeeklyData] Loading timeout, clearing state');
        }
      }, 30000); // 30 second timeout
      
      await loadCropWeeks(id, forceRefresh);
      
      if (isMountedRef.current) {
        setWeeklyData(prev => ({ ...prev, weeks, loading: false }));
      }
      
      clearTimeout(loadingTimeout);
    } catch (err: any) {
      if (isMountedRef.current) {
        setWeeklyData(prev => ({
          ...prev,
          loading: false,
          error: {
            message: err.message || 'Failed to load weekly data',
            code: 'FETCH_WEEKLY_DATA_ERROR'
          }
        }));
      }
    } finally {
      // Ensure loading is always set to false, even if the try-catch doesn't handle it
      if (isMountedRef.current) {
        setWeeklyData(prev => ({ ...prev, loading: false }));
      }
    }
  }, [loadCropWeeks, weeks]); // Add weeks dependency back since we're using it

  useEffect(() => {
    if (cropId) {
      fetchWeeklyData(cropId);
    }
  }, [cropId]); // Remove fetchWeeklyData dependency to prevent infinite loops

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return {
    weeklyData,
    fetchWeeklyData
  };
}; 