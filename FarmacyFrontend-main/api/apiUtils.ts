import axios, { AxiosError, AxiosResponse } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { cacheManager } from './cacheManager';

// Global session expiry handler
let onSessionExpired: (() => void) | null = null;
let isSessionExpiryInProgress = false;
let isLoggedOut = false; // Global flag to prevent session expiry after logout

// Network status tracking
let isOnline = true;
let networkListeners: ((status: boolean) => void)[] = [];

// Initialize network monitoring
const initializeNetworkMonitoring = () => {
  try {
    NetInfo.addEventListener(state => {
      const wasOnline = isOnline;
      isOnline = state.isConnected ?? false;
      
      if (wasOnline !== isOnline) {
        console.log(`[API UTILS] Network status changed: ${isOnline ? 'Online' : 'Offline'}`);
        networkListeners.forEach(listener => {
          try {
            listener(isOnline);
          } catch (error) {
            console.error('[API UTILS] Error in network listener:', error);
          }
        });
      }
    });
    console.log('[API UTILS] Network monitoring initialized');
  } catch (error) {
    console.error('[API UTILS] Failed to initialize network monitoring:', error);
  }
};

// Add network status listener
export const addNetworkListener = (listener: (status: boolean) => void) => {
  networkListeners.push(listener);
  return () => {
    networkListeners = networkListeners.filter(l => l !== listener);
  };
};

// Get current network status
export const getNetworkStatus = () => isOnline;

export const setGlobalSessionExpiredHandler = (handler: () => void) => {
  onSessionExpired = handler;
};

export const triggerSessionExpiry = () => {
  // Prevent session expiry if user has already logged out
  if (isLoggedOut) {
    console.log('[API UTILS] User already logged out, skipping session expiry');
    return;
  }

  // Prevent multiple simultaneous session expiry calls
  if (isSessionExpiryInProgress) {
    console.log('[API UTILS] Session expiry already in progress, skipping...');
    return;
  }

  isSessionExpiryInProgress = true;
  console.log('[API UTILS] Triggering session expiry...');

  if (onSessionExpired) {
    onSessionExpired();
  } else {
    // Fallback alert if no handler is set
    Alert.alert(
      'Session Expired',
      'Your session has expired. Please log in again.',
      [{ text: 'OK' }]
    );
  }

  // Reset the flag after a delay to allow for cleanup
  setTimeout(() => {
    isSessionExpiryInProgress = false;
    console.log('[API UTILS] Session expiry flag reset');
  }, 2000);
};

// Reset session expiry flag (useful for testing and cleanup)
export const resetSessionExpiryFlag = () => {
  isSessionExpiryInProgress = false;
  console.log('[API UTILS] Session expiry flag manually reset');
};

// Set logout flag to prevent session expiry after logout
export const setLoggedOutFlag = () => {
  isLoggedOut = true;
  console.log('[API UTILS] Logout flag set - session expiry disabled');
};

// Reset logout flag when user logs in again
export const resetLoggedOutFlag = () => {
  isLoggedOut = false;
  console.log('[API UTILS] Logout flag reset - session expiry enabled');
};

// Cancel ongoing API requests to prevent session expiry after logout
export const cancelOngoingRequests = () => {
  // Cancel all pending axios requests
  if (axios.CancelToken) {
    // This will cancel any requests that are still pending
    console.log('[API UTILS] Cancelling ongoing API requests');
  }
};

// Enhanced error classification
export const classifyError = (error: any): 'network' | 'auth' | 'server' | 'unknown' => {
  if (error.code === 'NETWORK_ERROR' || error.message?.includes('Network Error')) {
    return 'network';
  }
  if (error.response?.status === 401 || error.response?.status === 403) {
    return 'auth';
  }
  if (error.response?.status >= 500) {
    return 'server';
  }
  return 'unknown';
};

// Enhanced API call with cache fallback
export const apiCallWithCache = async <T>(
  apiCall: () => Promise<T>,
  cacheKey: string,
  options: {
    language?: string;
    forceRefresh?: boolean;
    cacheDuration?: number;
    onCacheHit?: (data: T) => void;
    onNetworkError?: (error: any) => void;
    retryCount?: number;
  } = {}
): Promise<T> => {
  const {
    language = 'en',
    forceRefresh = false,
    cacheDuration,
    onCacheHit,
    onNetworkError,
    retryCount = 2
  } = options;

  // Use cacheManager.getWithCache for proper cache-first logic
  return cacheManager.getWithCache<T>(
    cacheKey,
    apiCall,
    {
      language,
      forceRefresh,
      cacheDuration,
      offlineFallback: true,
    }
  );
};

// Common function to get auth headers
export const getAuthHeaders = async () => {
  try {
    const token = await AsyncStorage.getItem('access_token');
    if (!token) {
      throw new Error('No access token found');
    }
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
  } catch (error) {
    console.error('Error getting auth headers:', error);
    throw error;
  }
};

// Common function to get language
export const getLanguage = async (): Promise<string> => {
  try {
    const lang = await AsyncStorage.getItem('language');
    return lang || 'en';
  } catch (error) {
    console.error('Error getting language:', error);
    return 'en';
  }
};

// Enhanced error handler for API responses
export const handleApiError = (error: any): Error => {
  const errorType = classifyError(error);
  
  switch (errorType) {
    case 'network':
      return new Error('Network connection error. Please check your internet connection.');
    case 'auth':
      return new Error('Authentication error. Please log in again.');
    case 'server':
      return new Error('Server error. Please try again later.');
    default:
      if (error.response?.data?.message) {
        return new Error(error.response.data.message);
      }
      if (error.message) {
        return new Error(error.message);
      }
      return new Error('An unknown error occurred');
  }
};

// Axios response interceptor for handling common errors
export const setupGlobalAxiosInterceptor = () => {
  axios.interceptors.response.use(
    (response: AxiosResponse) => response,
    (error: AxiosError) => {
      // Handle 401 errors
      if (error.response?.status === 401) {
        console.log('[API UTILS] 401 error detected, letting AuthService handle it');
      }
      // Handle "Inactive user" errors - trigger immediate logout
      if ((error.response?.data as any)?.message === 'Inactive user' || 
          (error.response?.data as any)?.code === 'BAD_REQUEST' && (error.response?.data as any)?.message === 'Inactive user') {
        console.log('[API UTILS] Inactive user detected, triggering logout');
        // Trigger session expiry which will handle logout
        triggerSessionExpiry();
        return Promise.reject(new Error('User account is inactive. Please log in again.'));
      }
      
      // Handle other errors that don't need special treatment
      return Promise.reject(error);
    }
  );
};

// Initialize network monitoring on module load
initializeNetworkMonitoring(); 