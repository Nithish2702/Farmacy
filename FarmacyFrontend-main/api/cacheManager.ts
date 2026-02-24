import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

// Cache configuration
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour
const CACHE_KEYS = {
  CROPS: 'api_cached_crops',
  TRACKINGS: 'api_cached_trackings',
  CURRENT_TRACKING: 'api_cached_current_tracking',
  WEEKS: 'api_cached_weeks',
  DAILY_UPDATE: 'api_cached_daily_update',
  LAST_SYNC: 'api_last_sync',
  HANDHOLD_CROPS: 'api_cached_handhold_crops',
  WEATHER: 'api_cached_weather',
  USER_DATA: 'api_cached_user_data',
  NOTIFICATIONS: 'api_cached_notifications'
};

// Helper to get language-specific cache key
const getCacheKey = (baseKey: string, language: string) => `${baseKey}_${language}`;

// Logging utility
const logger = {
  info: (message: string, data?: any) => {
    console.log(`[CACHE] ${message}`, data || '');
  },
  error: (message: string, error?: any) => {
    console.error(`[CACHE ERROR] ${message}`, error || '');
  },
  warn: (message: string, data?: any) => {
    console.warn(`[CACHE WARN] ${message}`, data || '');
  },
  debug: (message: string, data?: any) => {
    console.log(`[CACHE DEBUG] ${message}`, data || '');
  }
};

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  language: string;
  version?: string;
  metadata?: {
    source: 'network' | 'cache';
    retryCount?: number;
    lastNetworkError?: string;
  };
}

export interface CacheConfig {
  duration?: number;
  language?: string;
  version?: string;
}

class CacheManager {
  private static instance: CacheManager;
  private operationLocks: Map<string, Promise<any>> = new Map();
  private networkStatus: boolean = true;
  private cacheVersion: string = '1.0.0';

  private constructor() {
    this.initializeNetworkMonitoring();
  }

  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  private initializeNetworkMonitoring() {
    try {
      NetInfo.addEventListener(state => {
        const wasOnline = this.networkStatus;
        this.networkStatus = state.isConnected ?? false;
        
        if (wasOnline !== this.networkStatus) {
          logger.info(`Network status changed: ${this.networkStatus ? 'Online' : 'Offline'}`);
          this.handleNetworkStatusChange(this.networkStatus);
        }
      });
      logger.info('Cache manager network monitoring initialized');
    } catch (error) {
      logger.error('Failed to initialize network monitoring:', error);
    }
  }

  private handleNetworkStatusChange(isOnline: boolean) {
    if (isOnline) {
      // When coming back online, we could trigger a background sync
      logger.info('Network restored, background sync available');
    } else {
      logger.warn('Network lost, switching to offline mode');
    }
  }

  // Check if network is available
  async isNetworkAvailable(): Promise<boolean> {
    try {
      const netInfo = await NetInfo.fetch();
      this.networkStatus = netInfo.isConnected ?? false;
      return this.networkStatus;
    } catch (error) {
      logger.warn('Network check failed, assuming offline', error);
      return false;
    }
  }

  // Check if cache is expired
  isCacheExpired(timestamp: number, duration: number = CACHE_DURATION): boolean {
    if (timestamp === 0) return true;
    const expired = Date.now() - timestamp > duration;
    logger.debug(`Cache check - expired: ${expired}, timestamp: ${timestamp}, now: ${Date.now()}`);
    return expired;
  }

  // Enhanced cache validation
  private validateCacheEntry<T>(entry: CacheEntry<T>, language: string): boolean {
    if (!entry || !entry.data) {
      logger.debug('Cache entry is null or has no data');
      return false;
    }

    if (entry.language !== language) {
      logger.debug(`Language mismatch: expected ${language}, got ${entry.language}`);
      return false;
    }

    if (entry.version && entry.version !== this.cacheVersion) {
      logger.debug(`Version mismatch: expected ${this.cacheVersion}, got ${entry.version}`);
      return false;
    }

    return true;
  }

