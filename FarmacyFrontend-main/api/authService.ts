import axios, { AxiosError } from 'axios';
import { API_BASE_URL, API_CONFIG } from '../config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { Alert } from 'react-native';

export interface LoginData {
  email: string;
  password: string;
}

export interface SignupData {
  username: string;
  email: string;
  password: string;
  phone_number: string;
  farm_type: string;
}

export interface FirebasePhoneAuthData {
  firebase_id_token: string;
  username?: string;
  full_name?: string;
  farm_type?: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user?: any;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data?: TokenResponse;
}

export interface AuthError {
  message: string;
  code: string;
}

class AuthService {
  private baseUrl: string;
  private refreshPromise: Promise<TokenResponse> | null = null;
  private onSessionExpired: (() => void) | null = null;
  private isSessionExpiryInProgress = false;
  private isRefreshInProgress = false;

  constructor() {
    this.baseUrl = `${API_BASE_URL}/auth`;
    this.setupAxiosInterceptor();
    
    // Configure axios defaults
    axios.defaults.timeout = API_CONFIG.timeout;
    axios.defaults.headers.common = {
      ...axios.defaults.headers.common,
      ...API_CONFIG.headers,
    };
  }

  // Method to set session expiry callback
  setOnSessionExpired(callback: () => void) {
    this.onSessionExpired = callback;
  }

  // Method to trigger session expiry with protection against multiple calls
  private triggerSessionExpiry() {
    // Import the logout flag check
    const { setLoggedOutFlag } = require('./apiUtils');
    
    if (this.isSessionExpiryInProgress) {
      console.log('[AUTH SERVICE] Session expiry already in progress, skipping...');
      return;
    }

    this.isSessionExpiryInProgress = true;
    console.log('[AUTH SERVICE] Triggering session expiry...');

    if (this.onSessionExpired) {
      this.onSessionExpired();
    }

    // Reset the flag after a delay
    setTimeout(() => {
      this.isSessionExpiryInProgress = false;
      console.log('[AUTH SERVICE] Session expiry flag reset');
    }, 2000);
  }

  // Reset session expiry flag
  resetSessionExpiryFlag() {
    this.isSessionExpiryInProgress = false;
  }

  // Reset refresh flag
  resetRefreshFlag() {
    this.refreshPromise = null;
    this.isRefreshInProgress = false;
    console.log('[AUTH SERVICE] Refresh flags reset');
  }

