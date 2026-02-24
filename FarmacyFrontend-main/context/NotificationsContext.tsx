import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { Platform, Alert } from 'react-native';
import * as Notifications from 'expo-notifications';
import { EventSubscription } from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useAuth } from './AuthContext';
import { fcmService, NotificationResponse } from '@/api/fcmService';
import { registerForPushNotificationsAsync } from '@/utils/registerForPushNotificationsAsync';

// Storage keys for persistent state
const STORAGE_KEYS = {
  FCM_TOKEN: 'fcm_token',
  DEVICE_REGISTERED: 'device_registered',
  NOTIFICATIONS: 'notifications_cache',
  UNREAD_COUNT: 'unread_count_cache',
  LOGOUT_FLAG: 'logout_flag',
} as const;

interface NotificationsContextType {
  expoPushToken: string | null;
  isLoading: boolean;
  error: Error | null;
  notification: Notifications.Notification | null;
  // Global notification state
  notifications: NotificationResponse[];
  unreadCount: number;
  isLoadingNotifications: boolean;
  // Methods
  registerDeviceWithBackend: () => Promise<void>;
  unregisterDeviceWithBackend: () => Promise<void>;
  loadNotifications: (skip?: number, limit?: number, unreadOnly?: boolean) => Promise<NotificationResponse[]>;
  markNotificationAsRead: (notificationId: number) => Promise<void>;
  markAllNotificationsAsRead: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  // Logout handling
  handleLogout: () => Promise<void>;
  resetLogoutState: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextType | null>(null);

export const useNotification = () => {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationsProvider');
  }
  return context;
};

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationsProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const { isAuthenticated, isOtpInProgress, isInitialized } = useAuth();
  
  // State
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [notifications, setNotifications] = useState<NotificationResponse[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);

  // Refs for tracking
  const notificationListener = useRef<EventSubscription | null>(null);
  const responseListener = useRef<EventSubscription | null>(null);
  const hasLoadedInitialNotifications = useRef(false);
  const isRegistrationInProgress = useRef(false);
  const isUnregistrationInProgress = useRef(false);

  // Debug logging for auth state changes
  const prevAuthState = useRef({ isAuthenticated, isOtpInProgress, isInitialized });
  useEffect(() => {
    const currentState = { isAuthenticated, isOtpInProgress, isInitialized };
    if (JSON.stringify(prevAuthState.current) !== JSON.stringify(currentState)) {
      console.log('🔔 NotificationsProvider - Auth state changed:', currentState);
      prevAuthState.current = currentState;
    }
  }, [isAuthenticated, isOtpInProgress, isInitialized]);

  // Initialize notification listeners
  useEffect(() => {
    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      console.log("🔔 Notification Received while the app is Running:", notification);
      setNotification(notification);
      // Auto-refresh notifications when new one is received
      loadNotifications(0, 10, false).catch(error => {
        console.error('🔔 Error refreshing notifications after new notification:', error);
      });
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log("🔔 Notification Response: User Interacts with the Notification", response);
      // Deep link navigation if deeplink param is present
      const data = response.notification.request.content.data;
      if (data && typeof data.deeplink === 'string' && data.deeplink.length > 0) {
        router.push(data.deeplink as any);
      }
      // Auto-refresh notifications when user interacts with notification
      loadNotifications(0, 10, false).catch(error => {
        console.error('🔔 Error refreshing notifications after user interaction:', error);
      });
    });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);

  // Load initial notifications when context mounts
  useEffect(() => {
    const loadInitialNotifications = async () => {
      try {
        // Only load notifications if user is authenticated, OTP is not in progress, and auth is initialized
        if (!isAuthenticated || isOtpInProgress || !isInitialized) {
          console.log('🔔 Skipping initial notification load - auth not ready:', {
            isAuthenticated,
            isOtpInProgress,
            isInitialized
          });
          return;
        }

        // Prevent duplicate loads
        if (hasLoadedInitialNotifications.current) {
          console.log('🔔 Initial notifications already loaded, skipping...');
          return;
        }
        
        console.log('🔔 Loading initial notifications after auth initialization...');
        await loadNotifications(0, 10, false);
        hasLoadedInitialNotifications.current = true;
      } catch (error) {
        console.error('Error loading initial notifications:', error);
      }
    };
    
    loadInitialNotifications();
  }, [isAuthenticated, isOtpInProgress, isInitialized]);

  // Handle authentication state changes
  useEffect(() => {
    const handleAuthStateChange = async () => {
      // Only handle auth state changes when auth is initialized
      if (!isInitialized) {
        console.log('🔔 Auth not initialized yet, skipping auth state change handling');
        return;
      }

      if (!isAuthenticated) {
        console.log('🔔 User became unauthenticated, clearing notifications');
        setNotifications([]);
        setUnreadCount(0);
        hasLoadedInitialNotifications.current = false;
        await AsyncStorage.setItem(STORAGE_KEYS.LOGOUT_FLAG, 'true');
      } else {
        console.log('🔔 User became authenticated, checking device registration');
        await AsyncStorage.removeItem(STORAGE_KEYS.LOGOUT_FLAG);
        
        // Check if device is already registered
        const isRegistered = await AsyncStorage.getItem(STORAGE_KEYS.DEVICE_REGISTERED);
        if (isRegistered !== 'true') {
          console.log('🔔 Device not registered, registering now...');
          await registerDeviceWithBackend();
        } else {
          console.log('🔔 Device already registered, skipping registration');
        }
      }
    };

    handleAuthStateChange();
  }, [isAuthenticated, isInitialized]);

  // Calculate unread count whenever notifications change
  useEffect(() => {
    const count = notifications.filter(n => !n.is_read).length;
    setUnreadCount(count);
  }, [notifications]);

  // Load notifications with global state management
  const loadNotifications = async (skip: number = 0, limit: number = 100, unreadOnly: boolean = false): Promise<NotificationResponse[]> => {
    try {
      // Prevent loading if user is not authenticated, OTP is in progress, or auth is not initialized
      if (!isAuthenticated || isOtpInProgress || !isInitialized) {
        console.log('🔔 Skipping notification load - auth not ready:', {
          isAuthenticated,
          isOtpInProgress,
          isInitialized
        });
        return [];
      }

      // Check logout flag
      const logoutFlag = await AsyncStorage.getItem(STORAGE_KEYS.LOGOUT_FLAG);
      if (logoutFlag === 'true') {
        console.log('🔔 User logged out, skipping notification load');
        return [];
      }

      // Prevent multiple simultaneous calls
      if (isLoadingNotifications) {
        console.log('🔔 Already loading notifications, skipping...');
        return notifications;
      }

      setIsLoadingNotifications(true);
      console.log('🔔 Loading notifications...', { skip, limit, unreadOnly });
      
      try {
        const data = await fcmService.getNotifications(skip, limit, undefined, unreadOnly);
        
        // Update global state for all notification loads
        setNotifications(data);
        
        return data;
      } catch (apiError: any) {
        console.error('🔔 API error loading notifications:', apiError);
        
        // Handle specific network errors
        if (apiError.message?.includes('Network Error') || apiError.code === 'NETWORK_ERROR') {
          console.log('🔔 Network error, keeping existing notifications');
          return notifications;
        }
        
        throw apiError;
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
      throw error;
    } finally {
      setIsLoadingNotifications(false);
    }
  };

  // Mark notification as read
  const markNotificationAsRead = async (notificationId: number): Promise<void> => {
    try {
      // Check if already read to avoid unnecessary API calls
      const notification = notifications.find(n => n.id === notificationId);
      if (notification?.is_read) {
        console.log('🔔 Notification already read, skipping API call:', notificationId);
        return;
      }

      console.log('🔔 Marking notification as read:', notificationId);
      await fcmService.markNotificationAsRead(notificationId);
      
      // Update global state
      setNotifications(prev => {
        const updated = prev.map(notif => 
          notif.id === notificationId ? { ...notif, is_read: true } : notif
        );
        return updated;
      });
      
      console.log('🔔 Notification marked as read successfully');
    } catch (error) {
      console.error('🔔 Error marking notification as read:', error);
      throw error;
    }
  };

  // Mark all notifications as read
  const markAllNotificationsAsRead = async (): Promise<void> => {
    try {
      console.log('🔔 Marking all notifications as read');
      await fcmService.markAllNotificationsAsRead();
      
      // Update global state
      setNotifications(prev => prev.map(notif => ({ ...notif, is_read: true })));
      
      console.log('🔔 All notifications marked as read successfully');
    } catch (error) {
      console.error('🔔 Error marking all notifications as read:', error);
      throw error;
    }
  };

  // Refresh notifications
  const refreshNotifications = async (): Promise<void> => {
    try {
      console.log('🔔 Refreshing notifications...');
      await loadNotifications(0, 10, false);
      console.log('🔔 Notifications refreshed successfully');
    } catch (error) {
      console.error('🔔 Error refreshing notifications:', error);
      throw error;
    }
  };

  // Handle logout - clear notifications, unregister device, and set logout flag
  const handleLogout = async () => {
    console.log('🔔 Handling logout in notifications context');
    
    // Set logout flag first
    await AsyncStorage.setItem(STORAGE_KEYS.LOGOUT_FLAG, 'true');
    
    // Clear local state
    setNotifications([]);
    setUnreadCount(0);
    setIsLoadingNotifications(false);
    hasLoadedInitialNotifications.current = false;
    
    // Unregister device from backend
    try {
      await unregisterDeviceWithBackend();
      console.log('🔔 Device unregistered successfully during logout');
    } catch (error) {
      console.error('🔔 Failed to unregister device during logout:', error);
      // Don't block logout if device unregistration fails
    }
  };

  // Reset logout state when user logs in
  const resetLogoutState = async () => {
    console.log('🔔 Resetting logout state in notifications context');
    await AsyncStorage.removeItem(STORAGE_KEYS.LOGOUT_FLAG);
  };

  // Register device with backend
  const registerDeviceWithBackend = async () => {
    // Prevent multiple simultaneous registrations
    if (isRegistrationInProgress.current) {
      console.log('🔔 Device registration already in progress, skipping...');
      return;
    }

    try {
      isRegistrationInProgress.current = true;
      console.log('🔔 Starting device registration...');
      
      // Only register device if user is authenticated
      if (!isAuthenticated) {
        console.log('🔔 User not authenticated, skipping device registration');
        return;
      }

      setIsLoading(true);
      
      // Check if already registered
      const isRegistered = await AsyncStorage.getItem(STORAGE_KEYS.DEVICE_REGISTERED);
      if (isRegistered === 'true') {
        console.log('🔔 Device already registered, skipping registration');
        return;
      }

      // Get or create FCM token
      let storedToken = await AsyncStorage.getItem(STORAGE_KEYS.FCM_TOKEN);
      if (!storedToken) {
        console.log('🔔 No stored token, getting new FCM token...');
        const tokenResult = await registerForPushNotificationsAsync();
        if (!tokenResult?.fcmToken) {
          throw new Error("Failed to get FCM push token");
        }
        storedToken = tokenResult.fcmToken;
        if(storedToken)
          await AsyncStorage.setItem(STORAGE_KEYS.FCM_TOKEN, storedToken);
      }

      // Register with backend
      if (storedToken) {
        const token = storedToken; // TypeScript should now know this is string
        console.log('🔔 Registering token with backend:', token.substring(0, 20) + '...');
        await fcmService.registerToken(token, Platform.OS);
        setExpoPushToken(token);
        await AsyncStorage.setItem(STORAGE_KEYS.DEVICE_REGISTERED, 'true');
        console.log('🔔 Device registered successfully');
      } else {
        console.log('🔔 No token available for registration');
        throw new Error('No FCM token available for registration');
      }
    } catch (err) {
      console.error("Failed to register device with backend:", err);
      setError(err as Error);
      // Clear invalid token if registration fails
      await AsyncStorage.removeItem(STORAGE_KEYS.FCM_TOKEN);
      await AsyncStorage.removeItem(STORAGE_KEYS.DEVICE_REGISTERED);
      setExpoPushToken(null);
    } finally {
      setIsLoading(false);
      isRegistrationInProgress.current = false;
    }
  };

  // Unregister device from backend
  const unregisterDeviceWithBackend = async () => {
    // Prevent multiple simultaneous unregistrations
    if (isUnregistrationInProgress.current) {
      console.log('🔔 Device unregistration already in progress, skipping...');
      return;
    }

    try {
      isUnregistrationInProgress.current = true;
      setIsLoading(true);
      
      console.log('🔔 Starting device unregistration...');
      
      // Use the unregister-all endpoint to clear all tokens for the user
      await fcmService.unregisterAllTokens();
      
      // Clear local storage
      await AsyncStorage.removeItem(STORAGE_KEYS.FCM_TOKEN);
      await AsyncStorage.removeItem(STORAGE_KEYS.DEVICE_REGISTERED);
      setExpoPushToken(null);
      
      console.log('🔔 Device unregistered successfully');
    } catch (err) {
      console.error("Failed to unregister device:", err);
      setError(err as Error);
    } finally {
      setIsLoading(false);
      isUnregistrationInProgress.current = false;
    }
  };

  return (
    <NotificationsContext.Provider
      value={{
        expoPushToken,
        isLoading,
        error,
        notification,
        // Global notification state
        notifications,
        unreadCount,
        isLoadingNotifications,
        // Methods
        registerDeviceWithBackend,
        unregisterDeviceWithBackend,
        loadNotifications,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        refreshNotifications,
        // Logout handling
        handleLogout,
        resetLogoutState,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
};