  // Save data to cache with enhanced metadata
  async saveToCache<T>(
    key: string, 
    data: T, 
    language: string = 'en',
    metadata?: { source: 'network' | 'cache'; retryCount?: number; lastNetworkError?: string }
  ): Promise<void> {
    try {
      const cacheKey = getCacheKey(key, language);
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        language,
        version: this.cacheVersion,
        metadata: {
          source: metadata?.source || 'network',
          retryCount: metadata?.retryCount,
          lastNetworkError: metadata?.lastNetworkError
        }
      };
      await AsyncStorage.setItem(cacheKey, JSON.stringify(entry));
      logger.debug(`Cached data saved: ${cacheKey}`, { source: entry.metadata?.source });
    } catch (error) {
      logger.error(`Failed to cache ${key}`, error);
      // Try to clear corrupted cache
      await this.clearCache(key, language);
    }
  }

  // Load data from cache with enhanced validation
  async loadFromCache<T>(key: string, language: string = 'en'): Promise<T | null> {
    try {
      const cacheKey = getCacheKey(key, language);
      const cached = await AsyncStorage.getItem(cacheKey);
      
      if (cached && cached !== 'null' && cached !== 'undefined') {
        const entry: CacheEntry<T> = JSON.parse(cached);
        
        // Validate cache entry
        if (this.validateCacheEntry(entry, language)) {
          logger.debug(`Cache hit for ${cacheKey}`, { 
            source: entry.metadata?.source,
            age: Date.now() - entry.timestamp 
          });
          return entry.data;
        } else {
          logger.debug(`Cache validation failed for ${cacheKey}`);
          // Clear invalid cache
          await this.clearCache(key, language);
        }
      }
      return null;
    } catch (error) {
      logger.error(`Failed to load cached ${key}`, error);
      // Clear corrupted cache
      try {
        const cacheKey = getCacheKey(key, language);
        await AsyncStorage.removeItem(cacheKey);
      } catch (clearError) {
        logger.error(`Failed to clear corrupted cache ${key}`, clearError);
      }
      return null;
    }
  }

  // Clear specific cache entry
  async clearCache(key: string, language: string = 'en'): Promise<void> {
    try {
      const cacheKey = getCacheKey(key, language);
      await AsyncStorage.removeItem(cacheKey);
      logger.debug(`Cache cleared: ${cacheKey}`);
    } catch (error) {
      logger.error(`Failed to clear cache ${key}`, error);
    }
  }

  // Clear all cache for a language
  async clearAllCache(language: string = 'en'): Promise<void> {
    try {
      const keys = Object.values(CACHE_KEYS);
      for (const key of keys) {
        await this.clearCache(key, language);
      }
      logger.info(`All cache cleared for language: ${language}`);
    } catch (error) {
      logger.error(`Failed to clear all cache for language ${language}`, error);
    }
  }

  // Clear all cache for all languages
  async clearAllCacheGlobally(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => 
        Object.values(CACHE_KEYS).some(cacheKey => key.startsWith(cacheKey))
      );
      
      if (cacheKeys.length > 0) {
        await AsyncStorage.multiRemove(cacheKeys);
        logger.info(`Cleared ${cacheKeys.length} cache entries globally`);
      }
    } catch (error) {
      logger.error('Failed to clear all cache globally', error);
    }
  }

  // Update sync time
  async updateSyncTime(language: string = 'en'): Promise<number> {
    const now = Date.now();
    try {
      await this.saveToCache(CACHE_KEYS.LAST_SYNC, now, language);
      logger.debug(`Sync time updated: ${now}`);
    } catch (error) {
      logger.error('Failed to save sync time', error);
    }
    return now;
  }

  // Get last sync time
  async getLastSyncTime(language: string = 'en'): Promise<number> {
    try {
      const lastSync = await this.loadFromCache<number>(CACHE_KEYS.LAST_SYNC, language);
      return lastSync || 0;
    } catch (error) {
      logger.error('Failed to get last sync time', error);
      return 0;
    }
  }

  // Operation lock utility to prevent race conditions
  async withOperationLock<T>(
    key: string,
    operation: () => Promise<T>,
    timeout: number = 30000 // 30 second timeout
  ): Promise<T> {
    logger.debug(`Attempting to acquire lock: ${key}`);

    // Check if operation is already in progress
    if (this.operationLocks.has(key)) {
      logger.debug(`Operation ${key} already in progress, waiting...`);
      
      // Add timeout to prevent infinite waiting
      const existingPromise = this.operationLocks.get(key)!;
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Operation timeout for ${key}`));
        }, timeout);
      });
      
      try {
        return await Promise.race([existingPromise, timeoutPromise]);
      } catch (error) {
        // If timeout occurs, remove the stuck operation
        if (error instanceof Error && error.message.includes('timeout')) {
          logger.warn(`Operation timeout for ${key}, removing stuck operation`);
          this.operationLocks.delete(key);
        }
        throw error;
      }
    }

    // Create new operation promise with timeout
    const operationPromise = Promise.race([
      operation(),
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Operation timeout for ${key}`));
        }, timeout);
      })
    ]).finally(() => {
      this.operationLocks.delete(key);
      logger.debug(`Lock released: ${key}`);
    });

    // Store the promise
    this.operationLocks.set(key, operationPromise);
    return operationPromise;
  }

  // Clear stuck operations
  clearStuckOperations(): void {
    const operationCount = this.operationLocks.size;
    this.operationLocks.clear();
    logger.warn(`Cleared ${operationCount} stuck operations`);
  }

  // Get operation status
  getOperationStatus(): { activeOperations: number; operationKeys: string[] } {
    return {
      activeOperations: this.operationLocks.size,
      operationKeys: Array.from(this.operationLocks.keys())
    };
  }

  // Enhanced cache strategy with better offline handling and loading states
  async getWithCache<T>(
    key: string,
    fetchFunction: () => Promise<T>,
    options: {
      language?: string;
      forceRefresh?: boolean;
      cacheDuration?: number;
      offlineFallback?: boolean;
      timeout?: number;
      onLoadingStart?: () => void;
      onLoadingEnd?: () => void;
      onCacheHit?: (data: T) => void;
      onNetworkSuccess?: (data: T) => void;
      onCacheFallback?: (data: T, error: Error) => void;
    } = {}
  ): Promise<T> {
    const { 
      language = 'en', 
      forceRefresh = false, 
      cacheDuration = CACHE_DURATION,
      offlineFallback = true,
      timeout = 30000,
      onLoadingStart,
      onLoadingEnd,
      onCacheHit,
      onNetworkSuccess,
      onCacheFallback
    } = options;

    return this.withOperationLock(key, async () => {
      // Try to load from cache first (unless force refresh)
      if (!forceRefresh) {
        const cachedData = await this.loadFromCache<T>(key, language);
        if (cachedData) {
          logger.debug(`Cache hit for ${key}`);
          onCacheHit?.(cachedData);
          return cachedData;
        }
      }

      // Check network availability
      const isOnline = await this.isNetworkAvailable();
      if (!isOnline) {
        // If offline and no cache, throw error
        const cachedData = await this.loadFromCache<T>(key, language);
        if (!cachedData) {
          throw new Error('No internet connection and no cached data available');
        }
        logger.warn(`Using stale cache for ${key} - offline mode`);
        onCacheFallback?.(cachedData, new Error('No internet connection'));
        return cachedData;
      }

      // Start loading indicator
      onLoadingStart?.();

      // Fetch fresh data from network
      logger.debug(`Fetching fresh data for ${key}`);
      try {
        const freshData = await fetchFunction();
        
        // Cache the fresh data
        await this.saveToCache(key, freshData, language, { source: 'network' });
        
        onNetworkSuccess?.(freshData);
        return freshData;
      } catch (error) {
        logger.error(`Network request failed for ${key}:`, error);
        
        // If offline fallback is enabled, try cache
        if (offlineFallback) {
          const cachedData = await this.loadFromCache<T>(key, language);
          if (cachedData) {
            logger.warn(`Using cached data as fallback for ${key}`);
            // Update cache metadata to indicate it was used due to network error
            await this.saveToCache(key, cachedData, language, { 
              source: 'cache',
              lastNetworkError: error instanceof Error ? error.message : String(error)
            });
            onCacheFallback?.(cachedData, error instanceof Error ? error : new Error(String(error)));
            return cachedData;
          }
        }
        
        throw error;
      } finally {
        // End loading indicator
        onLoadingEnd?.();
      }
    }, timeout);
  }

  // Invalidate cache when data changes
  async invalidateCache(keys: string[], language: string = 'en'): Promise<void> {
    for (const key of keys) {
      await this.clearCache(key, language);
    }
    logger.info(`Invalidated cache for keys: ${keys.join(', ')}`);
  }

  // Get cache statistics
  async getCacheStats(): Promise<{
    totalEntries: number;
    totalSize: number;
    languages: string[];
    oldestEntry: number;
    newestEntry: number;
  }> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => 
        Object.values(CACHE_KEYS).some(cacheKey => key.startsWith(cacheKey))
      );
      
      const entries = await AsyncStorage.multiGet(cacheKeys);
      const languages = new Set<string>();
      let oldestEntry = Date.now();
      let newestEntry = 0;
      
      entries.forEach(([key, value]) => {
        if (value) {
          try {
            const entry: CacheEntry<any> = JSON.parse(value);
            languages.add(entry.language);
            oldestEntry = Math.min(oldestEntry, entry.timestamp);
            newestEntry = Math.max(newestEntry, entry.timestamp);
          } catch (error) {
            // Skip invalid entries
          }
        }
      });
      
      return {
        totalEntries: cacheKeys.length,
        totalSize: cacheKeys.length, // Simplified size calculation
        languages: Array.from(languages),
        oldestEntry,
        newestEntry
      };
    } catch (error) {
      logger.error('Failed to get cache stats', error);
      return {
        totalEntries: 0,
        totalSize: 0,
        languages: [],
        oldestEntry: 0,
        newestEntry: 0
      };
    }
  }

  // Preload critical data for offline use
  async preloadCriticalData(language: string = 'en'): Promise<void> {
    logger.info('Preloading critical data for offline use');
    // This could be implemented to preload essential data
    // when the app starts or when network is available
  }
}

// Export singleton instance
export const cacheManager = CacheManager.getInstance();

// Export cache keys for external use
export { CACHE_KEYS };

// Utility function to clear stuck operations (for debugging)
export const clearStuckCacheOperations = () => {
  cacheManager.clearStuckOperations();
};

// Utility function to get cache status (for debugging)
export const getCacheStatus = () => {
  return cacheManager.getOperationStatus();
}; 