// app/otp-verify.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigation } from '@react-navigation/native';
import {
  View,
  Text, 
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Keyboard,
  TouchableWithoutFeedback,
  Dimensions,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { OTPInput, OTPInputRef } from '../components/OTPInput';
import { authService } from '../api/authService';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationsContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import { RFValue } from 'react-native-responsive-fontsize';
import { useTranslation } from 'react-i18next';
import { msg91OtpService } from '../api/msg91OtpService';
import { SafeAreaLayout } from '@/components/ui/SafeAreaLayout';
import { useNavigationBar } from '@/hooks/useNavigationBar';
import { LinearGradient } from 'expo-linear-gradient';

const { height: screenHeight } = Dimensions.get('window');

interface Styles {
  container: ViewStyle;
  keyboardView: ViewStyle;
  scrollContainer: ViewStyle;
  content: ViewStyle;
  header: ViewStyle;

  backButton: ViewStyle;
  headerTitle: TextStyle;
  headerContainer: ViewStyle;
  title: TextStyle;
  subtitle: TextStyle;
  phoneNumber: TextStyle;
  formContainer: ViewStyle;
  otpContainer: ViewStyle;
  errorContainer: ViewStyle;
  errorIconContainer: ViewStyle;
  errorTextContainer: ViewStyle;
  errorTitle: TextStyle;
  errorMessage: TextStyle;
  verifyButton: ViewStyle;
  buttonGradient: ViewStyle;
  verifyButtonText: TextStyle;
  buttonDisabled: ViewStyle;
  resendContainer: ViewStyle;
  resendText: TextStyle;
  resendButton: ViewStyle;
  resendLoadingContainer: ViewStyle;
  resendButtonText: TextStyle;
  disabledText: TextStyle;
  termsText: TextStyle;
}

export default function OTPVerifyScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { phoneNumber } = useLocalSearchParams();
            const { updateTheme, setTransparentBar } = useNavigationBar();

  const { 
    initializeAfterAuth, 
    isAuthenticated, 
    isLoading: authLoading, 
    isInitialized: authInitialized,
    sendOTP,
    verifyOTP,
    otpSent,
    otpVerified,
    isOtpInProgress,
    resetAuthLoading
  } = useAuth();
  const { registerDeviceWithBackend, handleLogout } = useNotification();
  const otpInputRef = useRef<OTPInputRef>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);
  const [error, setError] = useState(false);
  const [lastOtpAttempt, setLastOtpAttempt] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationComplete, setVerificationComplete] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const { t } = useTranslation();

  // Dismiss keyboard when component mounts and enable delayed auto-focus
  useEffect(() => {
    Keyboard.dismiss();
    // Allow smooth transition - OTP input can be manually focused when tapped
    const enableFocusTimer = setTimeout(() => {
      // Input is now ready for manual focus when user taps on it
    }, 500);

    return () => clearTimeout(enableFocusTimer);
  }, []);

            // Ensure navigation bar is transparent
          useEffect(() => {
            updateTheme(false); // false for light theme
            setTransparentBar();
          }, [updateTheme, setTransparentBar]);

  // Guard: If not otpSent, redirect to /phone-auth. If authenticated, go to home.
  useEffect(() => {
    if (!otpSent) {
      router.replace('/phone-auth');
    } else if (isAuthenticated) {
      router.replace('/(tabs)');
    }
  }, [otpSent, isAuthenticated, router]);

  // Format phone number for display
  const formatPhoneNumber = (phone: string) => {
    if (!phone) return '';
    // Remove country code for display
    const cleanPhone = phone.replace(/^\+91/, '');
    return `+91 ${cleanPhone}`;
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Start SMS listener when component mounts
  useEffect(() => {
    const startSMSListener = () => {
      try {
        otpInputRef.current?.startListener();
        console.log('SMS listener started on component mount');
      } catch (error) {
        console.error('Error starting SMS listener on mount:', error);
      }
    };

    // Start SMS listener after a short delay to ensure component is fully mounted
    const timer = setTimeout(startSMSListener, 100);

    return () => {
      clearTimeout(timer);
    };
  }, []);

  // Cleanup SMS listener when component unmounts
  useEffect(() => {
    return () => {
      try {
        otpInputRef.current?.forceCleanup();
        console.log('SMS listener cleaned up on component unmount');
      } catch (error) {
        console.error('Error cleaning up SMS listener on unmount:', error);
      }
    };
  }, []);

  // Keyboard event listeners
  useEffect(() => {
    const keyboardWillShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (event) => {
        setKeyboardHeight(event.endCoordinates.height);
        setIsKeyboardVisible(true);
        // Scroll to keep OTP input visible
        setTimeout(() => {
          scrollViewRef.current?.scrollTo({
            y: Math.max(screenHeight * 0.2, 200), // Increased scroll position to avoid overlap
            animated: true,
          });
        }, 150);
      }
    );

    const keyboardWillHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
        setIsKeyboardVisible(false);
        
        // Reset scroll position and blur any focused input
        setTimeout(() => {
          scrollViewRef.current?.scrollTo({
            y: 0,
            animated: true,
          });
          // Blur the OTP input to reset focus state
          Keyboard.dismiss();
        }, 100);
      }
    );

    return () => {
      keyboardWillShowListener.remove();
      keyboardWillHideListener.remove();
    };
  }, []);

  // Only reset OTP state on unmount
  useEffect(() => {
    return () => {
      resetAuthLoading();
    };
  }, [resetAuthLoading]);

  const handleVerifyOTP = async (otpToVerify?: string) => {
    const currentOTP = otpToVerify || otp;
    
    if (!currentOTP || currentOTP.length !== 6) {
      return;
    }

    // Prevent multiple verifications
    if (loading || isVerifying || verificationComplete || currentOTP === lastOtpAttempt) {
      console.log('Preventing duplicate OTP verification:', {
        loading,
        isVerifying,
        verificationComplete,
        sameOtp: currentOTP === lastOtpAttempt,
        currentOTP,
        lastOtpAttempt
      });
      return;
    }

    console.log('Starting OTP verification process...');
    setLoading(true);
    setIsVerifying(true);
    setError(false);
    setLastOtpAttempt(currentOTP);
    
    try {
      console.log('Verifying OTP using global auth context...');
      
      // Use global auth context to verify OTP and get the result
      const result = await verifyOTP(phoneNumber as string, currentOTP);
      
      console.log('OTP verification completed, result:', result);
      
      // Stop SMS listener since verification is complete
      try {
        otpInputRef.current?.forceCleanup();
        console.log('SMS listener stopped after verification');
      } catch (error) {
        console.error('Error stopping SMS listener:', error);
      }
      // Navigate based on the verification result
      if (result.isAuthenticated) {
        console.log('✅ User authenticated successfully, redirecting to main app');
        setVerificationComplete(true);
        setLoading(false);
        setIsVerifying(false);

        // Use router.replace for consistent navigation
        router.replace('/(tabs)');
      } else if (result.needsProfile) {
        console.log('🆕 New user detected, redirecting to welcome page for profile completion');
        setVerificationComplete(true);
        setLoading(false);
        setIsVerifying(false);

        // For new users, navigate to welcome page with phone number
        router.replace({
          pathname: '/welcome-user' as any,
          params: { 
            phoneNumber: phoneNumber as string
          }
        });
      }
      
    } catch (error: any) {
      console.error('OTP verification error:', error);
      setError(true);
      
      // Handle specific Firebase error codes with translated messages
      let errorMessage = t('otpVerify.errors.verificationFailed');
      
      if (error.message) {
        if (error.message.includes('Invalid verification code') || error.message.includes('Invalid OTP')) {
          errorMessage = t('otpVerify.errors.invalidOTP');
        } else if (error.message.includes('expired')) {
          errorMessage = t('otpVerify.errors.verificationFailed');
        } else if (error.message.includes('Network error')) {
          errorMessage = t('common.networkError') || 'Network error. Please check your connection';
            }
      }
      
      Alert.alert(
        t('common.error'), 
        errorMessage,
        [{ text: t('common.ok'), style: 'default' }]
      );
    } finally {
      setLoading(false);
      setIsVerifying(false);
    }
  };

  const handleResendOTP = async () => {
    if (resendLoading || !canResend) {
      return;
    }

    setResendLoading(true);
    setError(false);

    try {
      console.log('Resending OTP using MSG91...');
      
      const result = await msg91OtpService.retryOTP();
      
      if (result.success) {
        console.log('MSG91 OTP resent successfully');
        
        // Reset timer
        setResendTimer(30);
        setCanResend(false);
        
        // Start countdown
        const timer = setInterval(() => {
          setResendTimer((prev) => {
            if (prev <= 1) {
              clearInterval(timer);
              setCanResend(true);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);

        Alert.alert(
          t('common.success'), 
          t('otpVerify.success.resent', 'OTP has been resent to your phone number')
        );
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      console.error('MSG91 Resend OTP error:', error);
      
      // Handle specific MSG91 error codes
      if (error.message?.includes('too many requests')) {
        Alert.alert(
          t('common.error'), 
          t('otpVerify.errors.tooManyRequests', 'Too many requests. Please try again later.')
        );
      } else if (error.message?.includes('quota exceeded')) {
        Alert.alert(
          t('common.error'), 
          t('otpVerify.errors.quotaExceeded', 'SMS quota exceeded. Please try again later.')
        );
      } else if (error.message?.includes('invalid phone')) {
        Alert.alert(
          t('common.error'), 
          t('otpVerify.errors.invalidPhone', 'Invalid phone number format.')
        );
      } else if (error.message?.includes('network')) {
        Alert.alert(
          t('common.error'), 
          t('otpVerify.errors.networkError', 'Network error. Please check your connection.')
        );
      } else {
        // Generic error fallback
        Alert.alert(t('common.error'), t('otpVerify.errors.resendFailed'));
      }
    } finally {
      setResendLoading(false);
    }
  };

  const handleOTPComplete = (completedOTP: string) => {
    // Don't do anything if verification is already complete
    if (verificationComplete) {
      return;
    }

    setOtp(completedOTP);

    // Don't auto-verify if there's an error state or if it's the same OTP that just failed
    if (error && completedOTP === lastOtpAttempt) {
      console.log('Not auto-verifying failed OTP:', completedOTP);
      return;
    }

    setError(false);

    // Auto-verify when OTP is complete
    if (completedOTP.length === 6 && !loading && !isVerifying && !verificationComplete) {
      handleVerifyOTP(completedOTP);
    }
  };

  const handleOTPChange = (newOtp: string) => {
    // Don't allow changes if verification is complete
    if (verificationComplete) {
      return;
    }

    setOtp(newOtp);

    // Clear error state when user starts typing a new OTP
    if (newOtp !== lastOtpAttempt) {
      setError(false);
    }
  };

  return (
    <SafeAreaLayout
      backgroundImage={require('@/assets/otp_bg.jpg')}
      gradient={{
        colors: ['rgba(0, 0, 0, 0.5)', 'rgba(0, 0, 0, 0.7)'],
        locations: [0, 1]
      }}
      statusBarStyle="light-content"
      edges={['top', 'left', 'right', 'bottom']}
      contentStyle={styles.container}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <KeyboardAvoidingView 
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <ScrollView 
            ref={scrollViewRef}
            contentContainerStyle={[
              styles.scrollContainer,
              {
                paddingBottom: isKeyboardVisible 
                  ? Math.max(keyboardHeight * 0.1, hp('5%'))
                  : hp('5%'),
                minHeight: isKeyboardVisible 
                  ? screenHeight - keyboardHeight - insets.top
                  : screenHeight - insets.top - insets.bottom,
              }
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
            automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
          >
            {/* Content */}
            <View style={[
              styles.content,
              {
                justifyContent: 'center',
                paddingTop: hp('5%'),
              }
            ]}>
              <View style={styles.headerContainer}>
                <Text style={styles.title}>{t('otpVerify.verifyPhone')}</Text>
                <Text style={styles.subtitle}>
                  {t('otpVerify.subtitle')}{'\n'}
                  <Text style={styles.phoneNumber}>{formatPhoneNumber(phoneNumber as string)}</Text>
                </Text>
              </View>

              <View style={[
                styles.formContainer,
                {
                  marginBottom: isKeyboardVisible ? hp('2%') : hp('4%'),
                }
              ]}>
                <View style={styles.otpContainer}>
                  <OTPInput
                    ref={otpInputRef}
                    length={6}
                    value={otp}
                    onChange={handleOTPChange}
                    onComplete={handleOTPComplete}
                    error={error}
                    autoFocus={false}
                  />
                </View>

                {error && (
                  <View style={styles.errorContainer}>
                    <View style={styles.errorIconContainer}>
                      <MaterialCommunityIcons 
                        name="alert-circle" 
                        size={RFValue(24)} 
                        color="#ff5252" 
                      />
                    </View>
                    <View style={styles.errorTextContainer}>
                      <Text style={styles.errorTitle}>{t('otpVerify.errors.invalidOTPTitle')}</Text>
                      <Text style={styles.errorMessage}>{t('otpVerify.errors.invalidOTP')}</Text>
                    </View>
                  </View>
                )}

                {/* Manual verify button with loading state */}
                {otp.length === 6 && (
                  <TouchableOpacity
                    style={[styles.verifyButton, (loading || isVerifying) && styles.buttonDisabled]}
                    onPress={() => handleVerifyOTP(otp)}
                    disabled={loading || isVerifying}
                  >
                    <LinearGradient
                      colors={['#ffffff', '#f8f9fa']}
                      style={styles.buttonGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      {(loading || isVerifying) ? (
                        <>
                          <ActivityIndicator color="#2e7d32" size="small" />
                          <Text style={styles.verifyButtonText}>{t('otpVerify.verifying')}</Text>
                        </>
                      ) : (
                        <>
                          <Text style={styles.verifyButtonText}>{t('otpVerify.verifyButton')}</Text>
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                )}

                <View style={styles.resendContainer}>
                  <Text style={styles.resendText}>{t('otpVerify.resendText')}</Text>
                  <TouchableOpacity
                    onPress={handleResendOTP}
                    disabled={!canResend || loading || isVerifying || resendLoading}
                    style={styles.resendButton}
                  >
                    {resendLoading ? (
                      <View style={styles.resendLoadingContainer}>
                        <ActivityIndicator color="#fff" size="small" />
                        <Text style={[styles.resendButtonText, styles.disabledText]}>{t('otpVerify.sending')}</Text>
                      </View>
                    ) : (
                      <Text style={[styles.resendButtonText, (!canResend || loading || isVerifying) && styles.disabledText]}>
                        {canResend ? t('otpVerify.resendButton') : t('otpVerify.resendTimer', { seconds: resendTimer })}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>

                {!isKeyboardVisible && (
                  <Text style={styles.termsText}>{t('otpVerify.termsText')}</Text>
                )}
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </SafeAreaLayout>
  );
}

const styles = StyleSheet.create<Styles>({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: wp('6%'),
    paddingVertical: hp('2%'),
    minHeight: screenHeight * 0.85, // Ensure minimum height for proper centering
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: hp('2%'),
    marginBottom: hp('3%'),
    position: 'absolute',
    top: 0,
    left: wp('6%'),
    right: wp('6%'),
    zIndex: 1,
  },

  backButton: {
    padding: wp('2.5%'),
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: wp('6%'),
    marginRight: wp('4%'),
  },
  headerTitle: {
    fontSize: RFValue(14),
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },
  mainContent: {
    flex: 1,
    justifyContent: 'center',
    paddingTop: hp('8%'), // Account for header space
    paddingVertical: hp('2%'),
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: hp('4%'),
  },
  appName: {
    fontSize: screenHeight < 700 ? RFValue(22) : RFValue(26),
    fontWeight: '800',
    color: '#fff',
    marginBottom: hp('1%'),
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
    letterSpacing: 1,
  },
  welcomeText: {
    fontSize: screenHeight < 700 ? RFValue(14) : RFValue(17),
    fontWeight: '600',
    color: '#e8f5e8',
    marginBottom: hp('0.5%'),
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  subtitleText: {
    fontSize: screenHeight < 700 ? RFValue(11) : RFValue(13),
    color: '#c8e6c9',
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: screenHeight < 700 ? RFValue(16) : RFValue(19),
    paddingHorizontal: wp('4%'),
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  formCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: wp('6%'),
    padding: wp('6%'),
    marginHorizontal: wp('2%'),
    marginBottom: hp('3%'),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  formHeader: {
    alignItems: 'center',
    marginBottom: hp('3%'),
  },
  formTitle: {
    fontSize: screenHeight < 700 ? RFValue(15) : RFValue(17),
    fontWeight: '700',
    color: '#fff',
    marginTop: hp('1%'),
    marginBottom: hp('1%'),
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  formSubtitle: {
    fontSize: screenHeight < 700 ? RFValue(10) : RFValue(12),
    color: '#e8f5e8',
    textAlign: 'center',
    fontWeight: '500',
    marginBottom: hp('0.5%'),
    lineHeight: screenHeight < 700 ? RFValue(14) : RFValue(17),
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  phoneNumberText: {
    fontSize: screenHeight < 700 ? RFValue(11) : RFValue(13),
    color: '#4CAF50',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: hp('2%'),
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  otpSection: {
    alignItems: 'center',
    marginBottom: screenHeight < 700 ? hp('2.5%') : hp('3%'),
  },
  otpLabel: {
    fontSize: RFValue(12),
    fontWeight: '600',
    color: '#fff',
    marginBottom: hp('1.5%'),
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  otpContainer: {
    marginBottom: hp('2%'),
  },
  errorText: {
    fontSize: RFValue(13),
    color: '#ff5252',
    fontWeight: '600',
    textAlign: 'left',
    flex: 1,
  },
  successText: {
    fontSize: RFValue(10),
    color: '#4CAF50',
    textAlign: 'center',
    marginTop: hp('1%'),
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  verifyButton: {
    borderRadius: wp('6%'),
    overflow: 'hidden',
    marginTop: hp('1.5%'),
    marginBottom: hp('2%'),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: hp('2%'),
    paddingHorizontal: wp('8%'),
    gap: wp('3%'),
  },
  buttonText: {
    fontSize: RFValue(14),
    fontWeight: '700',
    color: '#2e7d32',
    letterSpacing: 0.5,
  },
  buttonDisabled: {
    shadowOpacity: 0.1,
  },
  resendSection: {
    alignItems: 'center',
    paddingTop: hp('2%'),
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  timerText: {
    fontSize: RFValue(11),
    color: '#c8e6c9',
    textAlign: 'center',
    marginBottom: hp('1%'),
    fontWeight: '500',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  resendButton: {
    padding: wp('3%'),
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: wp('4%'),
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.3)',
  },
  resendButtonText: {
    fontSize: RFValue(12),
    color: '#4CAF50',
    fontWeight: '600',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  // Keyboard-aware styling
  keyboardActiveContent: {
    paddingTop: screenHeight < 700 ? hp('4%') : hp('6%'),
    paddingBottom: hp('1%'),
  },
  keyboardActiveLogoSection: {
    marginBottom: screenHeight < 700 ? hp('2%') : hp('3%'),
  },
  keyboardActiveFormCard: {
    padding: wp('4%'),
    marginBottom: screenHeight < 700 ? hp('1%') : hp('2%'),
  },
  keyboardActiveFormHeader: {
    marginBottom: screenHeight < 700 ? hp('1.5%') : hp('2%'),
  },
  keyboardActiveOtpSection: {
    marginBottom: screenHeight < 700 ? hp('1.5%') : hp('2%'),
  },
  safeContainer: {
    flex: 1,
  },
  background: {
    flex: 1,
  },
  overlay: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: wp('6%'),
    paddingVertical: hp('2%'),
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: hp('2%'),
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: hp('4%'),
  },
  title: {
    fontSize: RFValue(28),
    fontWeight: '700',
    color: '#fff',
    marginBottom: hp('1%'),
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: RFValue(13),
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    marginTop: hp('1%'),
    lineHeight: RFValue(18),
  },
  phoneNumber: {
    fontSize: RFValue(14),
    fontWeight: '600',
    color: '#4CAF50',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  formContainer: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: wp('5%'),
    padding: wp('5%'),
    marginBottom: hp('2%'),
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(244, 67, 54, 0.08)',
    paddingVertical: hp('2%'),
    paddingHorizontal: wp('4%'),
    borderRadius: wp('3%'),
    marginTop: hp('2.5%'),
    marginBottom: hp('2%'),
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(244, 67, 54, 0.2)',
  },
  errorIconContainer: {
    marginRight: wp('3%'),
    paddingTop: hp('0.2%'),
    alignItems: 'center',
    marginTop: hp('2%'),
    paddingHorizontal: wp('2%'),
  },
  errorTextContainer: {
    flex: 1,
  },
  errorTitle: {
    fontSize: RFValue(14),
    fontWeight: '600',
    color: '#ff5252',
    marginBottom: hp('0.5%'),
  },
  errorMessage: {
    fontSize: RFValue(12),
    color: '#ff5252',
    opacity: 0.8,
  },
  verifyButtonText: {
    fontSize: RFValue(14),
    fontWeight: '600',
    color: '#2e7d32',
    marginRight: wp('2%'),
  },
  resendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: hp('3%'),
  },
  resendText: {
    fontSize: RFValue(12),
    color: 'rgba(255, 255, 255, 0.7)',
    marginRight: wp('2%'),
  },
  resendLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  disabledText: {
    opacity: 0.5,
  },
  termsText: {
    fontSize: RFValue(11),
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginTop: hp('2%'),
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});

// Updated Login/Signup Screen Addition
// Add this button to your existing login and signup screens:

const PhoneAuthButton = ({ onPress }: { onPress: () => void }) => (
  <TouchableOpacity style={phoneButtonStyles.phoneButton} onPress={onPress}>
    <Ionicons name="call-outline" size={20} color="#2e7d32" />
    <Text style={phoneButtonStyles.phoneButtonText}>Continue with Phone Number</Text>
  </TouchableOpacity>
);

const phoneButtonStyles = StyleSheet.create({
  phoneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#a8e6cf',
    marginTop: 20,
    gap: 10,
  },
  phoneButtonText: {
    color: '#2e7d32',
    fontSize: 16,
    fontWeight: '600',
  },
});

export { PhoneAuthButton };
