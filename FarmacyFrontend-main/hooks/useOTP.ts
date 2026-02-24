import { useState, useEffect, useRef } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';
import {
  startOtpListener,
  removeListener,
} from 'react-native-otp-verify';

export const useOTPAutoFill = () => {
  const [autoFilledOTP, setAutoFilledOTP] = useState<string>('');
  const [isListenerActive, setIsListenerActive] = useState(false);
  const listenerStarted = useRef(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Clear auto-filled OTP when component unmounts or resets
  const resetAutoFilledOTP = () => {
    setAutoFilledOTP('');
  };

  // Request SMS permissions for Android
  const requestSMSPermissions = async () => {
    if (Platform.OS !== 'android') return true;

    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
        {
          title: 'SMS Permission',
          message: 'This app needs access to SMS to auto-fill verification codes',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      console.warn('SMS permission error:', err);
      return false;
    }
  };

  // Extract OTP from message using patterns optimized for the new template
  // Template: "%LOGIN_CODE% is your verification code for %APP_NAME%"
  // Expected format: "123456 is your verification code for Farmacy"
  const extractOTPFromMessage = (message: string): string | null => {
    console.log('Processing SMS message:', message);

    // Multiple regex patterns to catch different OTP formats
    const patterns = [
      // Primary pattern for new template: "123456 is your verification code for Farmacy"
      /(\d{6})\s+is\s+your\s+verification\s+code\s+for\s+Farmacy/i,
      
      // More flexible patterns for the new template
      /(\d{6})\s+is\s+your\s+verification\s+code/i,
      /(\d{6})\s+is\s+your/i,
      
      // Generic patterns for fallback compatibility
      /\b(\d{6})\b.*(?:verification|code|Farmacy)/i,  // 6 digits + verification/code/Farmacy
      /(?:code|verification).*?(\d{6})/i,             // code/verification followed by 6 digits
      /(\d{6}).*(?:code|verification)/i,              // 6 digits followed by code/verification
      /\b(\d{6})\b/,                                  // Any 6 consecutive digits (last resort)
    ];

    for (let i = 0; i < patterns.length; i++) {
      const pattern = patterns[i];
      const match = message.match(pattern);
      if (match && match[1]) {
        console.log(`OTP extracted using pattern ${i + 1}:`, pattern.source, 'OTP:', match[1]);
        return match[1];
      }
    }

    console.log('No OTP pattern matched for message:', message);
    return null;
  };

  // Initialize SMS listener without hash dependency
  const startSMSListener = async () => {
    if (Platform.OS !== 'android' || listenerStarted.current) {
      return;
    }

    // Request SMS permissions first
    const hasPermission = await requestSMSPermissions();
    if (!hasPermission) {
      console.log('SMS permission denied, OTP auto-fill will not work');
      return;
    }

    try {
      // Use startOtpListener without hash validation
      startOtpListener((message: string) => {
        console.log('SMS received:', message);
        
        // Extract OTP from any SMS that might contain verification code
        const extractedOTP = extractOTPFromMessage(message);
        if (extractedOTP) {
          console.log('OTP auto-filled from SMS:', extractedOTP);
          setAutoFilledOTP(extractedOTP);
        }
      });
      
      listenerStarted.current = true;
      setIsListenerActive(true);
      console.log('SMS listener started successfully (without app hash)');
      
    } catch (error) {
      console.error('Failed to start SMS listener:', error);
      setIsListenerActive(false);
    }
  };

  // Stop SMS listener
  const stopSMSListener = () => {
    if (listenerStarted.current) {
      try {
        removeListener();
        listenerStarted.current = false;
        setIsListenerActive(false);
        console.log('SMS listener stopped');
      } catch (error) {
        console.error('Error stopping SMS listener:', error);
      }
    }
  };

  // Force cleanup - ensures listener is completely stopped
  const forceCleanup = () => {
    try {
      removeListener();
      listenerStarted.current = false;
      setIsListenerActive(false);
      setAutoFilledOTP('');
      console.log('SMS listener force stopped and cleaned up');
    } catch (error) {
      console.error('Error during force cleanup:', error);
    }
  };

  // Don't auto-start SMS listener on mount - let parent component control it
  // useEffect(() => {
  //   startSMSListener();

  //   // Store cleanup function
  //   cleanupRef.current = () => {
  //     stopSMSListener();
  //   };

  //   return () => {
  //     stopSMSListener();
  //   };
  // }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      forceCleanup();
    };
  }, []);

  // Manual listener control functions
  const startListener = () => {
    if (!listenerStarted.current) {
      startSMSListener();
    }
  };

  const stopListener = () => {
    stopSMSListener();
  };

  return {
    autoFilledOTP,
    resetAutoFilledOTP,
    startListener,
    stopListener,
    forceCleanup,
    isListenerActive,
  };
}; 