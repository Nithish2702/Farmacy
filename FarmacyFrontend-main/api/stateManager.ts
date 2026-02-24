import { cacheManager, CACHE_KEYS } from './cacheManager';
import { apiCallWithCache, getNetworkStatus, addNetworkListener } from './apiUtils';

export interface StateManagerConfig {
  enableOfflineMode?: boolean;
  cacheDuration?: number;
  retryAttempts?: number;
  backgroundSync?: boolean;
}

export interface DataState<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: number | null;
  isOffline: boolean;
  source: 'network' | 'cache' | null;
}

export interface StateManagerCallbacks {
  onNetworkStatusChange?: (isOnline: boolean) => void;
  onDataUpdate?: <T>(key: string, data: T, source: 'network' | 'cache') => void;
  onError?: (key: string, error: any) => void;
  onCacheHit?: <T>(key: string, data: T) => void;
}

class StateManager {
  private static instance: StateManager;
  private config: StateManagerConfig;
  private callbacks: StateManagerCallbacks = {};
  private dataStates: Map<string, DataState<any>> = new Map();
  private networkStatus: boolean = true;
  private isInitialized: boolean = false;

  private constructor(config: StateManagerConfig = {}) {
    this.config = {
      enableOfflineMode: true,
      cacheDuration: 60 * 60 * 1000, // 1 hour
      retryAttempts: 2,
      backgroundSync: true,
      ...config
    };
  }

  static getInstance(config?: StateManagerConfig): StateManager {
    if (!StateManager.instance) {
      StateManager.instance = new StateManager(config);
    }
    return StateManager.instance;
  }

  // Initialize the state manager
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    console.log('[STATE MANAGER] Initializing...');
    
