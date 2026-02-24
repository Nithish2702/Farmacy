import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import { RFValue } from 'react-native-responsive-fontsize';
import { PhoneInput, validateIndianPhoneNumber } from '../components/PhoneInput';
import { useAuth } from '../context/AuthContext';
import { useNetworkCheck } from '../hooks/useNetworkCheck';
import { SafeAreaLayout } from '@/components/ui/SafeAreaLayout';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigationBar } from '@/hooks/useNavigationBar';

// Removed old OTP service import - now using MSG91

const height = Dimensions.get('window').height;

export default function PhoneAuthScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { sendOTP, isOtpInProgress: authLoading, resetAuthLoading, otpSent } = useAuth();
  const { checkConnectionBeforeApiCall } = useNetworkCheck();
            const { updateTheme, setTransparentBar } = useNavigationBar();

  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastSentPhone, setLastSentPhone] = useState<string | null>(null);

  // Only reset loading states on unmount (but do NOT reset OTP state here)
  useEffect(() => {
    return () => {
      setLoading(false);
      setPhoneNumber('');
      // Do NOT call resetAuthLoading here
    };
  }, []);

  // Navigate to OTP page when otpSent becomes true
  useEffect(() => {
    if (otpSent && lastSentPhone) {
      router.push({ pathname: '/otp-verify', params: { phoneNumber: lastSentPhone } });
    }
  }, [otpSent, lastSentPhone, router]);

  useFocusEffect(
    React.useCallback(() => {
      // Only reset loading if not currently in the middle of an OTP request
      if (!authLoading) {
        setLoading(false);
      }
      setLastSentPhone(null);
      // Ensure navigation bar is transparent
      updateTheme(false); // false for light theme
      setTransparentBar();
    }, [updateTheme, setTransparentBar, authLoading])
  );

  const handleSendOTP = async () => {
    // First check if number is valid
    if (!validateIndianPhoneNumber(phoneNumber)) {
      Alert.alert(
        t('common.error'), 
        t('phoneAuth.errors.invalidPhone'),
        [{ text: t('common.ok'), style: 'default' }]
      );
      return;
    }

    // Check if already loading to prevent multiple submissions
    if (loading || authLoading) {
      console.log('Already loading, preventing multiple submissions');
      return;
    }

    // Set loading state immediately
    setLoading(true);
    
    try {
      const fullPhoneNumber = '+91' + phoneNumber;
      console.log('Sending OTP to:', fullPhoneNumber);
      
      // Dismiss keyboard before sending OTP
      Keyboard.dismiss();
      
      // Check internet connectivity before sending OTP
      const hasInternet = await checkConnectionBeforeApiCall(
        async () => {
          // Use global auth context to send OTP
          await sendOTP(fullPhoneNumber);
          setLastSentPhone(fullPhoneNumber);
          return true;
        },
        false // Don't show separate cached message
      );
      
      // If no internet connection, the popup will be shown by checkConnectionBeforeApiCall
      if (!hasInternet) {
        setLoading(false); // Reset loading state if no internet
        return;
      }
      
      // If we reach here, OTP was sent successfully
      // Navigation now handled by otpSent effect
      
    } catch (error: any) {
      console.error('Send OTP error:', error);
      Alert.alert(t('common.error'), error.message || t('phoneAuth.errors.sendFailed'));
    } finally {
      setLoading(false);
      // Do NOT call resetAuthLoading here
    }
  };

  return (
    <SafeAreaLayout
      backgroundImage={require('../assets/login_backgrnd.png')}
      gradient={{
        colors: ['rgba(0, 0, 0, 0.5)', 'rgba(0, 0, 0, 0.7)'],
        locations: [0, 1]
      }}
      statusBarStyle="light-content"
      edges={['top']}
      contentStyle={styles.container}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <KeyboardAvoidingView 
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 40}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            bounces={false}
          >
            {/* Back Button */}
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <MaterialCommunityIcons name="arrow-left" size={RFValue(20)} color="#fff" />
            </TouchableOpacity>

            {/* Main Content */}
            <View style={styles.mainContent}>
              <View style={styles.welcomeSection}>
                <Text style={styles.welcomeTitle}>{t('phoneAuth.welcomeTitle')}{'\n'}
                  <Text style={styles.highlightedText}>{t('phoneAuth.appName')}</Text>
                </Text>
                <Text style={styles.welcomeSubtitle}>
                  {t('phoneAuth.subtitle')}
                </Text>
              </View>

              <View style={styles.formCard}>
                <Text style={styles.inputLabel}>{t('phoneAuth.inputLabel')}</Text>

                <PhoneInput
                  phoneNumber={phoneNumber}
                  onPhoneNumberChange={setPhoneNumber}
                />

                <TouchableOpacity
                  style={[styles.sendButton, (loading || authLoading) && styles.buttonDisabled]}
                  onPress={handleSendOTP}
                  disabled={loading || authLoading}
                >
                  <LinearGradient
                    colors={['#ffffff', '#f8f9fa']}
                    style={styles.buttonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    {(loading || authLoading) ? (
                      <ActivityIndicator color="#2e7d32" size="small" />
                    ) : (
                      <>
                        <Text style={styles.buttonText}>{t('phoneAuth.continueButton')}</Text>
                        <MaterialCommunityIcons name="arrow-right" size={RFValue(12)} color="#2e7d32" />
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View> 

              <Text style={styles.termsText}>
                {t('phoneAuth.termsText')}{' '}
                <Text style={styles.termsLink} onPress={() => router.push('/terms-of-service')}>
                  {t('phoneAuth.termsOfService')}
                </Text>
                {' '}{t('phoneAuth.and')}{' '}
                <Text style={styles.termsLink} onPress={() => router.push('/privacy-policy')}>
                  {t('phoneAuth.privacyPolicy')}
                </Text>
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </SafeAreaLayout>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: wp('6%'),
    paddingVertical: hp('2%'),
  },
  backButton: {
    position: 'absolute',
    top: hp('2%'),
    left: wp('6%'),
    zIndex: 10,
    padding: wp('3%'),
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: wp('6%'),
  },
  mainContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: hp('2%'),
  },
  welcomeSection: {
    alignItems: 'center',
    marginBottom: hp('4%'),
  },
  welcomeTitle: {
    fontSize: RFValue(28),
    fontWeight: '700',
    color: '#fff',
    marginBottom: hp('1%'),
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
    lineHeight: RFValue(36),
  },
  highlightedText: {
    color: '#4CAF50',
    fontSize: RFValue(32),
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 6,
  },
  welcomeSubtitle: {
    fontSize: RFValue(13),
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    marginTop: hp('1%'),
    lineHeight: RFValue(18),
  },
  formCard: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: wp('5%'),
    padding: wp('5%'),
    marginBottom: hp('2%'),
  },
  inputLabel: {
    fontSize: RFValue(14),
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: hp('1%'),
    fontWeight: '500',
    lineHeight: height < 700 ? RFValue(14) : RFValue(17),
    alignItems: 'center',
    paddingVertical: hp('2%'),
  },
  sendButton: {
    marginTop: hp('3%'),
    height: hp('6%'),
    borderRadius: wp('5%'),
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  buttonDisabled: {
    shadowOpacity: 0.1,
  },
  buttonGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: hp('1.5%'),
    paddingHorizontal: wp('6%'),
    gap: wp('2%'),
  },
  buttonText: {
    fontSize: RFValue(13),
    fontWeight: '700',
    color: '#2e7d32',
    letterSpacing: 0.5,
  },
  footer: {
    alignItems: 'center',
    paddingBottom: hp('2%'),
    marginTop: hp('2%'),
  },
  termsText: {
    fontSize: height < 700 ? RFValue(9) : RFValue(10),
    color: '#c8e6c9',
    textAlign: 'center',
    lineHeight: height < 700 ? RFValue(12) : RFValue(14),
    fontWeight: '500',
    paddingHorizontal: wp('4%'),
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    marginTop: hp('2%'),
  },
  termsLink: {
    color: '#2e7d32',
    textDecorationLine: 'underline',
    fontWeight: '600',
    marginRight: wp('2%'),
  },
  container: {
    flex: 1,
  },
});