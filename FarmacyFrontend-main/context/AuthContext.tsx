import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactElement } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authService, TokenResponse } from '../api/authService';
import { msg91OtpService, MSG91VerifyResponse, CreateUserRequest } from '../api/msg91OtpService';
import i18n from '@/i18n.config';
import NetInfo from '@react-native-community/netinfo';
import { Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { setGlobalSessionExpiredHandler, setupGlobalAxiosInterceptor, resetSessionExpiryFlag, setLoggedOutFlag, resetLoggedOutFlag, cancelOngoingRequests, getNetworkStatus, addNetworkListener } from '../api/apiUtils';
import { cropService } from '@/api/cropService';
import { cropTrackingService } from '@/api/cropTrackService';
import { CACHE_KEYS } from '@/api/cacheManager';
import { stateManager, DataState } from '@/api/stateManager';

interface User {
  id: number;
  username: string;
  email: string;
  phone_number: string;
  farm_type: string;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  logout: () => Promise<void>;
  language: string;
  selectLanguage: (lang: string) => void;
  syncUserData: () => Promise<void>;
  isInitialized: boolean;
  initializeAfterAuth: () => Promise<void>;
  // Phone OTP authentication methods
  sendOTP: (phoneNumber: string) => Promise<void>;
  verifyOTP: (phoneNumber: string, otp: string) => Promise<{ isAuthenticated: boolean; needsProfile: boolean }>;
  createUser: (userData: CreateUserRequest) => Promise<void>;
  phoneNumber: string | null;
  otpSent: boolean;
  otpVerified: boolean;
  isOtpInProgress: boolean;
  // Auth success callback methods
  registerAuthSuccessCallback: (callback: () => void) => void;
  unregisterAuthSuccessCallback: (callback: () => void) => void;
  // Enhanced state management
  userDataState: DataState<User>;
  isOnline: boolean;
  refreshUserData: () => Promise<void>;
  // Reset loading state
  resetAuthLoading: () => void;
  // Legacy methods for backward compatibility
  login: (email: string, password: string) => Promise<void>;
  register: (userData: any) => Promise<void>;
  refreshAuth: () => Promise<void>;
}

// Create the context with default values
const AuthContext = createContext<AuthContextType | null>(null);

// Export the useAuth hook
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Safe version of useAuth that doesn't throw if context is not ready
export const useAuthSafe = () => {
  const context = useContext(AuthContext);
  return context;
};

// Cache configuration
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
const USER_CACHE_KEY = 'cached_user_data_v2';
const LAST_SYNC_KEY = 'last_user_sync_v2';
const AUTH_TOKENS_KEY = 'auth_tokens_v2';

// Logging utility
const logger = {
  info: (message: string, data?: any) => console.log(`[AUTH] ${message}`, data || ''),
  error: (message: string, error?: any) => console.error(`[AUTH ERROR] ${message}`, error || ''),
  warn: (message: string, data?: any) => console.warn(`[AUTH WARN] ${message}`, data || ''),
  debug: (message: string, data?: any) => console.log(`[AUTH DEBUG] ${message}`, data || '')
};

// Add token storage utility
const storeTokens = async (tokens: TokenResponse): Promise<void> => {
  try {
    await AsyncStorage.multiSet([
      ['access_token', tokens.access_token],
      ['refresh_token', tokens.refresh_token],
      [AUTH_TOKENS_KEY, JSON.stringify(tokens)]
    ]);
    logger.info('Tokens stored successfully');
  } catch (error) {
    logger.error('Failed to store tokens', error);
    throw error;
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [language, setLanguage] = useState('en');
  const [isInitialized, setIsInitialized] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const navigationRef = useRef<any>(null);

  // Phone OTP authentication state
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [isOtpInProgress, setIsOtpInProgress] = useState(false);

  // Operation locks to prevent race conditions
  const operationLocks = useRef<Map<string, Promise<any>>>(new Map());
  const initializationRef = useRef<Promise<void> | null>(null);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMounted = useRef(true);
  const isSessionExpiryHandlerRunning = useRef(false);
  const onAuthSuccessCallbacks = useRef<Set<() => void>>(new Set());

  // Initialize state manager
  useEffect(() => {
    const initializeStateManager = async () => {
      await stateManager.initialize();
      
      // Set up callbacks for state manager
      stateManager.setCallbacks({
        onNetworkStatusChange: (online) => {
          setIsOnline(online);
          logger.info(`Network status changed: ${online ? 'Online' : 'Offline'}`);
        },
        onDataUpdate: (key, data, source) => {
          if (key === 'user_data' && data) {
            setUser(data as unknown as User);
            logger.info(`User data updated from ${source}`);
          }
        },
        onError: (key, error) => {
          logger.error(`State manager error for ${key}:`, error);
        },
        onCacheHit: (key, data) => {
          if (key === 'user_data') {
            logger.info('User data loaded from cache');
          }
        }
      });
    };

    initializeStateManager();
  }, []);

  // Get user data state from state manager
  const userDataState = stateManager.getDataState('user_data') as DataState<User>;

  // Register callback to be called after successful authentication
  const registerAuthSuccessCallback = useCallback((callback: () => void) => {
    onAuthSuccessCallbacks.current.add(callback);
    logger.debug('Auth success callback registered');
  }, []);

  // Unregister callback
  const unregisterAuthSuccessCallback = useCallback((callback: () => void) => {
    onAuthSuccessCallbacks.current.delete(callback);
    logger.debug('Auth success callback unregistered');
  }, []);

  // Trigger all auth success callbacks
  const triggerAuthSuccessCallbacks = useCallback(() => {
    logger.info('Triggering auth success callbacks...');
    onAuthSuccessCallbacks.current.forEach(callback => {
      try {
        callback();
      } catch (error) {
        logger.error('Error in auth success callback:', error);
      }
    });
  }, []);

  // Operation lock utility
  const withOperationLock = useCallback(<T,>(
    key: string,
    operation: () => Promise<T>
  ): Promise<T> => {
    logger.debug(`Attempting auth operation lock: ${key}`);
    
    if (operationLocks.current.has(key)) {
      logger.debug(`Auth operation ${key} already in progress, waiting...`);
      try {
        return operationLocks.current.get(key) as Promise<T>;
      } catch (error) {
        logger.error(`Waiting for auth operation ${key} failed`, error);
        throw error;
      }
    }

    const operationPromise = (async () => {
      try {
        logger.debug(`Starting auth operation: ${key}`);
        const result = await operation();
        logger.debug(`Completed auth operation: ${key}`);
        return result;
      } catch (error) {
        logger.error(`Failed auth operation: ${key}`, error);
        throw error;
      } finally {
        operationLocks.current.delete(key);
        logger.debug(`Released auth lock: ${key}`);
      }
    })();

    operationLocks.current.set(key, operationPromise);
    return operationPromise;
  }, []);

  // Enhanced user data fetching with state management
  const fetchUserData = useCallback(async (): Promise<User> => {
    return stateManager.fetchData('user_data', async () => {
      const userData = await authService.getCurrentUser();
      if (!userData) {
        throw new Error('Failed to fetch user data from server');
      }
      return userData;
    }, {
      cacheKey: CACHE_KEYS.USER_DATA,
      onSuccess: (data, source) => {
        logger.info(`User data fetched successfully from ${source}`);
        setUser(data);
        if (source === 'network') {
          setIsAuthenticated(true);
        }
      },
      onError: (error) => {
        logger.error('Failed to fetch user data:', error);
        // Don't clear authentication state on network errors
        // Only clear on auth errors
        if (error?.response?.status === 401) {
          setIsAuthenticated(false);
          setUser(null);
        }
      }
    });
  }, []);

  // Enhanced sync user data
  const syncUserData = useCallback(async () => {
    return withOperationLock('sync_user_data', async () => {
      try {
        // Check if we have valid tokens before attempting to sync
        const [accessToken, refreshToken] = await Promise.all([
          AsyncStorage.getItem('access_token'),
          AsyncStorage.getItem('refresh_token')
        ]);
        
        if (!accessToken || !refreshToken) {
          logger.warn('No valid tokens available, skipping user data sync');
          throw new Error('No valid tokens available');
        }
        
        console.log('🔐 AuthContext: Syncing user data...');
        await fetchUserData();
        console.log('🔐 AuthContext: User data synced successfully');
        
        setIsAuthenticated(true);
        setIsInitialized(true);
      } catch (error) {
        console.error('🔐 AuthContext: Failed to sync user data:', error);
        logger.error('Failed to sync user data:', error);
        throw error;
      }
    });
  }, [fetchUserData, withOperationLock]);

  // Refresh user data
  const refreshUserData = useCallback(async () => {
    return stateManager.refreshData('user_data', async () => {
      const userData = await authService.getCurrentUser();
      if (!userData) {
        throw new Error('Failed to refresh user data from server');
      }
      return userData;
    }, {
      cacheKey: CACHE_KEYS.USER_DATA
    });
  }, []);

  // Enhanced logout with comprehensive cleanup
  const logout = useCallback(async () => {
    return withOperationLock('logout', async () => {
      try {
        logger.info('Starting logout process...');
        
        // Clear all state manager data first
        stateManager.clearAllDataStates();
        
        // Clear all cache
        await stateManager.clearAllCache();
        
        // Clear MSG91 reqId
        msg91OtpService.clearReqId();
        
        // Clear all authentication and user-related data from AsyncStorage
        const keysToRemove = [
          'user_info',
          'user_profile', 
          'user_preferences',
          'auth_tokens',
          'auth_state',
          'otp_data',
          'phone_number',
          'otp_verified',
          'otp_sent',
          'req_id',
          'msg91_current_req_id',
          'cached_user_data',
          'cached_crops',
          'cached_notifications',
          'cached_weather',
          'cached_news',
          'fcm_token',
          'device_token',
          'notification_settings',
          'app_settings',
          'last_sync_timestamp',
          'session_data',
          'login_state',
          'auth_flow_state',
          'logout_flag',
          'device_registered',
          'notifications_cache',
          'unread_count_cache'
        ];
        
        // Remove all specified keys
        await Promise.all(keysToRemove.map(key => AsyncStorage.removeItem(key)));
        
        // Dynamically find and clear any other auth-related keys
        const allKeys = await AsyncStorage.getAllKeys();
        const authRelatedKeys = allKeys.filter(key => 
          key.includes('auth') || 
          key.includes('user') || 
          key.includes('token') || 
          key.includes('otp') || 
          key.includes('session') || 
          key.includes('login') ||
          key.includes('logout') ||
          key.includes('device') ||
          key.includes('notification') ||
          key.includes('cache')
        );
        
        if (authRelatedKeys.length > 0) {
          await Promise.all(authRelatedKeys.map(key => AsyncStorage.removeItem(key)));
          logger.info(`Cleared ${authRelatedKeys.length} additional auth-related keys`);
        }
        
        // Call backend logout to clear server-side session
        try {
          await authService.logout();
          logger.info('Backend logout successful');
        } catch (error) {
          logger.warn('Backend logout failed, but continuing with local cleanup:', error);
        }
        
        // Reset all local state synchronously
        setIsAuthenticated(false);
        setUser(null);
        setPhoneNumber('');
        setOtpSent(false);
        setOtpVerified(false);
        setIsOtpInProgress(false);
        setLanguage('en');
        
        // Clear auth success callbacks
        onAuthSuccessCallbacks.current.clear();
        
        // Force navigation to welcome screen
        router.replace('/welcome');
        
        logger.info('Logout completed successfully');
        
      } catch (error) {
        logger.error('Error during logout:', error);
        // Even if there's an error, try to reset state and navigate
        setIsAuthenticated(false);
        setUser(null);
        router.replace('/welcome');
      }
    });
  }, [withOperationLock, stateManager, msg91OtpService, authService]);

  // Enhanced language selection with backend sync
  const selectLanguage = useCallback(async (lang: string) => {
    try {
      logger.info(`Language change requested: ${language} -> ${lang}`);
      
      // Update local state immediately
      setLanguage(lang);
      await AsyncStorage.setItem('language', lang);
      
      // Update i18n
      await i18n.changeLanguage(lang);
      
      // Sync with backend if user is authenticated
      if (isAuthenticated && user) {
        try {
          await authService.updateUserLanguage(lang);
          logger.info('Language synced with backend');
        } catch (backendError) {
          logger.warn('Failed to sync language with backend:', backendError);
          // Don't throw error - local change is still valid
        }
      }
      
      logger.info('Language change completed successfully');
    } catch (error) {
      logger.error('Failed to change language:', error);
      throw error;
    }
  }, [language, isAuthenticated, user, i18n]);

  // Initialize auth state with enhanced error handling
  const initializeAuth = useCallback(async () => {
    if (initializationRef.current) {
      logger.debug('Auth initialization already in progress, waiting...');
      await initializationRef.current;
      return;
    }

    initializationRef.current = (async () => {
      try {
        setIsLoading(true);
        logger.info('Initializing auth state...');

        // Check if tokens exist
        const [accessToken, refreshToken] = await Promise.all([
          AsyncStorage.getItem('access_token'),
          AsyncStorage.getItem('refresh_token')
        ]);
        console.log('🔐 AuthContext: Tokens check - accessToken:', !!accessToken, 'refreshToken:', !!refreshToken);

        // Check network connectivity
        const networkStatus = getNetworkStatus();
        setIsOnline(networkStatus);
        logger.info(`Network status: ${networkStatus ? 'Online' : 'Offline'}`);

        // If we have valid tokens, try to fetch user data
        if (accessToken && refreshToken) {
          logger.info('Valid tokens found, attempting to fetch user data');
          
          try {
            const userData = await fetchUserData();
            if (userData) {
              logger.info('User data fetched successfully');
              setIsAuthenticated(true);
              setIsInitialized(true);
              resetLoggedOutFlag();
              return;
            }
          } catch (error: any) {
            logger.error('Failed to fetch user data:', error);
            
            // Handle different error types
            if (error?.response?.status === 401) {
              logger.warn('Auth error, clearing tokens and requiring re-login');
              await logout();
              return;
            }
            
            // For network errors, try to load from cache
            if (error.message?.includes('Network Error') || !networkStatus) {
              logger.warn('Network error, attempting to load from cache');
              const cachedUser = await stateManager.getDataState<User>('user_data');
              if (cachedUser.data) {
                logger.info('Using cached user data');
                setUser(cachedUser.data);
                setIsAuthenticated(true);
                setIsInitialized(true);
                return;
              }
            }
          }
        }

        // If we reach here, user needs to log in
        logger.warn('No valid authentication, user needs to log in');
        setIsAuthenticated(false);
        setUser(null);
        setIsInitialized(true);

      } catch (error) {
        logger.error('Error during auth initialization:', error);
        setIsAuthenticated(false);
        setUser(null);
        setIsInitialized(true);
      } finally {
        setIsLoading(false);
        initializationRef.current = null;
      }
    })();

    await initializationRef.current;
  }, [fetchUserData, logout]);

  // Initialize after authentication
  const initializeAfterAuth = useCallback(async () => {
    return withOperationLock('initialize_after_auth', async () => {
      try {
        logger.info('Initializing after authentication...');
        // Fetch user data
        await fetchUserData();
        // Preload critical data
        await stateManager.preloadCriticalData(language);
        // Trigger auth success callbacks
        triggerAuthSuccessCallbacks();
        logger.info('Post-auth initialization completed');
      } catch (error) {
        logger.error('Error during post-auth initialization:', error);
        
        // Handle "Inactive user" error specifically
        const errorMessage = (error as any)?.response?.data?.message || (error as any)?.message || '';
        const errorCode = (error as any)?.response?.data?.code || (error as any)?.code || '';
        
        if (errorMessage === 'Inactive user' || 
            errorMessage.includes('Inactive user') ||
            (errorCode === 'BAD_REQUEST' && errorMessage === 'Inactive user')) {
          logger.warn('Inactive user detected during post-auth initialization, triggering logout');
          // Force logout to clear all state
          await logout();
          throw new Error('User account is inactive. Please log in again.');
        }
        
        throw error;
      }
    });
  }, [fetchUserData, language, triggerAuthSuccessCallbacks, withOperationLock]);

  // Phone OTP authentication methods using MSG91
  const sendOTP = useCallback(async (phone: string) => {
    return withOperationLock('send_otp', async () => {
      try {
        setIsOtpInProgress(true);
        setPhoneNumber(phone);
        setOtpSent(false);
        setOtpVerified(false);
        
        const result = await msg91OtpService.sendOTP(phone);
        if (result.success) {
          setOtpSent(true);
          setOtpVerified(false);
          logger.info('MSG91 OTP sent successfully');
        } else {
          throw new Error(result.message);
        }
      } catch (error) {
        logger.error('Failed to send MSG91 OTP:', error);
        setOtpSent(false);
        setOtpVerified(false);
        setPhoneNumber(null);
        // Clear reqId on error
        await msg91OtpService.clearReqId();
        throw error;
      } finally {
        setIsOtpInProgress(false);
      }
    });
  }, [withOperationLock]);

  const verifyOTP = useCallback(async (phone: string, otp: string): Promise<{ isAuthenticated: boolean; needsProfile: boolean }> => {
    return withOperationLock('verify_otp', async () => {
      try {
        setIsOtpInProgress(true);
        setOtpVerified(false); // Reset verification state
        
        const result: MSG91VerifyResponse = await msg91OtpService.completeVerification(otp);
        
        if (result.success) {
          setOtpVerified(true);
          
          // Store tokens if provided
          if (result.access_token && result.refresh_token) {
            await storeTokens({
              access_token: result.access_token,
              refresh_token: result.refresh_token,
              token_type: 'bearer'
            });
          }
          
          // Check if user exists
          if (result.user_exists) {
            // Existing user - authenticate and go to dashboard
            await initializeAfterAuth();
            setIsAuthenticated(true);
            setIsOtpInProgress(false);
            
            // Note: Device registration is handled by NotificationsContext when auth state changes
            
            logger.info('Existing user authenticated, redirecting to dashboard');
            return { isAuthenticated: true, needsProfile: false };
          } else {
            // New user - needs profile completion
            setIsAuthenticated(false);
            setIsOtpInProgress(false);
            logger.info('New user detected, redirecting to welcome page for profile completion');
            return { isAuthenticated: false, needsProfile: true };
          }
        } else {
          setIsOtpInProgress(false);
          throw new Error(result.message || 'Failed to verify OTP');
        }
      } catch (error) {
        logger.error('Failed to verify MSG91 OTP:', error);
        setOtpVerified(false);
        setIsOtpInProgress(false);
        
        // Handle "Inactive user" error specifically
        const errorMessage = (error as any)?.response?.data?.message || (error as any)?.message || '';
        const errorCode = (error as any)?.response?.data?.code || (error as any)?.code || '';
        
        if (errorMessage === 'Inactive user' || 
            errorMessage.includes('Inactive user') ||
            (errorCode === 'BAD_REQUEST' && errorMessage === 'Inactive user')) {
          logger.warn('Inactive user detected during OTP verification, triggering logout');
          // Force logout to clear all state
          await logout();
          throw new Error('User account is inactive. Please log in again.');
        }
        
        throw error;
      }
    });
  }, [initializeAfterAuth, withOperationLock]);

  // Create user method for new users after MSG91 verification
  const createUser = useCallback(async (userData: CreateUserRequest) => {
    return withOperationLock('create_user', async () => {
      try {
        setIsOtpInProgress(true);
        
        const result: MSG91VerifyResponse = await msg91OtpService.createUser(userData);
        
        if (result.success && result.access_token && result.refresh_token) {
          // Store tokens
          await storeTokens({
            access_token: result.access_token,
            refresh_token: result.refresh_token,
            token_type: 'bearer'
          });
          
          // Initialize after user creation
          await initializeAfterAuth();
          setIsAuthenticated(true);
          setIsOtpInProgress(false);
          
          // Note: Device registration is handled by NotificationsContext when auth state changes
          
          logger.info('New user created successfully');
        } else {
          throw new Error(result.message || 'Failed to create user');
        }
      } catch (error) {
        logger.error('Failed to create user:', error);
        setIsOtpInProgress(false);
        
        // Handle "Inactive user" error specifically
        const errorMessage = (error as any)?.response?.data?.message || (error as any)?.message || '';
        const errorCode = (error as any)?.response?.data?.code || (error as any)?.code || '';
        
        if (errorMessage === 'Inactive user' || 
            errorMessage.includes('Inactive user') ||
            (errorCode === 'BAD_REQUEST' && errorMessage === 'Inactive user')) {
          logger.warn('Inactive user detected during user creation, triggering logout');
          // Force logout to clear all state
          await logout();
          throw new Error('User account is inactive. Please log in again.');
        }
        
        throw error;
      }
    });
  }, [initializeAfterAuth, withOperationLock]);

  // Legacy methods for backward compatibility
  const login = useCallback(async (email: string, password: string) => {
    return withOperationLock('login', async () => {
      try {
        const tokens = await authService.login({ email, password });
        await storeTokens(tokens);
        await fetchUserData();
        setIsAuthenticated(true);
        logger.info('User logged in successfully');
      } catch (error) {
        logger.error('Login failed:', error);
        throw error;
      }
    });
  }, [withOperationLock, fetchUserData]);

  const register = useCallback(async (userData: any) => {
    return withOperationLock('register', async () => {
      try {
        await authService.signup(userData);
        // For signup, we need to login after successful registration
        const tokens = await authService.login({ 
          email: userData.email, 
          password: userData.password 
        });
        await storeTokens(tokens);
        await fetchUserData();
        setIsAuthenticated(true);
        logger.info('User registered successfully');
      } catch (error) {
        logger.error('Registration failed:', error);
        throw error;
      }
    });
  }, [withOperationLock, fetchUserData]);

  const refreshAuth = useCallback(async () => {
    return withOperationLock('refresh_auth', async () => {
      try {
        await authService.refreshAccessToken();
        await fetchUserData();
        logger.info('Auth refreshed successfully');
      } catch (error) {
        logger.error('Auth refresh failed:', error);
        throw error;
      }
    });
  }, [withOperationLock, fetchUserData]);

  // Reset loading state
  const resetAuthLoading = useCallback(() => {
    logger.info('Resetting auth loading states');
    setIsLoading(false);
    setIsOtpInProgress(false);
    setOtpSent(false);
    setOtpVerified(false);
    setPhoneNumber(null);
  }, []);

  // Set up session expiry handler
  useEffect(() => {
    setGlobalSessionExpiredHandler(() => {
      if (isSessionExpiryHandlerRunning.current) {
        logger.warn('Session expiry handler already running, skipping...');
        return;
      }
      isSessionExpiryHandlerRunning.current = true;
      logger.info('Session expired, logging out...');
      // --- Synchronous state reset: ensure all auth/OTP state is cleared immediately ---
      setIsAuthenticated(false);
      setUser(null);
      setIsInitialized(true);
      setPhoneNumber(null);
      setOtpSent(false);
      setOtpVerified(false);
      setIsOtpInProgress(false);
      // --- End synchronous state reset ---
      logout().finally(() => {
        isSessionExpiryHandlerRunning.current = false;
        // (State already reset above)
        Alert.alert(
          'Logged out',
          'You have been logged out because your account was accessed from another device.',
          [
            {
              text: 'OK',
              onPress: () => {
                setTimeout(() => {
                  router.replace('/welcome');
                }, 100);
              }
            }
          ]
        );
      });
    });
    return () => {
      setGlobalSessionExpiredHandler(() => {});
    };
  }, [logout, router]);

  // Initialize auth on mount
  useEffect(() => {
    if (isMounted.current) {
      initializeAuth();
    }

    return () => {
      isMounted.current = false;
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [initializeAuth]);

  // Load language on mount
  useEffect(() => {
    const loadLanguage = async () => {
      try {
        const savedLanguage = await AsyncStorage.getItem('language');
        if (savedLanguage) {
          setLanguage(savedLanguage);
          i18n.changeLanguage(savedLanguage);
        }
      } catch (error) {
        logger.error('Failed to load language:', error);
      }
    };

    loadLanguage();
  }, []);

  const contextValue: AuthContextType = {
    isAuthenticated,
    isLoading,
    user,
    logout,
    language,
    selectLanguage,
    syncUserData,
    isInitialized,
    initializeAfterAuth,
    sendOTP,
    verifyOTP,
    createUser,
    phoneNumber,
    otpSent,
    otpVerified,
    isOtpInProgress,
    registerAuthSuccessCallback,
    unregisterAuthSuccessCallback,
    userDataState,
    isOnline,
    refreshUserData,
    resetAuthLoading,
    // Legacy methods
    login,
    register,
    refreshAuth
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};