    try {
      // Set up network monitoring
      addNetworkListener((isOnline) => {
        this.networkStatus = isOnline;
        this.handleNetworkStatusChange(isOnline);
      });

      // Get initial network status
      this.networkStatus = getNetworkStatus();
      
      this.isInitialized = true;
      console.log('[STATE MANAGER] Initialized successfully');
    } catch (error) {
      console.error('[STATE MANAGER] Initialization failed:', error);
      // Still mark as initialized to prevent retry loops
      this.isInitialized = true;
    }
  }

  // Set callbacks for state changes
  setCallbacks(callbacks: StateManagerCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  // Handle network status changes
  private handleNetworkStatusChange(isOnline: boolean): void {
    console.log(`[STATE MANAGER] Network status changed: ${isOnline ? 'Online' : 'Offline'}`);
    
    // Update all data states
    this.dataStates.forEach((state, key) => {
      state.isOffline = !isOnline;
    });

    // Notify callback
    this.callbacks.onNetworkStatusChange?.(isOnline);

    // Trigger background sync when coming back online
    if (isOnline && this.config.backgroundSync) {
      this.triggerBackgroundSync();
    }
  }

  // Trigger background sync for all cached data
  private async triggerBackgroundSync(): Promise<void> {
    console.log('[STATE MANAGER] Triggering background sync...');
    
    // This could be implemented to refresh all critical data
    // when network is restored
  }

  // Get or create data state for a key
  getDataState<T>(key: string): DataState<T> {
    if (!this.dataStates.has(key)) {
      this.dataStates.set(key, {
        data: null,
        isLoading: false,
        error: null,
        lastUpdated: null,
        isOffline: !this.networkStatus,
        source: null
      });
    }
    return this.dataStates.get(key) as DataState<T>;
  }

  // Update data state
  private updateDataState<T>(
    key: string, 
    updates: Partial<DataState<T>>
  ): void {
    const currentState = this.getDataState<T>(key);
    const newState = { ...currentState, ...updates };
    this.dataStates.set(key, newState);
    
    // Notify callback
    if (newState.data && newState.source) {
      this.callbacks.onDataUpdate?.(key, newState.data, newState.source);
    }
  }

  // Enhanced data fetching with state management and proper loading states
  async fetchData<T>(
    key: string,
    apiCall: () => Promise<T>,
    options: {
      language?: string;
      forceRefresh?: boolean;
      cacheKey?: string;
      onSuccess?: (data: T, source: 'network' | 'cache') => void;
      onError?: (error: any) => void;
      onLoadingStart?: () => void;
      onLoadingEnd?: () => void;
      onCacheHit?: (data: T) => void;
      onCacheFallback?: (data: T, error: Error) => void;
    } = {}
  ): Promise<T> {
    const {
      language = 'en',
      forceRefresh = false,
      cacheKey = key,
      onSuccess,
      onError,
      onLoadingStart,
      onLoadingEnd,
      onCacheHit,
      onCacheFallback
    } = options;

    // Only show loading state if we're forcing refresh or don't have cached data
    const shouldShowLoading = forceRefresh || !this.getDataState(key).data;
    
    if (shouldShowLoading) {
      this.updateDataState(key, { isLoading: true, error: null });
      onLoadingStart?.();
    }

    try {
      // Use the enhanced API call with cache
      const data = await apiCallWithCache(
        apiCall,
        cacheKey,
        {
          language,
          forceRefresh,
          cacheDuration: this.config.cacheDuration,
          retryCount: this.config.retryAttempts,
          onCacheHit: (cachedData) => {
            console.log(`[STATE MANAGER] Cache hit for ${key}`);
            this.updateDataState(key, {
              data: cachedData,
              isLoading: false,
              lastUpdated: Date.now(),
              source: 'cache'
            });
            this.callbacks.onCacheHit?.(key, cachedData);
            onCacheHit?.(cachedData);
            onSuccess?.(cachedData, 'cache');
          },
          onNetworkError: (error) => {
            console.log(`[STATE MANAGER] Network error for ${key}:`, error);
            this.callbacks.onError?.(key, error);
            onError?.(error);
          }
        }
      );

      // Update state with successful data
      this.updateDataState(key, {
        data,
        isLoading: false,
        lastUpdated: Date.now(),
        source: 'network'
      });

      onSuccess?.(data, 'network');
      return data;

    } catch (error) {
      console.error(`[STATE MANAGER] Error fetching data for ${key}:`, error);
      
      // Check if we have cached data to fall back to
      const currentState = this.getDataState<T>(key);
      if (currentState.data && !forceRefresh) {
        console.log(`[STATE MANAGER] Falling back to cached data for ${key}`);
        this.updateDataState(key, {
          isLoading: false,
          source: 'cache'
        });
        onCacheFallback?.(currentState.data, error instanceof Error ? error : new Error(String(error)));
        return currentState.data;
      }
      
      // Update error state
      this.updateDataState(key, {
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      this.callbacks.onError?.(key, error);
      onError?.(error);
      throw error;
    } finally {
      if (shouldShowLoading) {
        onLoadingEnd?.();
      }
    }
  }

  // Get current data state (alias for consistency)
  getCurrentDataState<T>(key: string): DataState<T> {
    return this.getDataState<T>(key);
  }

  // Get all data states
  getAllDataStates(): Map<string, DataState<any>> {
    return new Map(this.dataStates);
  }

  // Clear specific data state
  clearDataState(key: string): void {
    this.dataStates.delete(key);
    console.log(`[STATE MANAGER] Cleared data state for ${key}`);
  }

  // Clear all data states
  clearAllDataStates(): void {
    this.dataStates.clear();
    console.log('[STATE MANAGER] Cleared all data states');
  }

  // Refresh specific data
  async refreshData<T>(
    key: string,
    apiCall: () => Promise<T>,
    options: { language?: string; cacheKey?: string } = {}
  ): Promise<T> {
    return this.fetchData(key, apiCall, { ...options, forceRefresh: true });
  }

  // Batch refresh multiple data sources
  async refreshMultipleData(
    dataSources: Array<{
      key: string;
      apiCall: () => Promise<any>;
      options?: { language?: string; cacheKey?: string };
    }>
  ): Promise<void> {
    console.log(`[STATE MANAGER] Refreshing ${dataSources.length} data sources`);
    
    const promises = dataSources.map(({ key, apiCall, options }) =>
      this.fetchData(key, apiCall, options).catch(error => {
        console.error(`[STATE MANAGER] Failed to refresh ${key}:`, error);
        return null;
      })
    );

    await Promise.allSettled(promises);
    console.log('[STATE MANAGER] Batch refresh completed');
  }

  // Preload critical data for offline use
  async preloadCriticalData(language: string = 'en'): Promise<void> {
    console.log('[STATE MANAGER] Preloading critical data...');
    
    // This could be implemented to preload essential data
    // when the app starts or when network is available
    await cacheManager.preloadCriticalData(language);
  }

  // Get cache statistics
  async getCacheStats() {
    return cacheManager.getCacheStats();
  }

  // Clear all cache
  async clearAllCache(language?: string): Promise<void> {
    if (language) {
      await cacheManager.clearAllCache(language);
    } else {
      await cacheManager.clearAllCacheGlobally();
    }
    console.log('[STATE MANAGER] Cache cleared');
  }

  // Check if data is stale
  isDataStale(key: string, maxAge: number = this.config.cacheDuration!): boolean {
    const state = this.getDataState(key);
    if (!state.lastUpdated) return true;
    return Date.now() - state.lastUpdated > maxAge;
  }

  // Get network status
  isOnline(): boolean {
    return this.networkStatus;
  }

  // Force offline mode (for testing)
  setOfflineMode(enabled: boolean): void {
    this.networkStatus = !enabled;
    this.handleNetworkStatusChange(this.networkStatus);
  }
}

// Export singleton instance
export const stateManager = StateManager.getInstance(); 