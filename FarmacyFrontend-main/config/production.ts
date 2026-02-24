export const PRODUCTION_CONFIG = {
  // Firebase Phone Auth Settings
  PHONE_AUTH: {
    // Enable real SMS sending
    ENABLE_REAL_SMS: true,
    
    // Phone number validation
    COUNTRY_CODES: ['+91', '+1', '+44', '+86'], // Add supported country codes
    
    // SMS timeout settings
    TIMEOUT_SECONDS: 60,
    RESEND_COOLDOWN_SECONDS: 30,
    
    // Rate limiting
    MAX_ATTEMPTS_PER_HOUR: 5,
  },
  
  // Error handling
  ERROR_MESSAGES: {
    INVALID_PHONE: 'Please enter a valid phone number with country code (e.g., +911234567890)',
    NO_SMS_RECEIVED: 'SMS not received? Check your network or try again in a few minutes.',
    RATE_LIMITED: 'Too many attempts. Please wait before trying again.',
    BILLING_ERROR: 'SMS service unavailable. Please contact support.',
  },
  
  // Development flags
  DEBUG_LOGGING: __DEV__,
  SHOW_ERROR_DETAILS: __DEV__,
};

export default PRODUCTION_CONFIG; 