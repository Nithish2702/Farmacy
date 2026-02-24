import { OTPWidget } from '@msg91comm/sendotp-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MSG91_CONFIG, MSG91_CHANNELS, MSG91_ERRORS } from '../config/msg91';

export interface MSG91OTPResponse {
  success: boolean;
  message: string;
  reqId?: string;
  accessToken?: string;
}

export interface MSG91VerifyResponse {
  success: boolean;
  message: string;
  user_exists: boolean;
  access_token?: string;
  refresh_token?: string;
}

export interface CreateUserRequest {
  phone_number: string;
  username: string;
  full_name?: string;
  farm_type?: string;
}

class MSG91OTPService {
  private isInitialized = false;
  private currentReqId: string | null = null;
  private readonly REQ_ID_STORAGE_KEY = 'msg91_current_req_id';

  /**
   * Initialize the MSG91 OTP Widget
   */
  async initializeWidget(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      console.log('MSG91: Initializing widget with ID:', MSG91_CONFIG.WIDGET_ID);
      console.log('MSG91: Using auth token:', MSG91_CONFIG.AUTH_TOKEN ? '***' + MSG91_CONFIG.AUTH_TOKEN.slice(-4) : 'NOT SET');
      
      await OTPWidget.initializeWidget(MSG91_CONFIG.WIDGET_ID, MSG91_CONFIG.AUTH_TOKEN);
      this.isInitialized = true;
      console.log('MSG91 OTP Widget initialized successfully');
      
      // Try to restore reqId from storage
      try {
        const storedReqId = await AsyncStorage.getItem(this.REQ_ID_STORAGE_KEY);
        if (storedReqId) {
          this.currentReqId = storedReqId;
          console.log('MSG91: Restored reqId on initialization:', storedReqId);
        }
      } catch (storageError) {
        console.log('MSG91: No stored reqId found or error loading:', storageError);
      }
    } catch (error) {
      console.error('Failed to initialize MSG91 OTP Widget:', error);
      this.isInitialized = false;
      throw new Error(MSG91_ERRORS.INITIALIZATION_FAILED);
    }
  }

  /**
   * Send OTP to the provided phone number
   */
  async sendOTP(phoneNumber: string): Promise<MSG91OTPResponse> {
    try {
      await this.initializeWidget();

      const data = {
        identifier: phoneNumber.replace('+', '') // Remove + from phone number
      };

      const response = await OTPWidget.sendOTP(data);
      console.log('MSG91 Send OTP response:', response);

      // Check if the response indicates an error
      if (response.code === '401' || response.type === 'error') {
        throw new Error(response.message || 'Authentication failed');
      }

      // For successful responses, MSG91 returns {message: "reqId", type: "success"}
      let reqId = response.reqId;
      if (!reqId && response.type === 'success' && response.message) {
        reqId = response.message; // The message contains the reqId
      }

      if (!reqId) {
        throw new Error('No request ID received from MSG91');
      }

      // Store the reqId for later verification
      this.currentReqId = reqId;
      console.log('MSG91: Stored reqId:', this.currentReqId);
      
      // Also persist to AsyncStorage for navigation safety
      await AsyncStorage.setItem(this.REQ_ID_STORAGE_KEY, reqId);

      return {
        success: true,
        message: 'OTP sent successfully',
        reqId: reqId
      };
    } catch (error: any) {
      console.error('MSG91 Send OTP error:', error);
      return {
        success: false,
        message: error.message || MSG91_ERRORS.SEND_FAILED
      };
    }
  }

  /**
   * Retry OTP on the specified channel
   */
  async retryOTP(reqId?: string, channel?: number): Promise<MSG91OTPResponse> {
    try {
      await this.initializeWidget();

      const reqIdToUse = reqId || this.currentReqId;
      if (!reqIdToUse) {
        throw new Error('No request ID available for retry');
      }

      const body: any = {
        reqId: reqIdToUse
      };

      if (channel) {
        body.retryChannel = channel;
      }

      const response = await OTPWidget.retryOTP(body);
      console.log('MSG91 Retry OTP response:', response);

      // Check if the response indicates an error
      if (response.code === '401' || response.type === 'error') {
        throw new Error(response.message || 'Failed to retry OTP');
      }

      // For successful responses, MSG91 returns {message: "reqId", type: "success"}
      let retryReqId = response.reqId;
      if (!retryReqId && response.type === 'success' && response.message) {
        retryReqId = response.message; // The message contains the reqId
      }

      return {
        success: true,
        message: 'OTP resent successfully',
        reqId: retryReqId
      };
    } catch (error: any) {
      console.error('MSG91 Retry OTP error:', error);
      return {
        success: false,
        message: error.message || MSG91_ERRORS.RETRY_FAILED
      };
    }
  }

  /**
   * Verify OTP and get access token
   */
  async verifyOTP(otp: string, reqId?: string): Promise<MSG91OTPResponse> {
    try {
      await this.initializeWidget();

      // Try to get reqId from multiple sources
      let reqIdToUse = reqId || this.currentReqId;
      
      // If still no reqId, try to load from AsyncStorage
      if (!reqIdToUse) {
        const storedReqId = await AsyncStorage.getItem(this.REQ_ID_STORAGE_KEY);
        if (storedReqId) {
          reqIdToUse = storedReqId;
          this.currentReqId = storedReqId; // Restore to memory
          console.log('MSG91: Restored reqId from AsyncStorage:', reqIdToUse);
        }
      }
      
      console.log('MSG91: Attempting to verify OTP with reqId:', reqIdToUse);
      console.log('MSG91: Current stored reqId:', this.currentReqId);
      
      if (!reqIdToUse) {
        throw new Error('No request ID available for verification');
      }

      const body = {
        reqId: reqIdToUse,
        otp: otp
      };

      const response = await OTPWidget.verifyOTP(body);
      console.log('MSG91 Verify OTP response:', response);

      // Check if the response indicates an error
      if (response.code === '401' || response.type === 'error') {
        throw new Error(response.message || 'OTP verification failed');
      }

      // For successful responses, MSG91 returns access token
      let accessToken = response.accessToken;
      if (!accessToken && response.type === 'success' && response.message) {
        // The message might contain the access token
        accessToken = response.message;
      }

      if (!accessToken) {
        throw new Error('No access token received from MSG91');
      }

      return {
        success: true,
        message: 'OTP verified successfully',
        accessToken: accessToken
      };
    } catch (error: any) {
      console.error('MSG91 Verify OTP error:', error);
      return {
        success: false,
        message: error.message || MSG91_ERRORS.VERIFY_FAILED
      };
    }
  }

  /**
   * Verify access token on server side
   */
  async verifyAccessToken(accessToken: string): Promise<MSG91VerifyResponse> {
    try {
      const response = await fetch(`${MSG91_CONFIG.API_BASE_URL}/otp/verify-access-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          access_token: accessToken
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to verify access token');
      }

      return data;
    } catch (error: any) {
      console.error('Server-side access token verification error:', error);
      throw new Error(error.message || MSG91_ERRORS.NETWORK_ERROR);
    }
  }

  /**
   * Create new user after MSG91 verification
   */
  async createUser(userData: CreateUserRequest): Promise<MSG91VerifyResponse> {
    try {
      const response = await fetch(`${MSG91_CONFIG.API_BASE_URL}/otp/create-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to create user');
      }

      return data;
    } catch (error: any) {
      console.error('Server-side user creation error:', error);
      throw new Error(error.message || 'Failed to create user');
    }
  }

  /**
   * Complete OTP verification flow (for when user enters OTP)
   */
  async completeVerification(otp: string): Promise<MSG91VerifyResponse> {
    try {
      // Step 1: Verify OTP using stored reqId
      const verifyResponse = await this.verifyOTP(otp);
      if (!verifyResponse.success || !verifyResponse.accessToken) {
        throw new Error(verifyResponse.message);
      }

      // Step 2: Verify access token on server
      const serverResponse = await this.verifyAccessToken(verifyResponse.accessToken);
      return serverResponse;
    } catch (error: any) {
      console.error('Complete verification error:', error);
      throw error;
    }
  }

  /**
   * Clear stored reqId (useful for cleanup)
   */
  async clearReqId(): Promise<void> {
    this.currentReqId = null;
    await AsyncStorage.removeItem(this.REQ_ID_STORAGE_KEY);
    console.log('MSG91: Cleared reqId from memory and storage');
  }

  /**
   * Get current reqId
   */
  getCurrentReqId(): string | null {
    return this.currentReqId;
  }

  /**
   * Get available channels for retry
   */
  getAvailableChannels() {
    return MSG91_CHANNELS;
  }

  /**
   * Get service configuration
   */
  getConfig() {
    return {
      widgetId: MSG91_CONFIG.WIDGET_ID,
      isInitialized: this.isInitialized,
      currentReqId: this.currentReqId
    };
  }
}

export const msg91OtpService = new MSG91OTPService();
