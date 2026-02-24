import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { cropService, Crop, Stage, Week, Disease, StageWithWeeks } from '@/api/cropService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/context/AuthContext';

export interface StageWiseError {
  message: string;
  code: string;
}

// Cache configuration
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
const CACHE_KEYS = {
  STAGES: 'cached_stages_v2',
  STAGES_WITH_WEEKS: 'cached_stages_with_weeks_v2',
  STAGE_DISEASES: 'cached_stage_diseases_v2',
  LAST_SYNC: 'stages_last_sync_v2',
};

// Logging utility
const logger = {
  info: (message: string, data?: any) => {
    console.log(`[STAGE_WISE] ${message}`, data || '');
  },
  error: (message: string, error?: any) => {
    console.error(`[STAGE_WISE ERROR] ${message}`, error || '');
  },
  warn: (message: string, data?: any) => {
    console.warn(`[STAGE_WISE WARN] ${message}`, data || '');
  },
  debug: (message: string, data?: any) => {
    console.log(`[STAGE_WISE DEBUG] ${message}`, data || '');
  }
};

export const useStageWiseData = () => {
  const { language } = useAuth();

  // State
  const [stages, setStages] = useState<Stage[]>([]);
  const [currentStage, setCurrentStage] = useState<Stage | null>(null);
  const [stageDiseases, setStageDiseases] = useState<Disease[]>([]);
  const [selectedCropId, setSelectedCropId] = useState<number | null>(null);
  const [loading, setLoading] = useState({
    stages: false,
    stageDetails: false,
    diseases: false,
    initializing: false,
  });
  const [error, setError] = useState<StageWiseError | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<number>(0);
  const [isInitialized, setIsInitialized] = useState(false);

  // Refs for preventing race conditions
  const initializationRef = useRef<Promise<void> | null>(null);
  const operationLocks = useRef<Map<string, Promise<any>>>(new Map());
  const isMounted = useRef(true);

  // Cache utilities
  const isCacheExpired = useCallback((lastSync?: number) => {
    const syncTime = lastSync || lastSyncTime;
    if (syncTime === 0) return true;
    const expired = Date.now() - syncTime > CACHE_DURATION;
    logger.debug(`Cache check - expired: ${expired}, lastSync: ${syncTime}, now: ${Date.now()}`);
    return expired;
  }, [lastSyncTime]);

  const saveToCache = useCallback(async (key: string, data: any): Promise<void> => {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(data));
      logger.debug(`Cached data saved: ${key}`);
    } catch (error) {
      logger.error(`Failed to cache ${key}`, error);
    }
  }, []);

  const loadFromCache = useCallback(async <T>(key: string): Promise<T | null> => {
    try {
      const cached = await AsyncStorage.getItem(key);
      if (cached && cached !== 'null' && cached !== 'undefined') {
        const data = JSON.parse(cached);
        if (data !== null && data !== undefined) {
          logger.debug(`Cached data loaded: ${key}`);
          return data;
        }
      }
      return null;
    } catch (error) {
      logger.error(`Failed to load cached ${key}`, error);
      try {
        await AsyncStorage.removeItem(key);
      } catch (clearError) {
        logger.error(`Failed to clear corrupted cache ${key}`, clearError);
      }
      return null;
    }
  }, []);

  const updateSyncTime = useCallback(async (): Promise<void> => {
    const now = Date.now();
    setLastSyncTime(now);
    try {
      await saveToCache(CACHE_KEYS.LAST_SYNC, now);
      logger.debug(`Sync time updated: ${now}`);
    } catch (error) {
      logger.error('Failed to save sync time', error);
    }
  }, [saveToCache]);

  // Error handling
  const clearError = useCallback(() => {
    logger.debug('Error cleared');
    setError(null);
  }, []);

  const setErrorWithCode = useCallback((message: string, code: string) => {
    const errorObj = { message, code };
    logger.error(`Setting error: ${code} - ${message}`);
    setError(errorObj);
  }, []);

  // Operation lock utility
  const withOperationLock = useCallback(async <T>(
    key: string,
    operation: () => Promise<T>
  ): Promise<T> => {
    logger.debug(`Attempting to acquire lock: ${key}`);

    if (operationLocks.current.has(key)) {
      logger.debug(`Operation ${key} already in progress, waiting...`);
      try {
        return await operationLocks.current.get(key);
      } catch (error) {
        logger.error(`Waiting for operation ${key} failed`, error);
        throw error;
      }
    }

    const operationPromise = (async () => {
      try {
        logger.debug(`Starting operation: ${key}`);
        const result = await operation();
        logger.debug(`Completed operation: ${key}`);
        return result;
      } catch (error) {
        logger.error(`Failed operation: ${key}`, error);
        throw error;
      } finally {
        operationLocks.current.delete(key);
        logger.debug(`Released lock: ${key}`);
      }
    })();

    operationLocks.current.set(key, operationPromise);
    return operationPromise;
  }, []);

  // Load cached data
  const loadCachedData = useCallback(async (cropId: number): Promise<void> => {
    logger.info('Loading cached stage data...');
    try {
      const [
        cachedStages,
        cachedStageDiseases,
        cachedSyncTime
      ] = await Promise.all([
        loadFromCache<Stage[]>(`${CACHE_KEYS.STAGES}_${cropId}`),
        loadFromCache<Disease[]>(`${CACHE_KEYS.STAGE_DISEASES}_${cropId}`),
        loadFromCache<number>(CACHE_KEYS.LAST_SYNC)
      ]);

      if (cachedStages?.length) {
        setStages(cachedStages);
        logger.info(`Loaded ${cachedStages.length} stages from cache`);
      }

      if (cachedStageDiseases?.length) {
        setStageDiseases(cachedStageDiseases);
        logger.info(`Loaded ${cachedStageDiseases.length} diseases from cache`);
      }

      if (cachedSyncTime) {
        setLastSyncTime(cachedSyncTime);
        logger.info(`Loaded sync time from cache: ${cachedSyncTime}`);
      }

      logger.info('Cached data loaded successfully');
    } catch (error) {
      logger.error('Failed to load cached data', error);
    }
  }, [loadFromCache]);

  // Fetch crop stages
  const fetchCropStages = useCallback(async (cropId: number, forceRefresh = false): Promise<Stage[]> => {
    const cacheKey = `${CACHE_KEYS.STAGES}_${cropId}`;
    
    return withOperationLock(`stages_${cropId}`, async () => {
      logger.info(`Loading stages for crop ${cropId} - forceRefresh: ${forceRefresh}`);

      // Force refresh if crop ID has changed
      const shouldForceRefresh = forceRefresh || selectedCropId !== cropId;

      if (!shouldForceRefresh && stages.length > 0 && !isCacheExpired()) {
        logger.info('Skipping stages fetch - using existing data');
        return stages;
      }

      try {
        setLoading(prev => ({ ...prev, stages: true }));
        clearError();

        // Clear previous stages if crop ID has changed
        if (selectedCropId !== cropId) {
          setStages([]);
          setSelectedCropId(cropId);
        }

        logger.info(`Fetching stages for crop ${cropId}`);
        const fetchedStages = await cropService.getCropStages(cropId);
        
        if (isMounted.current) {
          setStages(fetchedStages);
          await saveToCache(cacheKey, fetchedStages);
          await updateSyncTime();
          logger.info(`Successfully loaded ${fetchedStages.length} stages`);
        }

        return fetchedStages;
      } catch (error: any) {
        logger.error('Failed to fetch crop stages', error);
        if (isMounted.current) {
          setErrorWithCode(error.message || 'Failed to fetch stages', 'FETCH_STAGES_ERROR');
        }
        throw error;
      } finally {
        if (isMounted.current) {
          setLoading(prev => ({ ...prev, stages: false }));
        }
      }
    });
  }, [stages.length, withOperationLock, clearError, isCacheExpired, saveToCache, updateSyncTime, setErrorWithCode, selectedCropId]);

  // Fetch specific stage details
  const fetchStageDetails = useCallback(async (cropId: number, stageNumber: number): Promise<Stage> => {
    return withOperationLock(`stage_${cropId}_${stageNumber}`, async () => {
      logger.info(`Loading stage ${stageNumber} details for crop ${cropId}`);
      
      // Log current language from context
      console.log('[STAGE DATA DEBUG] Current language from Auth context:', language);

      try {
        setLoading(prev => ({ ...prev, stageDetails: true }));
        clearError();

        logger.info(`Fetching stage ${stageNumber} details for crop ${cropId}`);
        console.log(`[STAGE DATA DEBUG] Calling cropService.getCropStage with language: ${language}`);
        
        const stageDetails = await cropService.getCropStage({ 
          cropId, 
          stageNumber, 
          language // Explicitly pass the current language from Auth context
        });
        
        console.log(`[STAGE DATA DEBUG] Received stage details in language: ${language}`);
        console.log('[STAGE DATA DEBUG] Stage title:', stageDetails.title);
        
        if (isMounted.current) {
          setCurrentStage(stageDetails);
          logger.info(`Successfully loaded stage ${stageNumber} details`);
        }

        return stageDetails;
      } catch (error: any) {
        logger.error('Failed to fetch stage details', error);
        console.error('[STAGE DATA DEBUG] Error fetching stage details:', error);
        if (isMounted.current) {
          setErrorWithCode(error.message || 'Failed to fetch stage details', 'FETCH_STAGE_DETAILS_ERROR');
        }
        throw error;
      } finally {
        if (isMounted.current) {
          setLoading(prev => ({ ...prev, stageDetails: false }));
        }
      }
    });
  }, [withOperationLock, clearError, setErrorWithCode, language]);

  // Fetch stage diseases
  const fetchStageDiseases = useCallback(async (cropId: number, stageNumber: number): Promise<Disease[]> => {
    const cacheKey = `${CACHE_KEYS.STAGE_DISEASES}_${cropId}_${stageNumber}`;
    
    return withOperationLock(`diseases_${cropId}_${stageNumber}`, async () => {
      logger.info(`Loading diseases for crop ${cropId}, stage ${stageNumber}`);

      if (!isCacheExpired() && stageDiseases.length > 0) {
        logger.info('Skipping diseases fetch - using existing data');
        return stageDiseases;
      }

      try {
        setLoading(prev => ({ ...prev, diseases: true }));
        clearError();

        logger.info(`Fetching diseases for crop ${cropId}, stage ${stageNumber}`);
        const diseases = await cropService.getCropStageDiseases({ 
          cropId, 
          stageNumber,
          language // Explicitly pass the current language from Auth context
        });
        
        if (isMounted.current) {
          setStageDiseases(diseases);
          await saveToCache(cacheKey, diseases);
          await updateSyncTime();
          logger.info(`Successfully loaded ${diseases.length} diseases`);
        }

        return diseases;
      } catch (error: any) {
        logger.error('Failed to fetch stage diseases', error);
        if (isMounted.current) {
          setErrorWithCode(error.message || 'Failed to fetch diseases', 'FETCH_DISEASES_ERROR');
        }
        throw error;
      } finally {
        if (isMounted.current) {
          setLoading(prev => ({ ...prev, diseases: false }));
        }
      }
    });
  }, [stageDiseases.length, withOperationLock, clearError, isCacheExpired, saveToCache, updateSyncTime, setErrorWithCode]);

  // Initialize data for a crop
  const initializeData = useCallback(async (cropId: number, forceRefresh = false): Promise<void> => {
    if (initializationRef.current) {
      logger.info('Initialization already in progress, waiting...');
      return initializationRef.current;
    }

    if (!isMounted.current) {
      logger.info('Component unmounted, skipping initialization');
      return;
    }

    const initPromise = (async () => {
      try {
        logger.info(`Starting data initialization for crop ${cropId} - forceRefresh: ${forceRefresh}`);
        if (isMounted.current) {
          setLoading(prev => ({ ...prev, initializing: true }));
        }
        clearError();

        // Load cached data first if not force refreshing
        if (!forceRefresh) {
          await loadCachedData(cropId);
        }

        if (!isMounted.current) return;

        // Check if we need to fetch fresh data
        const shouldFetch = forceRefresh || isCacheExpired();

        if (shouldFetch) {
          logger.info('Fetching fresh data from API...');
          await fetchCropStages(cropId, true);
        } else {
          logger.info('Using cached/existing data, skipping API fetch');
        }

        if (isMounted.current) {
          setIsInitialized(true);
          logger.info('Data initialization completed successfully');
        }
      } catch (error: any) {
        logger.error('Data initialization failed', error);
        if (isMounted.current) {
          setErrorWithCode(
            error.message || 'Failed to initialize data',
            'INITIALIZE_DATA_ERROR'
          );
        }
        throw error;
      } finally {
        if (isMounted.current) {
          setLoading(prev => ({ ...prev, initializing: false }));
        }
        initializationRef.current = null;
      }
    })();

    initializationRef.current = initPromise;
    return initPromise;
  }, [loadCachedData, fetchCropStages, clearError, isCacheExpired, setErrorWithCode]);

  // Retry functionality
  const retry = useCallback(async (): Promise<void> => {
    if (!error || !selectedCropId) return;

    logger.info(`Retrying failed operation: ${error.code}`);
    try {
      clearError();
      switch (error.code) {
        case 'FETCH_STAGES_ERROR':
          await fetchCropStages(selectedCropId, true);
          break;
        case 'FETCH_STAGE_DETAILS_ERROR':
          if (currentStage) {
            await fetchStageDetails(selectedCropId, currentStage.stage_number);
          }
          break;
        case 'FETCH_DISEASES_ERROR':
          if (currentStage) {
            await fetchStageDiseases(selectedCropId, currentStage.stage_number);
          }
          break;
        default:
          await initializeData(selectedCropId, true);
      }
      logger.info('Retry completed successfully');
    } catch (retryError: any) {
      logger.error('Retry failed', retryError);
      setErrorWithCode(retryError.message || 'Retry failed', error.code);
    }
  }, [error, selectedCropId, clearError, fetchCropStages, fetchStageDetails, fetchStageDiseases, currentStage, initializeData, setErrorWithCode]);

  // Clear all data
  const clearData = useCallback(() => {
    logger.info('Clearing all stage data');
    setStages([]);
    setCurrentStage(null);
    setStageDiseases([]);
    setSelectedCropId(null);
    setLastSyncTime(0);
    setIsInitialized(false);
    clearError();
  }, [clearError]);

  // Cleanup on unmount
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (initializationRef.current) {
        initializationRef.current = null;
      }
      operationLocks.current.clear();
    };
  }, []);

  // Memoized return value
  return useMemo(() => ({
    // State
    stages,
    currentStage,
    stageDiseases,
    selectedCropId,
    loading,
    error,
    isInitialized,

    // Actions
    clearData,
    setCurrentStage,

    // Data loading
    fetchCropStages,
    fetchStageDetails,
    fetchStageDiseases,
    retry,
  }), [
    stages,
    currentStage,
    stageDiseases,
    selectedCropId,
    loading,
    error,
    isInitialized,
    clearData,
    fetchCropStages,
    fetchStageDetails,
    fetchStageDiseases,
    retry
  ]);
}; 