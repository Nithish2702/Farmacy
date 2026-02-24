import { API_BASE_URL } from '../config';

// MSG91 OTP Widget Configuration
// Update these values with your actual MSG91 widget configuration

export const MSG91_CONFIG = {
  // Widget ID from your MSG91 dashboard
  WIDGET_ID: '356779656c71303131353633', // This appears to be the actual widget ID
  
  // Auth Token from your MSG91 dashboard - needs to be updated with real token
  AUTH_TOKEN: '461463T5n9FhO0v688321ebP1', // Update this with your actual auth token
  
  // API Base URL for your backend
  API_BASE_URL: API_BASE_URL,
};

// Channel codes for retry functionality
export const MSG91_CHANNELS = {
  SMS: 11,
  VOICE: 4,
  EMAIL: 3,
  WHATSAPP: 12,
};

// Error messages
export const MSG91_ERRORS = {
  INITIALIZATION_FAILED: 'Failed to initialize OTP service',
  SEND_FAILED: 'Failed to send OTP',
  VERIFY_FAILED: 'Failed to verify OTP',
  RETRY_FAILED: 'Failed to resend OTP',
  NETWORK_ERROR: 'Network error. Please check your connection',
  INVALID_PHONE: 'Invalid phone number format',
  TOO_MANY_REQUESTS: 'Too many requests. Please try again later',
  QUOTA_EXCEEDED: 'SMS quota exceeded. Please try again later',
};