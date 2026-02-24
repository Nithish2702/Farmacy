import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
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
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { authService } from '../api/authService';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationsContext';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import { RFValue } from 'react-native-responsive-fontsize';
import { useTranslation } from 'react-i18next';
import { SafeAreaLayout } from '@/components/ui/SafeAreaLayout';
import { useNavigationBar } from '@/hooks/useNavigationBar';

const { width, height } = Dimensions.get('window');

export default function WelcomeUserScreen() {
  const router = useRouter();
  const { phoneNumber } = useLocalSearchParams();
  const { 
    initializeAfterAuth, 
    isAuthenticated, 
    isLoading: authLoading, 
    isInitialized: authInitialized,
    createUser,
    phoneNumber: authPhoneNumber,
    otpVerified
  } = useAuth();
  const { registerDeviceWithBackend, handleLogout } = useNotification();
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();
  const { updateTheme, setTransparentBar } = useNavigationBar();

  // Format phone number for display
  const formatPhoneNumber = (phone: string) => {
    if (!phone) return '';
    // Remove country code for display
    const cleanPhone = phone.replace(/^\+91/, '');
    return `+91 ${cleanPhone}`;
  };

  // Ensure navigation bar is transparent
  useEffect(() => {
    updateTheme(false); // false for light theme
    setTransparentBar();
  }, [updateTheme, setTransparentBar]);

  const handleContinue = async () => {
    // Prevent multiple calls
    if (loading || authLoading) {
      console.log('Already processing or auth loading, ignoring duplicate call');
      return;
    }
    
    if (!username.trim()) {
      Alert.alert(
        t('common.error'), 
        t('welcomeUser.errors.nameRequired'),
        [{ text: t('common.ok'), style: 'default' }]
      );
      return;
    }
    
    setLoading(true);
    
    try {
      const finalUsername = username.trim();
      
      console.log('🆕 Creating new user with username:', finalUsername);
      
      // Create new user using MSG91 service
      const phoneToUse = phoneNumber as string || authPhoneNumber;
      if (!phoneToUse) {
        throw new Error('Phone number not available');
      }
      
      await createUser({
        phone_number: phoneToUse,
        username: finalUsername,
        full_name: finalUsername,
        farm_type: 'general'
      });
      
      console.log('✅ User created successfully');
      
      // Show success message and redirect
      Alert.alert(
        t('common.success'), 
        t('welcomeUser.welcome', { name: finalUsername }),
        [
          {
            text: t('welcomeUser.getStarted'),
            onPress: () => {
              // Clear the navigation stack and go to main app
              router.dismissAll();
              router.push('/slideshow');
            }
          }
        ],
        { cancelable: false }
      );
      
    } catch (error: any) {
      console.error('User creation error:', error);
      setLoading(false); // Reset loading state on error
      Alert.alert(
        t('common.error'), 
        error.message || t('welcomeUser.errors.creationFailed'),
        [
          {
            text: t('common.tryAgain'),
            onPress: () => {} // Loading is already reset above
          }
        ]
      );
    }
    // Note: Don't reset loading to false on success, let the navigation handle it
  };

  return (
    <SafeAreaLayout
      backgroundImage={require('../assets/background5.jpg')}
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
          keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 40}
        >
          <ScrollView 
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            bounces={false}
          >
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerTitle}>{t('welcomeUser.title')}</Text>
            </View>

            {/* Main Content */}
            <View style={styles.mainContent}>
              {/* Logo Section */}
              <View style={styles.logoSection}>
                <Text style={styles.appName}>{t('welcomeUser.appName')}</Text>
                <Text style={styles.welcomeText}>{t('welcomeUser.welcomeTitle')}</Text>
                <Text style={styles.subtitleText}>{t('welcomeUser.subtitle')}</Text>
              </View>

              {/* Welcome Form */}
              <View style={styles.formCard}>
                <View style={styles.formHeader}>
                  <MaterialCommunityIcons name="account-plus" size={RFValue(18)} color="#fff" />
                  <Text style={styles.formTitle}>{t('welcomeUser.formTitle')}</Text>
                  <Text style={styles.formSubtitle}>{t('welcomeUser.formSubtitle')}</Text>
                </View>

                {/* Name Input */}
                <View style={styles.inputSection}>
                  <View style={styles.inputContainer}>
                    <MaterialCommunityIcons 
                      name="account" 
                      size={RFValue(12)} 
                      color="#fff" 
                      style={styles.inputIcon} 
                    />
                    <Text style={styles.inputLabel}>{t('welcomeUser.yourName')}</Text>
                  </View>

                  <View style={styles.textInputContainer}>
                    <TextInput
                      style={styles.textInput}
                      placeholder={t('welcomeUser.namePlaceholder')}
                      placeholderTextColor="rgba(255, 255, 255, 0.6)"
                      value={username}
                      onChangeText={setUsername}
                      autoCapitalize="words"
                      autoCorrect={false}
                      maxLength={30}
                      editable={!loading}
                      returnKeyType="done"
                      onSubmitEditing={handleContinue}
                      blurOnSubmit={false}
                      underlineColorAndroid="transparent"
                    />
                  </View>
                  
                  <Text style={styles.inputHelper}>
                    {t('welcomeUser.nameHelper')}
                  </Text>
                  <Text style={styles.characterCounter}>
                    {username.length}/30
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.continueButton, loading && styles.buttonDisabled]}
                  onPress={handleContinue}
                  disabled={loading}
                >
                  <View style={styles.buttonGradient}>
                    {loading ? (
                      <ActivityIndicator color="#2e7d32" size="small" />
                    ) : (
                      <>
                        <Text style={styles.buttonText}>{t('welcomeUser.continueButton')}</Text>
                        <MaterialCommunityIcons name="arrow-right" size={RFValue(12)} color="#2e7d32" />
                      </>
                    )}
                  </View>
                </TouchableOpacity>

                <View style={styles.phoneInfoContainer}>
                  <MaterialCommunityIcons name="check-circle" size={RFValue(14)} color="#4caf50" />
                  <Text style={styles.phoneText}>
                    {t('welcomeUser.verifiedPhone')} {formatPhoneNumber(phoneNumber as string)}
                  </Text>
                </View>
              </View>

              {/* Footer */}
              <View style={styles.footer}>
                <Text style={styles.termsText}>{t('welcomeUser.termsText')}</Text>
              </View>
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
    paddingHorizontal: wp('5%'),
    paddingVertical: hp('1%'),
  },
  header: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: hp('2%'),
    marginBottom: hp('1%'),
  },
  headerTitle: {
    fontSize: RFValue(14),
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  mainContent: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: hp('1%'),
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: hp('2%'),
  },
  appName: {
    fontSize: RFValue(24),
    fontWeight: '800',
    color: '#fff',
    marginBottom: hp('0.5%'),
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
    letterSpacing: 1,
  },
  welcomeText: {
    fontSize: RFValue(16),
    fontWeight: '600',
    color: '#e8f5e8',
    marginBottom: hp('0.3%'),
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  subtitleText: {
    fontSize: RFValue(12),
    color: '#c8e6c9',
    textAlign: 'center',
    fontWeight: '500',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  formCard: {
    paddingHorizontal: wp('2%'),
    marginBottom: hp('1.5%'),
  },
  formHeader: {
    alignItems: 'center',
    marginBottom: hp('2%'),
  },
  formTitle: {
    fontSize: RFValue(16),
    fontWeight: '700',
    color: '#fff',
    marginTop: hp('0.5%'),
    marginBottom: hp('0.3%'),
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  formSubtitle: {
    fontSize: RFValue(10),
    color: '#e8f5e8',
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: RFValue(14),
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  inputSection: {
    marginBottom: hp('2%'),
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp('1%'),
  },
  inputIcon: {
    marginRight: wp('2%'),
  },
  inputLabel: {
    fontSize: RFValue(11),
    fontWeight: '600',
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  textInputContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: wp('5%'),
    borderWidth: 0,
    paddingHorizontal: wp('4%'),
    height: hp('6%'),
    justifyContent: 'center',
    elevation: 4,
  },
  textInput: {
    fontSize: RFValue(11),
    fontWeight: '500',
    color: '#fff',
    textAlignVertical: 'center',
    paddingVertical: 0,
    borderWidth: 0,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  inputHelper: {
    fontSize: RFValue(9),
    color: '#c8e6c9',
    marginTop: hp('1%'),
    textAlign: 'center',
    fontStyle: 'italic',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  characterCounter: {
    fontSize: RFValue(8),
    color: '#4caf50',
    textAlign: 'right',
    marginTop: hp('0.5%'),
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  continueButton: {
    borderRadius: wp('5%'),
    overflow: 'hidden',
    marginTop: hp('1%'),
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
    paddingVertical: hp('1.5%'),
    paddingHorizontal: wp('6%'),
    gap: wp('2%'),
    backgroundColor: '#FFFFFF',
    borderRadius: wp('5%'),
  },
  buttonText: {
    fontSize: RFValue(13),
    fontWeight: '700',
    color: '#2e7d32',
    letterSpacing: 0.5,
  },
  buttonDisabled: {
    shadowOpacity: 0.1,
  },
  phoneInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: hp('2%'),
    paddingVertical: hp('1%'),
    paddingHorizontal: wp('4%'),
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    borderRadius: wp('5%'),
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.3)',
  },
  phoneText: {
    fontSize: RFValue(10),
    color: '#4caf50',
    marginLeft: wp('2%'),
    fontWeight: '500',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  footer: {
    alignItems: 'center',
    paddingBottom: hp('1%'),
  },
  termsText: {
    fontSize: RFValue(8),
    color: '#c8e6c9',
    textAlign: 'center',
    lineHeight: RFValue(11),
    fontWeight: '500',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  linkText: {
    color: '#e8f5e8',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  container: {
    flex: 1,
  },
}); 