  private setupAxiosInterceptor() {
    axios.interceptors.request.use(
      (config) => {
        // Ensure URL is properly set
        if (!config.url) {
          console.error('[AUTH SERVICE] Request URL is undefined:', config);
          throw new Error('Request URL is not defined');
        }
        return config;
      },
      (error) => {
        console.error('[AUTH SERVICE] Request interceptor error:', error);
        return Promise.reject(error);
      }
    );

    axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        // Only skip for Firebase endpoints, not /refresh
        if (
          !originalRequest ||
          !originalRequest.url ||
          originalRequest.url.includes('/firebase-phone-auth') ||
          originalRequest.url.includes('/firebase-signup') ||
          originalRequest.url.includes('/firebase-auth') ||
          originalRequest.url.includes('/link-firebase') ||
          originalRequest._retry
        ) {
          console.log('[AUTH SERVICE] Skipping interceptor for:', originalRequest?.url);
          return Promise.reject(error);
        }

        // If 401 for /refresh, trigger session expiry immediately
        if (originalRequest.url.includes('/refresh') && error.response?.status === 401) {
          console.log('[AUTH SERVICE] 401 on /refresh, triggering session expiry');
          await this.clearTokens();
          Alert.alert(
            'Session Expired',
            'Your session has expired. Please log in again.',
            [
              {
                text: 'OK',
                onPress: () => {
                  if (router) router.replace('/welcome');
                }
              }
            ]
          );
          this.triggerSessionExpiry();
          return Promise.reject(error);
        }

        // Only handle 401 errors and not refresh token requests
        if (error.response?.status === 401) {
          console.log('[AUTH SERVICE] 401 error detected for:', originalRequest.url);
          originalRequest._retry = true;

          try {
            // Check if refresh token exists before attempting refresh
            const refreshToken = await AsyncStorage.getItem('refresh_token');
            if (!refreshToken) {
              console.log('[AUTH SERVICE] No refresh token available, triggering session expiry');
              await this.clearTokens();
              this.triggerSessionExpiry();
              return Promise.reject(error);
            }

            console.log('[AUTH SERVICE] Attempting to refresh access token');
            // Attempt to refresh token - this method handles concurrency internally
            const newTokens = await this.refreshAccessToken();
            console.log('[AUTH SERVICE] Token refresh successful, retrying original request');
            originalRequest.headers['Authorization'] = `Bearer ${newTokens.access_token}`;
            return axios(originalRequest);
          } catch (refreshError) {
            console.log('[AUTH SERVICE] Token refresh failed, triggering session expiry');
            await this.clearTokens();
            this.triggerSessionExpiry();
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  async login(data: LoginData): Promise<TokenResponse> {
    try {
      const response = await axios.post<TokenResponse>(`${this.baseUrl}/login`, data);
      await this.storeTokens(response.data);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async signup(data: SignupData): Promise<void> {
    try {
      const response = await axios.post(`${this.baseUrl}/signup`, data);
      await this.storeTokens(response.data);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async firebasePhoneAuth(data: FirebasePhoneAuthData): Promise<AuthResponse> {
    try {
      console.log('Calling Firebase phone auth endpoint:', `${this.baseUrl}/firebase-phone-auth`);
      console.log('Request data:', data);
      
      const response = await axios.post<TokenResponse>(`${this.baseUrl}/firebase-phone-auth`, data);
      
      // console.log('Firebase auth response status:', response.status);
      console.log('Firebase auth response data:', response.data);
      
      // Store tokens
      await this.storeTokens(response.data);
      
      return {
        success: true,
        message: 'Authentication successful',
        data: response.data
      };
    } catch (error: any) {
      console.error('Firebase phone auth error:', error);
      
      // More detailed error logging
      if (axios.isAxiosError(error)) {
        console.error('Axios error response:', error.response?.data);
        console.error('Axios error status:', error.response?.status);
        console.error('Axios error headers:', error.response?.headers);
        
        if (error.response) {
          // Server responded with error status
          const authError = this.handleError(error);
          return {
            success: false,
            message: authError.message
          };
        } else if (error.request) {
          // Network error - no response received
          console.error('Network error - no response:', error.request);
          return {
            success: false,
            message: 'Network error. Please check your internet connection.'
          };
        }
      }
      
      // Other errors
      const authError = this.handleError(error);
      return {
        success: false,
        message: authError.message
      };
    }
  }

  async logout(): Promise<void> {
    try {
      const accessToken = await AsyncStorage.getItem('access_token');
      if (accessToken) {
        await axios.post(
          `${this.baseUrl}/logout`,
          {},
          {
            headers: {
              Authorization: `Bearer ${accessToken}`
            }
          }
        );
      }
      this.clearTokens();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      await this.clearTokens();
    }
  }

  async refreshAccessToken(): Promise<TokenResponse> {
    // Synchronous check and lock to prevent race conditions
    if (this.isRefreshInProgress) {
      console.log('[AUTH SERVICE] Refresh already in progress, waiting for existing promise');
      if (this.refreshPromise) {
        return this.refreshPromise;
      }
      // If somehow the promise is null but refresh is in progress, wait a bit and retry
      await new Promise(resolve => setTimeout(resolve, 100));
      return this.refreshAccessToken();
    }

    // If there's already a refresh promise, return it
    if (this.refreshPromise) {
      console.log('[AUTH SERVICE] Refresh promise exists, returning it');
      return this.refreshPromise;
    }

    console.log('[AUTH SERVICE] Starting new refresh token request');

    // Set the flag immediately to block other calls
    this.isRefreshInProgress = true;

    // Create the refresh promise
    this.refreshPromise = (async () => {
      try {
        const refreshToken = await AsyncStorage.getItem('refresh_token');
        if (!refreshToken) {
          console.log('[AUTH SERVICE] No refresh token found for refresh attempt');
          throw new Error('No refresh token available');
        }

        const response = await axios.post<TokenResponse>(
          `${this.baseUrl}/refresh?refresh_token=${refreshToken}`,
          {}
        );

        console.log('[AUTH SERVICE] Refresh token request successful');
        const tokens = response.data;
        
        await this.storeTokens(tokens);
        console.log('[AUTH SERVICE] Tokens refreshed and stored successfully');
        
        return tokens;
      } catch (error: any) {
        console.log('[AUTH SERVICE] Refresh token request failed:', error.response?.status);
        
        // If refresh token request gets 401, the refresh token is invalid
        if (error.response?.status === 401) {
          console.log('[AUTH SERVICE] Refresh token is invalid (401), clearing tokens');
          // Show session expired alert and redirect to welcome
          Alert.alert(
            'Session Expired',
            'Your session has expired. Please log in again.',
            [
              {
                text: 'OK',
                onPress: () => {
                  if (router) router.replace('/welcome');
                }
              }
            ]
          );
        }
        
        throw this.handleError(error);
      }
    })();

    try {
      return await this.refreshPromise;
    } finally {
      // Reset both the promise and the flag
      this.refreshPromise = null;
      this.isRefreshInProgress = false;
      console.log('[AUTH SERVICE] Refresh promise and flag cleared');
    }
  }

  async getCurrentUser() {
    try {
      const headers = await this.getAuthHeader();
      const response = await axios.get(`${this.baseUrl}/me`, { headers });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async updateUser(userData: { username: string; phone_number?: string; farm_type?: string }) {
    try {
      const headers = await this.getAuthHeader();
      
      const response = await axios.put(`${this.baseUrl}/update-username?username=${encodeURIComponent(userData.username)}`, {}, { headers });
      
      // Update stored user data
      if (response.data.user) {
        await AsyncStorage.setItem('user_data', JSON.stringify(response.data.user));
      }
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async updateUserLanguage(language: string) {
    try {
      const headers = await this.getAuthHeader();
      
      const response = await axios.put(`${this.baseUrl}/update-language`, { preferred_language: language }, { headers });
      
      // Update stored user data
      if (response.data.user) {
        await AsyncStorage.setItem('user_data', JSON.stringify(response.data.user));
      }
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  private async getAuthHeader() {
    const token = await AsyncStorage.getItem('access_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  private async storeTokens(tokens: TokenResponse): Promise<void> {
    try {
      await AsyncStorage.setItem('access_token', tokens.access_token);
      await AsyncStorage.setItem('refresh_token', tokens.refresh_token);
      
      // Store user data if available
      if (tokens.user) {
        await AsyncStorage.setItem('user_data', JSON.stringify(tokens.user));
      }
    } catch (error) {
      console.error('Error storing tokens:', error);
      throw error;
    }
  }

  private async clearTokens(): Promise<void> {
    try {
      await AsyncStorage.multiRemove(['access_token', 'refresh_token', 'user_data']);
    } catch (error) {
      console.error('Error clearing tokens:', error);
      throw error;
    }
  }

  private handleError(error: unknown): AuthError {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<any>;
      
      if (axiosError.response) {
        const status = axiosError.response.status;
        const detail = axiosError.response.data?.detail;
        
        // Handle specific HTTP status codes
        switch (status) {
          case 400:
            return {
              message: detail || 'Invalid request data',
              code: 'BAD_REQUEST'
            };
          case 401:
            return {
              message: detail || 'Invalid credentials',
              code: 'UNAUTHORIZED'
            };
          case 403:
            return {
              message: detail || 'Access forbidden',
              code: 'FORBIDDEN'
            };
          case 404:
            return {
              message: detail || 'User not found',
              code: 'NOT_FOUND'
            };
          case 422:
            return {
              message: detail || 'Validation error',
              code: 'VALIDATION_ERROR'
            };
          case 429:
            return {
              message: 'Too many requests. Please try again later.',
              code: 'RATE_LIMIT'
            };
          case 500:
            return {
              message: 'Server error. Please try again later.',
              code: 'SERVER_ERROR'
            };
          default:
            return {
              message: detail || `Request failed with status ${status}`,
              code: 'REQUEST_FAILED'
            };
        }
      } else if (axiosError.request) {
        // Network error
        return {
          message: 'Network error. Please check your internet connection.',
          code: 'NETWORK_ERROR'
        };
      }
    }

    // Generic error
    return {
      message: error instanceof Error ? error.message : 'An unexpected error occurred',
      code: 'UNKNOWN_ERROR'
    };
  }
}

export const authService = new AuthService(); 