import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Crop, Week } from '@/api/cropService';
import { CropTrackResponse, CropTrackInput, DailyCropUpdate, cropTrackingService } from '@/api/cropTrackService';
import { cropService } from '@/api/cropService';
import { useAuth } from '@/context/AuthContext';

// Simplified logging utility
const logger = {
  info: (message: string, data?: any) => {
    console.log(`[CROPS] ${message}`, data || '');
  },
  error: (message: string, error?: any) => {
    console.error(`[CROPS ERROR] ${message}`, error || '');
  },
  warn: (message: string, data?: any) => {
    console.warn(`[CROPS WARN] ${message}`, data || '');
  },
  debug: (message: string, data?: any) => {
    console.log(`[CROPS DEBUG] ${message}`, data || '');
  }
};

export interface CropError {
  message: string;
  code: string;
}

export interface NotificationPreference {
  dailyReminders?: boolean;
  diseaseAlerts?: boolean;
  weatherAlerts?: boolean;
}

export interface HandholdCrop {
  cropId: number;
  cropName: string;
  variety: string;
  startDate: string;
  notificationPreferences: {
    enabled: boolean | NotificationPreference;
  };
  image_urls: string[];
  id: number;
}

export const useCrops = () => {
  const { isAuthenticated, language } = useAuth();
  const isMounted = useRef(true);

  // State management
  const [crops, setCrops] = useState<Crop[]>([]);
  const [currentCrop, setCurrentCrop] = useState<Crop | null>(null);
  const [handholdCrops, setHandholdCrops] = useState<HandholdCrop[]>([]);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [currentTracking, setCurrentTracking] = useState<CropTrackResponse | null>(null);
  const [allTrackings, setAllTrackings] = useState<CropTrackResponse[]>([]);
  const [dailyUpdate, setDailyUpdate] = useState<DailyCropUpdate | null>(null);
  const [error, setError] = useState<CropError | null>(null);
  const [loading, setLoading] = useState({
    crops: false,
    weeks: false,
    currentTracking: false,
    trackings: false,
    dailyUpdate: false,
    handholdCrops: false
  });

  // Refs to prevent multiple simultaneous operations
  const operationLocks = useRef<Set<string>>(new Set());
  const lastTrackingId = useRef<number | null>(null);
  const lastLanguage = useRef<string | null>(null);
  const hasInitialized = useRef(false);

  // Helper to ensure loading state is always cleared
  const clearLoadingState = useCallback((loadingKey: keyof typeof loading) => {
    if (isMounted.current) {
      setLoading(prev => ({ ...prev, [loadingKey]: false }));
    }
  }, []);

  // Helper to set error with code and clear loading
  const setErrorWithCode = useCallback((message: string, code: string, loadingKey?: keyof typeof loading) => {
    if (isMounted.current) {
      setError({ message, code });
      if (loadingKey) {
        clearLoadingState(loadingKey);
      }
    }
  }, [clearLoadingState]);

  // Helper to check if operation is already in progress
  const isOperationInProgress = useCallback((operationKey: string): boolean => {
    return operationLocks.current.has(operationKey);
  }, []);

  // Helper to set operation lock
  const setOperationLock = useCallback((operationKey: string, isLocked: boolean) => {
    if (isLocked) {
      operationLocks.current.add(operationKey);
    } else {
      operationLocks.current.delete(operationKey);
    }
  }, []);

  // Helper to set loading with timeout protection
  const setLoadingWithTimeout = useCallback((loadingKey: keyof typeof loading, isLoading: boolean, timeoutMs: number = 30000) => {
    if (isMounted.current) {
      setLoading(prev => ({ ...prev, [loadingKey]: isLoading }));
      
      // Set a timeout to clear loading state if it gets stuck
      if (isLoading) {
        setTimeout(() => {
          if (isMounted.current) {
            setLoading(prev => ({ ...prev, [loadingKey]: false }));
            logger.warn(`Loading timeout for ${loadingKey}, clearing state`);
          }
        }, timeoutMs);
      }
    }
  }, []);

  // Load all crops with enhanced loading states and cache fallback
  const loadCrops = useCallback(async (forceRefresh: boolean = false) => {
    if (!isAuthenticated) {
      logger.debug('User not authenticated, skipping crops load');
      return;
    }

    const operationKey = `loadCrops_${language}`;
    if (isOperationInProgress(operationKey)) {
      logger.debug('Crops load already in progress, skipping');
      return;
    }

    setOperationLock(operationKey, true);
    setError(null);

    try {
      // Show loading state only when fetching from network
      if (forceRefresh) {
        setLoadingWithTimeout('crops', true);
      }

      const cropsData = await cropService.getAllCrops(forceRefresh);
      
      if (isMounted.current) {
        setCrops(cropsData);
        logger.debug(`Loaded ${cropsData.length} crops`);
      }
    } catch (error: any) {
      if (isMounted.current) {
        const message = error.message || 'Failed to load crops';
        setErrorWithCode(message, 'CROPS_LOAD_ERROR', 'crops');
        logger.error('Failed to load crops', error);
      }
    } finally {
      if (isMounted.current) {
        setLoadingWithTimeout('crops', false);
      }
      setOperationLock(operationKey, false);
    }
  }, [isAuthenticated, language, setErrorWithCode]);

  // Load crop weeks with enhanced loading states and cache fallback
  const loadCropWeeks = useCallback(async (cropId: number, forceRefresh: boolean = false) => {
    if (!isAuthenticated || !cropId) {
      logger.debug('User not authenticated or no crop ID, skipping weeks load');
      return;
    }

    const operationKey = `loadWeeks_${cropId}_${language}`;
    if (isOperationInProgress(operationKey)) {
      logger.debug('Weeks load already in progress, skipping');
      return;
    }

    setOperationLock(operationKey, true);
    setError(null);

    try {
      // Show loading state only when fetching from network
      if (forceRefresh) {
        setLoadingWithTimeout('weeks', true);
      }

      const weeksData = await cropService.getCropWeeks(cropId, forceRefresh);
      
      if (isMounted.current) {
        setWeeks(weeksData);
        logger.debug(`Loaded ${weeksData.length} weeks for crop ${cropId}`);
      }
    } catch (error: any) {
      if (isMounted.current) {
        const message = error.message || 'Failed to load weeks';
        setErrorWithCode(message, 'WEEKS_LOAD_ERROR', 'weeks');
        logger.error('Failed to load weeks', error);
      }
    } finally {
      if (isMounted.current) {
        setLoadingWithTimeout('weeks', false);
      }
      setOperationLock(operationKey, false);
    }
  }, [isAuthenticated, language, setErrorWithCode]);

  // Load all trackings with enhanced loading states and cache fallback
  const loadTrackings = useCallback(async (forceRefresh: boolean = false) => {
    if (!isAuthenticated) {
      logger.debug('User not authenticated, skipping trackings load');
      return;
    }

    const operationKey = `loadTrackings_${language}`;
    if (isOperationInProgress(operationKey)) {
      logger.debug('Trackings load already in progress, skipping');
      return;
    }

    setOperationLock(operationKey, true);
    setError(null);

    try {
      // Show loading state only when fetching from network
      if (forceRefresh) {
        setLoadingWithTimeout('trackings', true);
      }

      const trackingsData = await cropTrackingService.getCropTracking(forceRefresh);
      
      if (isMounted.current) {
        setAllTrackings(trackingsData);
        logger.debug(`Loaded ${trackingsData.length} trackings`);
      }
    } catch (error: any) {
      if (isMounted.current) {
        const message = error.message || 'Failed to load trackings';
        setErrorWithCode(message, 'TRACKINGS_LOAD_ERROR', 'trackings');
        logger.error('Failed to load trackings', error);
      }
    } finally {
      if (isMounted.current) {
        setLoadingWithTimeout('trackings', false);
      }
      setOperationLock(operationKey, false);
    }
  }, [isAuthenticated, language, setErrorWithCode]);

  // Load current tracking with enhanced loading states and cache fallback
  const loadCurrentTracking = useCallback(async (forceRefresh: boolean = false) => {
    if (!isAuthenticated) {
      logger.debug('User not authenticated, skipping current tracking load');
      return;
    }

    const operationKey = `loadCurrentTracking_${language}`;
    if (isOperationInProgress(operationKey)) {
      logger.debug('Current tracking load already in progress, skipping');
      return;
    }

    setOperationLock(operationKey, true);
    setError(null);

    try {
      // Show loading state only when fetching from network
      if (forceRefresh) {
        setLoadingWithTimeout('currentTracking', true);
      }

      const trackingData = await cropTrackingService.getCurrentCropTracking(forceRefresh);
      
      if (isMounted.current) {
        setCurrentTracking(trackingData);
        logger.debug('Current tracking loaded:', trackingData ? trackingData.id : 'none');
      }
    } catch (error: any) {
      if (isMounted.current) {
        const message = error.message || 'Failed to load current tracking';
        setErrorWithCode(message, 'CURRENT_TRACKING_LOAD_ERROR', 'currentTracking');
        logger.error('Failed to load current tracking', error);
      }
    } finally {
      if (isMounted.current) {
        setLoadingWithTimeout('currentTracking', false);
      }
      setOperationLock(operationKey, false);
    }
  }, [isAuthenticated, language, setErrorWithCode]);

  // Load daily update with enhanced loading states and cache fallback
  const loadDailyUpdate = useCallback(async (trackingId: number, forceRefresh: boolean = false) => {
    if (!isAuthenticated || !trackingId) {
      logger.debug('User not authenticated or no tracking ID, skipping daily update load');
      return;
    }

    // Only load if tracking ID changed or force refresh is requested
    if (lastTrackingId.current === trackingId && !forceRefresh) {
      logger.debug('Daily update already loaded for this tracking, skipping');
      return;
    }

    const operationKey = `loadDailyUpdate_${trackingId}_${language}`;
    if (isOperationInProgress(operationKey)) {
      logger.debug('Daily update load already in progress, skipping');
      return;
    }

    setOperationLock(operationKey, true);
    setError(null);

    try {
      // Show loading state only when fetching from network
      if (forceRefresh) {
        setLoadingWithTimeout('dailyUpdate', true);
      }

      const updateData = await cropTrackingService.getDailyUpdate(trackingId, forceRefresh);
      
      if (isMounted.current) {
        setDailyUpdate(updateData);
        lastTrackingId.current = trackingId;
        logger.debug('Daily update loaded for tracking:', trackingId);
      }
    } catch (error: any) {
      if (isMounted.current) {
        const message = error.message || 'Failed to load daily update';
        setErrorWithCode(message, 'DAILY_UPDATE_LOAD_ERROR', 'dailyUpdate');
        logger.error('Failed to load daily update', error);
      }
    } finally {
      if (isMounted.current) {
        setLoadingWithTimeout('dailyUpdate', false);
      }
      setOperationLock(operationKey, false);
    }
  }, [isAuthenticated, language, setErrorWithCode]);

  // Start crop tracking with optimized cache invalidation
  const startCropTracking = useCallback(async (tracking: CropTrackInput): Promise<CropTrackResponse | null> => {
    if (!isAuthenticated) {
      logger.debug('User not authenticated, cannot start crop tracking');
      return null;
    }

    setError(null);

    try {
      const newTracking = await cropTrackingService.startCropTracking(tracking);
      
      if (isMounted.current && newTracking) {
        // Clear all relevant caches to ensure fresh data
        await Promise.all([
          cropTrackingService.clearTrackingsListCache(language),
          cropTrackingService.clearCurrentTrackingCache(language),
          // Clear daily update cache for the new tracking ID
          cropTrackingService.clearDailyUpdateCache(newTracking.id, language)
        ]);
        
        logger.debug('Cleared caches for new tracking:', newTracking.id);
        
        // Reload all necessary data with force refresh
        const trackingsPromise = cropTrackingService.getCropTracking(true).then(trackingsData => {
          if (isMounted.current) {
            setAllTrackings(trackingsData);
            logger.debug('Reloaded trackings after starting new tracking');
          }
        });
        
        const currentTrackingPromise = cropTrackingService.getCurrentCropTracking(true).then(trackingData => {
          if (isMounted.current) {
            setCurrentTracking(trackingData);
            logger.debug('Reloaded current tracking after starting new tracking:', trackingData?.id);
          }
        });
        
        await Promise.all([trackingsPromise, currentTrackingPromise]);
        
        // Explicitly set the new tracking as current tracking
        if (newTracking.id && newTracking.cropId) {
          try {
            logger.debug('Explicitly setting new tracking as current tracking:', newTracking.cropId);
            const setCurrentResult = await cropTrackingService.setCurrentCropTracking(newTracking.cropId);
            if (isMounted.current && setCurrentResult) {
              setCurrentTracking(setCurrentResult);
              logger.debug('Successfully set new tracking as current tracking:', setCurrentResult.id);
            }
          } catch (setCurrentError) {
            logger.warn('Failed to set new tracking as current tracking:', setCurrentError);
          }
        }
        
        // Load daily update for the new tracking if it's set as current
        if (newTracking.id) {
          try {
            logger.debug('Attempting to load daily update for new tracking:', newTracking.id);
            const dailyUpdateData = await cropTrackingService.getDailyUpdate(newTracking.id, true);
            if (isMounted.current) {
              setDailyUpdate(dailyUpdateData);
              lastTrackingId.current = newTracking.id;
              logger.debug('Successfully loaded daily update for new tracking:', newTracking.id);
            }
          } catch (dailyUpdateError) {
            logger.warn(`Failed to load daily update for new tracking ${newTracking.id}:`, dailyUpdateError);
            // Don't throw error for daily update failure, but set a default daily update
            if (isMounted.current) {
              // Set a basic daily update structure to prevent UI issues
              setDailyUpdate({
                tracking_id: newTracking.id,
                lang: language,
                week_number: newTracking.currentWeek || 1,
                days: {},
                title: `Week ${newTracking.currentWeek || 1}`,
                alerts: [],
                weather_info: {}
              });
              lastTrackingId.current = newTracking.id;
            }
          }
        }
        
        logger.debug('Successfully started crop tracking and reloaded all data:', newTracking.id);
      }
      
      return newTracking;
    } catch (error: any) {
      if (isMounted.current) {
        const message = error.message || 'Failed to start crop tracking';
        setErrorWithCode(message, 'START_TRACKING_ERROR', 'currentTracking');
        logger.error('Failed to start crop tracking', error);
      }
      return null;
    }
  }, [isAuthenticated, language, setErrorWithCode]);

  // Set current crop tracking with optimized cache invalidation
  const setCurrentCropTracking = useCallback(async (cropId: number): Promise<boolean> => {
    if (!isAuthenticated || !cropId) {
      logger.debug('User not authenticated or no crop ID, cannot set current tracking');
      return false;
    }

    setError(null);

    try {
      const tracking = await cropTrackingService.setCurrentCropTracking(cropId);
      
      if (isMounted.current && tracking) {
        // Only invalidate specific caches
        await cropTrackingService.clearTrackingCache(tracking.id, language);
        
        // Reload only necessary data - call functions directly to avoid dependency issues
        const currentTrackingPromise = cropTrackingService.getCurrentCropTracking(true).then(trackingData => {
          if (isMounted.current) {
            setCurrentTracking(trackingData);
          }
        });
        
        const dailyUpdatePromise = cropTrackingService.getDailyUpdate(tracking.id, true).then(updateData => {
          if (isMounted.current) {
            setDailyUpdate(updateData);
            lastTrackingId.current = tracking.id;
          }
        });
        
        await Promise.all([currentTrackingPromise, dailyUpdatePromise]);
        
        logger.debug('Set current crop tracking:', cropId);
        return true;
      }
      
      return false;
    } catch (error: any) {
      if (isMounted.current) {
        const message = error.message || 'Failed to set current crop tracking';
        setErrorWithCode(message, 'SET_CURRENT_TRACKING_ERROR', 'currentTracking');
        logger.error('Failed to set current crop tracking', error);
      }
      return false;
    }
  }, [isAuthenticated, language, setErrorWithCode]);

  // Refresh daily update when language changes
  const refreshDailyUpdate = useCallback(async (trackingId: number, newLanguage: string) => {
    if (!isAuthenticated || !trackingId) {
      return;
    }

    try {
      const updateData = await cropTrackingService.refreshDailyUpdate(trackingId, newLanguage);
      if (isMounted.current) {
        setDailyUpdate(updateData);
        logger.debug('Refreshed daily update for language:', newLanguage);
      }
    } catch (error: any) {
      logger.error('Failed to refresh daily update', error);
    }
  }, [isAuthenticated]);

  // Check if a crop is being tracked
  const isCropTracked = useCallback((cropId: number): boolean => {
    const result = allTrackings && allTrackings.length > 0 ? allTrackings.some(tracking => tracking.cropId === cropId) : false;
    logger.debug(`isCropTracked(${cropId}): ${result}`, { allTrackingsCount: allTrackings?.length || 0 });
    return result;
  }, [allTrackings]);

  // Get tracking data for a specific crop
  const getCropTracking = useCallback((cropId: number): CropTrackResponse | null => {
    const result = allTrackings && allTrackings.length > 0 ? allTrackings.find(tracking => tracking.cropId === cropId) || null : null;
    logger.debug(`getCropTracking(${cropId}):`, result);
    return result;
  }, [allTrackings]);

  // Clear all cache
  const clearAllCache = useCallback(async () => {
    try {
      await cropService.clearAllCache(language);
      await cropTrackingService.clearAllCache(language);
      logger.info('All cache cleared');
    } catch (error: any) {
      logger.error('Failed to clear cache', error);
    }
  }, [language]);

  // Clear stuck operations and reset state
  const clearStuckOperations = useCallback(async () => {
    try {
      logger.debug('Clearing stuck operations and resetting state');
      
      // Clear operation locks
      operationLocks.current.clear();
      
      // Clear service stuck operations
      await cropService.clearStuckOperations();
      
      // Reset loading states
      setLoading({
        crops: false,
        weeks: false,
        currentTracking: false,
        trackings: false,
        dailyUpdate: false,
        handholdCrops: false
      });
      
      // Clear error
      setError(null);
      
      logger.debug('Stuck operations cleared successfully');
    } catch (error) {
      logger.error('Error clearing stuck operations:', error);
    }
  }, []);

  // Get service status for debugging
  const getServiceStatus = useCallback(async () => {
    try {
      return await cropService.getServiceStatus();
    } catch (error) {
      logger.error('Error getting service status:', error);
      return null;
    }
  }, []);

  // Initialize data when authenticated - optimized for caching
  useEffect(() => {
    if (isAuthenticated && !hasInitialized.current) {
      logger.debug('User authenticated, loading initial data with cache priority');
      hasInitialized.current = true;
      
      const initializeData = async () => {
        try {
          // Load initial data with cache priority - only fetch from network if cache is stale
          // This reduces API calls significantly
          await Promise.allSettled([
            loadCrops(false), // Use cache first, only fetch if stale
            loadTrackings(false), // Use cache first, only fetch if stale
            loadCurrentTracking(false) // Use cache first, only fetch if stale
          ]);
          
          logger.debug('Initial data loading completed with cache optimization');
        } catch (error) {
          logger.error('Error in initial data loading:', error);
        }
      };
      
      initializeData();
    } else if (!isAuthenticated) {
      logger.debug('User not authenticated, clearing data');
      hasInitialized.current = false;
      lastTrackingId.current = null;
      lastLanguage.current = null;
      setCrops([]);
      setCurrentCrop(null);
      setHandholdCrops([]);
      setWeeks([]);
      setCurrentTracking(null);
      setAllTrackings([]);
      setDailyUpdate(null);
      setError(null);
    }
  }, [isAuthenticated, loadCrops, loadTrackings, loadCurrentTracking]);

  // Handle language changes with optimized refresh - only refresh what's needed
  useEffect(() => {
    if (isAuthenticated && language && lastLanguage.current !== language) {
      logger.debug('Language changed, refreshing data with cache optimization');
      lastLanguage.current = language;
      
      const refreshDataForLanguage = async () => {
        try {
          // Get current tracking ID before clearing state
          const currentTrackingId = currentTracking?.id;
          
          // Only refresh data that's language-dependent, use cache for others
          await Promise.allSettled([
            loadCrops(true), // Force refresh for language change
            loadTrackings(true), // Force refresh for language change
            loadCurrentTracking(true) // Force refresh for language change
          ]);
          
          // Load daily update if we have a tracking ID
          if (currentTrackingId) {
            try {
              const updateData = await cropTrackingService.getDailyUpdate(currentTrackingId, true);
              if (isMounted.current) {
                setDailyUpdate(updateData);
                lastTrackingId.current = currentTrackingId;
              }
            } catch (error) {
              logger.error('Error loading daily update for language change:', error);
            }
          }
          
          logger.debug('Language-dependent data refreshed successfully');
        } catch (error) {
          logger.error('Error refreshing data for language change:', error);
        }
      };
      
      refreshDataForLanguage();
    }
  }, [language, isAuthenticated]); // Remove currentTracking dependency to prevent infinite loops

  // Set current crop when crops are loaded and we have current tracking
  useEffect(() => {
    if (currentTracking && crops.length > 0) {
      const cropForTracking = crops.find(crop => crop.id === currentTracking.cropId);
      if (cropForTracking) {
        setCurrentCrop(cropForTracking);
        logger.debug('Current crop updated:', {
          cropId: cropForTracking.id,
          cropName: cropForTracking.name,
          language: language
        });
      }
    } else if (!currentTracking) {
      setCurrentCrop(null);
    }
  }, [currentTracking, crops, language]);

  // Update handhold crops from trackings
  useEffect(() => {
    if (allTrackings && crops && crops.length > 0) {
      const handholdCropsData = allTrackings.map(tracking => {
        const cropDetails = crops.find(crop => crop.id === tracking.cropId);
        return {
          cropId: tracking.cropId,
          cropName: cropDetails?.name || `Crop ${tracking.cropId}`,
          variety: cropDetails?.variety || 'Growing',
          startDate: tracking.startDate,
          notificationPreferences: {
            enabled: tracking.notificationPreferences || {}
          },
          image_urls: cropDetails?.image_urls || [],
          id: tracking.id
        };
      });
      
      setHandholdCrops(handholdCropsData);
      logger.debug(`Updated handhold crops from trackings: ${handholdCropsData.length} crops`);
    }
  }, [allTrackings, crops]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
      // Clear all loading states on unmount
      setLoading({
        crops: false,
        weeks: false,
        currentTracking: false,
        trackings: false,
        dailyUpdate: false,
        handholdCrops: false
      });
      // Clear all operation locks
      operationLocks.current.clear();
    };
  }, []);

  return {
    // State
    crops,
    currentCrop,
    handholdCrops,
    weeks,
    currentTracking,
    allTrackings,
    dailyUpdate,
    error,
    loading,
    
    // Actions
    loadCrops,
    loadCropWeeks,
    loadTrackings,
    loadCurrentTracking,
    loadDailyUpdate,
    startCropTracking,
    setCurrentCropTracking,
    clearStuckOperations,
    getServiceStatus,
    
    // Utilities
    isCropTracked,
    getCropTracking,
  };
};