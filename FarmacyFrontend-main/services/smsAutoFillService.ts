import { Platform } from 'react-native';
import { getHash, startOtpListener, useOtpVerify } from 'react-native-otp-verify';

export interface SMSAutoFillService {
  getAppHash(): Promise<string[]>;
  startOtpListener(): Promise<void>;
  stopOtpListener(): Promise<void>;
  useOtpVerify(): {
    otp: string | null;
    message: string | null;
    hash: string[] | null;
    timeoutError: boolean;
    stopListener: () => void;
    startListener: () => void;
  };
}

class SMSAutoFillServiceImpl implements SMSAutoFillService {
  private isListenerActive = false;

  /**
   * Get app hash for SMS auto-fill functionality
   */
  async getAppHash(): Promise<string[]> {
    if (Platform.OS === 'android') {
      try {
        const hashes = await getHash();
        console.log('App hashes:', hashes);
        return hashes;
      } catch (error) {
        console.error('Failed to get app hash:', error);
        return [];
      }
    }
    return [];
  }

  /**
   * Start OTP listener for SMS auto-fill
   */
  async startOtpListener(): Promise<void> {
    if (Platform.OS === 'android' && !this.isListenerActive) {
      try {
        await startOtpListener(() => {
          // Callback function for when OTP is received
          console.log('OTP received via listener');
        });
        this.isListenerActive = true;
        console.log('OTP listener started successfully');
      } catch (error) {
        console.error('Failed to start OTP listener:', error);
        throw error;
      }
    }
  }

  /**
   * Stop OTP listener
   */
  async stopOtpListener(): Promise<void> {
    if (Platform.OS === 'android' && this.isListenerActive) {
      try {
        // Note: react-native-otp-verify doesn't have a stop method
        // The listener automatically stops when the component unmounts
        this.isListenerActive = false;
        console.log('OTP listener stopped');
      } catch (error) {
        console.error('Failed to stop OTP listener:', error);
        // Don't throw error, just log it
      }
    }
  }

  /**
   * Use OTP verify hook
   */
  useOtpVerify() {
    return useOtpVerify();
  }
}

// Export singleton instance
export const smsAutoFillService = new SMSAutoFillServiceImpl();
