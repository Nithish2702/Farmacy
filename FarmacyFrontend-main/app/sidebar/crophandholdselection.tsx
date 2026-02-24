//The DateTimePicker from @react-native-community/datetimepicker has limited styling options and often doesn't properly support dark mode theming, especially on Android.
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Alert,
  ScrollView,
  Modal,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { RFValue } from 'react-native-responsive-fontsize';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import { useCropsContext } from '@/context/CropsContext';
import { NotificationPreference } from '@/hooks/useCrops';
import CropSelectorDropdown from '@/components/CropSelectorDropDown';
import { Crop } from '@/api/cropService';
import { CropTrackResponse } from '@/api/cropTrackService';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/context/theme';
import i18n from '@/i18n.config';

interface CropTrackingComponentProps {
  onTrackingStarted?: () => void;
}

const CropTrackingComponent: React.FC<CropTrackingComponentProps> = ({
  onTrackingStarted,
}) => {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors, mode } = useTheme();
  const isDarkMode = mode === 'dark';
  
  // Enhanced color palette based on current theme
  const themeColors = {
    ...colors,
    success: mode === 'dark' ? '#22C55E' : '#16A34A',
    warning: mode === 'dark' ? '#F59E0B' : '#D97706',
    info: mode === 'dark' ? '#3B82F6' : '#2563EB',
    accent: mode === 'dark' ? '#EF4444' : '#DC2626',
    white: '#FFFFFF',
    secondary: mode === 'dark' ? '#059669' : '#15803D',
    // Additional colors for better dark mode support
    modalBackground: mode === 'dark' ? '#1F2937' : '#FFFFFF',
    switchTrackColor: mode === 'dark' ? '#4B5563' : '#E5E7EB',
  };
  
  const {
    currentTracking,
    allTrackings,
    loading,
    error,
    startCropTracking,
    setCurrentCropTracking,
    isCropTracked,
    getCropTracking,
  } = useCropsContext();

  // Component state with proper TypeScript types
  const [selectedCrop, setSelectedCrop] = useState<Crop | null>(null);
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  const [showExistingTrackingModal, setShowExistingTrackingModal] = useState<boolean>(false);
  const [existingTracking, setExistingTracking] = useState<CropTrackResponse | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [trackingMode, setTrackingMode] = useState<'modify' | 'new' | null>(null);
  const [isModifying, setIsModifying] = useState<boolean>(false);
  const [localError, setLocalError] = useState<string | null>(null);
  
  // Notification preferences state with proper type
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreference>({
    dailyReminders: true,
    diseaseAlerts: true,
    weatherAlerts: false,
  });

  // Always start with current date when page loads
  useEffect(() => {
    setStartDate(new Date());
  }, []);

  // Clear local error when component unmounts or when error changes
  useEffect(() => {
    if (error) {
      setLocalError(error.message);
    } else {
      setLocalError(null);
    }
  }, [error]);

  const clearLocalError = () => {
    setLocalError(null);
  };

  const handleCropSelect = (crop: Crop | null) => {
    if (loading.crops || isProcessing) return;
    
    if (crop) {
      setSelectedCrop(crop);
      
      // Check if crop is already being tracked
      if (isCropTracked(crop.id)) {
        const tracking = getCropTracking(crop.id);
        setExistingTracking(tracking || null);
        setShowExistingTrackingModal(true);
        setTrackingMode(null); // Reset tracking mode
        
        // Set the existing tracking's start date for modification
        if (tracking?.startDate) {
          setStartDate(new Date(tracking.startDate));
        }
      } else {
        setTrackingMode('new');
        setExistingTracking(null);
        setShowExistingTrackingModal(false);
        setStartDate(new Date()); // Reset date for new crop
      }
    } else {
      setSelectedCrop(null);
      setTrackingMode(null);
      setExistingTracking(null);
    }
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (isProcessing) return;
    
    setShowDatePicker(false);
    if (selectedDate) {
      setStartDate(selectedDate);
    }
  };

  const handleNotificationToggle = (key: keyof NotificationPreference) => {
    if (isProcessing) return;
    
    setNotificationPreferences(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleGoToHome = () => {
    router.push('/(tabs)');
  };

  const showSuccessAndGoHome = (isModifying: boolean = false) => {
    const title = isModifying ? t('dashboard.errors.success') : t('dashboard.errors.success');
    const message = isModifying 
      ? t('dashboard.errors.modifiedSuccessfully') 
      : t('dashboard.errors.cropAddedSuccessfully');
    
    Alert.alert(
      title,
      message,
      [
        {
          text: t('dashboard.errors.goToHome'),
          onPress: () => {
            // Notify parent component before going home
            if (onTrackingStarted) {
              onTrackingStarted();
            }
            handleGoToHome();
          },
        }
      ]
    );
  };

  const handleStartTracking = async () => {
    if (!selectedCrop || !startDate) {
      Alert.alert(t('dashboard.errors.error'), t('dashboard.errors.selectCropAndDate'));
      return;
    }

    try {
      setIsProcessing(true);
      setLocalError(null);
      
      // Start crop tracking - this will also set it as current tracking
      const result = await startCropTracking({
        cropId: selectedCrop.id,
        startDate: startDate.toISOString(),
        notificationPreferences: notificationPreferences
      });

      if (result) {
        // Close modal and reset state
        setShowExistingTrackingModal(false);
        setSelectedCrop(null);
        setStartDate(new Date());
        setTrackingMode(null);
        setNotificationPreferences({
          dailyReminders: true,
          diseaseAlerts: true,
          weatherAlerts: true
        });

        // Notify parent component
        if (onTrackingStarted) {
          onTrackingStarted();
        }

        // Show success message and offer to go home
        showSuccessAndGoHome(false);
      } else {
        throw new Error(t('dashboard.errors.startTrackingFailed'));
      }
    } catch (error: any) {
      console.error('Error starting tracking:', error);
      setLocalError(error.message || t('dashboard.errors.startTrackingFailed'));
      Alert.alert(
        t('dashboard.errors.error'),
        error.message || t('dashboard.errors.startTrackingFailed')
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleModifyExistingTracking = async () => {
    if (!selectedCrop || !existingTracking) {
      Alert.alert(t('dashboard.errors.error'), t('dashboard.errors.selectCrop'));
      return;
    }

    try {
      setIsProcessing(true);
      setIsModifying(true);
      setLocalError(null);
      
      // Update the existing tracking with new date
      const result = await startCropTracking({
        cropId: selectedCrop.id,
        startDate: startDate.toISOString(),
        notificationPreferences: notificationPreferences
      });

      if (result) {
        // Close modal and reset state
        setShowExistingTrackingModal(false);
        setSelectedCrop(null);
        setStartDate(new Date());
        setTrackingMode(null);
        setExistingTracking(null);
        setNotificationPreferences({
          dailyReminders: true,
          diseaseAlerts: true,
          weatherAlerts: true
        });

        // Notify parent component
        if (onTrackingStarted) {
          onTrackingStarted();
        }

        // Show success message and offer to go home
        showSuccessAndGoHome(true);
      } else {
        throw new Error(t('dashboard.errors.modifyTrackingFailed'));
      }
    } catch (error: any) {
      console.error('Error modifying tracking:', error);
      setLocalError(error.message || t('dashboard.errors.modifyTrackingFailed'));
      Alert.alert(
        t('dashboard.errors.error'),
        error.message || t('dashboard.errors.modifyTrackingFailed')
      );
    } finally {
      setIsProcessing(false);
      setIsModifying(false);
    }
  };

  const handleUseExistingTracking = async () => {
    if (!selectedCrop) {
      Alert.alert(t('dashboard.errors.error'), t('dashboard.errors.selectCrop'));
      return;
    }

    try {
      setIsProcessing(true);
      setLocalError(null);
      
      // First check if the crop is already being tracked
      const existingTracking = getCropTracking(selectedCrop.id);
      
      if (!existingTracking) {
        Alert.alert(t('dashboard.errors.error'), t('dashboard.errors.cropNotTracked'));
        return;
      }

      // Set as current tracking
      const result = await setCurrentCropTracking(selectedCrop.id);
      
      if (result) {
        // Close modal and reset state
        setShowExistingTrackingModal(false);
        setSelectedCrop(null);
        setTrackingMode(null);

        // Notify parent component
        if (onTrackingStarted) {
          onTrackingStarted();
        }

        // Show success message and offer to go home
        showSuccessAndGoHome(false);
      } else {
        throw new Error(t('dashboard.errors.setCurrentTrackingFailed'));
      }
    } catch (error: any) {
      console.error('Error using existing tracking:', error);
      setLocalError(error.message || t('dashboard.errors.setCurrentTrackingFailed'));
      Alert.alert(
        t('dashboard.errors.error'),
        error.message || t('dashboard.errors.setCurrentTrackingFailed')
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateNewTracking = () => {
    if (isProcessing) return;
    setTrackingMode('new');
    setShowExistingTrackingModal(false);
  };

  const handleModifyDate = () => {
    if (isProcessing) return;
    setTrackingMode('modify');
    setShowExistingTrackingModal(false);
  };

  const handleCancelSelection = () => {
    if (isProcessing) return;
    setSelectedCrop(null);
    setTrackingMode(null);
    setExistingTracking(null);
    setShowExistingTrackingModal(false);
    setStartDate(new Date()); // Reset date to current date
  };

  const formatDate = (date: Date): string => {
    const currentLanguage = i18n.language;
    
    // Map language codes to locale codes
    const localeMap: { [key: string]: string } = {
      'en': 'en-US',
      'hi': 'hi-IN',
      'te': 'te-IN'
    };
    
    const locale = localeMap[currentLanguage] || 'en-US';
    
    try {
      return date.toLocaleDateString(locale, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch (error) {
      // Fallback to translation keys if locale is not supported
      const weekdays = [
        t('common.days.sunday'),
        t('common.days.monday'),
        t('common.days.tuesday'),
        t('common.days.wednesday'),
        t('common.days.thursday'),
        t('common.days.friday'),
        t('common.days.saturday')
      ];
      
      const months = [
        t('common.months.january'),
        t('common.months.february'),
        t('common.months.march'),
        t('common.months.april'),
        t('common.months.may'),
        t('common.months.june'),
        t('common.months.july'),
        t('common.months.august'),
        t('common.months.september'),
        t('common.months.october'),
        t('common.months.november'),
        t('common.months.december')
      ];
      
      const weekday = weekdays[date.getDay()];
      const month = months[date.getMonth()];
      const day = date.getDate();
      const year = date.getFullYear();
      
      return `${weekday}, ${month} ${day}, ${year}`;
    }
  };

  const renderCurrentTracking = () => {
    if (!currentTracking) return null;

    return (
      <View style={[
        styles.currentTrackingCard,
        { backgroundColor: themeColors.card }
      ]}>
        <View style={styles.currentTrackingHeader}>
          <Ionicons name="leaf" size={24} color={themeColors.success} />
          <Text style={[
            styles.currentTrackingTitle,
            { color: themeColors.text }
          ]}>
            {t('dashboard.currentlyTrackingTitle')}
          </Text>
        </View>
        <Text style={[
          styles.currentTrackingCrop,
          { color: themeColors.textSecondary }
        ]}>
          {t('dashboard.week')} {currentTracking.currentWeek || 1}
        </Text>
        <Text style={[
          styles.currentTrackingDate,
          { color: themeColors.textSecondary }
        ]}>
          {t('dashboard.started')}: {formatDate(new Date(currentTracking.startDate))}
        </Text>
      </View>
    );
  };

  const renderNotificationPreferences = () => (
    <View style={[
      styles.section,
      { backgroundColor: themeColors.card }
    ]}>
      <Text style={[
        styles.sectionTitle,
        { color: themeColors.text }
      ]}>
        {t('dashboard.notificationSection')}
      </Text>
      
      <View style={styles.notificationInfo}>
        <Ionicons 
          name="notifications" 
          size={20} 
          color={themeColors.success} 
        />
        <Text style={[
          styles.notificationText,
          { color: themeColors.textSecondary }
        ]}>
          {t('dashboard.dailyNotificationsMessage')}
        </Text>
      </View>
    </View>
  );

  const renderDatePicker = () => (
    <View style={[
      styles.section,
      { backgroundColor: themeColors.card }
    ]}>
      <Text style={[
        styles.sectionTitle,
        { color: themeColors.text }
      ]}>
        {trackingMode === 'modify' ? t('dashboard.modifyDate') : t('dashboard.startDate')}
      </Text>
      
      <TouchableOpacity
        style={[
          styles.datePickerButton,
          { 
            backgroundColor: themeColors.background,
            borderColor: themeColors.border,
            opacity: isProcessing ? 0.5 : 1
          }
        ]}
        onPress={() => !isProcessing && setShowDatePicker(true)}
        disabled={isProcessing}
      >
        <Ionicons 
          name="calendar" 
          size={20} 
          color={themeColors.textSecondary} 
        />
        <Text style={[
          styles.datePickerText,
          { color: themeColors.text }
        ]}>
          {formatDate(startDate)}
        </Text>
        <Ionicons 
          name="chevron-down" 
          size={20} 
          color={themeColors.textSecondary} 
        />
      </TouchableOpacity>

      {showDatePicker && (
        <DateTimePicker
          value={startDate}
          mode="date"
          display="default"
          onChange={handleDateChange}
          maximumDate={new Date()}
          // Add these props for dark mode support
          themeVariant={isDarkMode ? 'dark' : 'light'}
          textColor={isDarkMode ? '#FFFFFF' : '#000000'}
          accentColor={themeColors.success}
          // For iOS, you can also set the background color
          {...(Platform.OS === 'ios' && {
            style: {
              backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF',
            }
          })}
        />
      )}
    </View>
  );

  const renderExistingTrackingModal = () => (
    <Modal
      visible={showExistingTrackingModal}
      transparent
      animationType="slide"
      onRequestClose={handleCancelSelection}
    >
      <View style={[
        styles.modalContainer, 
        { backgroundColor: isDarkMode ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.5)' }
      ]}>
        <View style={[
          styles.modalContent, 
          { backgroundColor: themeColors.modalBackground }
        ]}>
          <Text style={[
            styles.modalTitle, 
            { color: themeColors.text }
          ]}>
            {t('dashboard.modal.cropAlreadyExists')}
          </Text>
          
          <Text style={[
            styles.modalDescription,
            { color: themeColors.textSecondary }
          ]}>
            {t('dashboard.modal.cropAlreadyExistsDescription')}
          </Text>
          
          <TouchableOpacity
            style={[
              styles.modalButton, 
              { 
                backgroundColor: themeColors.success,
                borderColor: themeColors.success,
                borderWidth: 1
              }
            ]}
            onPress={handleModifyDate}
            disabled={isProcessing}
          >
            <Text style={[
              styles.modalButtonText, 
              { color: themeColors.white }
            ]}>
              {t('dashboard.modal.modifyExistingCrop')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.modalButton, 
              { 
                backgroundColor: 'transparent',
                borderColor: themeColors.border,
                borderWidth: 1
              }
            ]}
            onPress={handleCancelSelection}
            disabled={isProcessing}
          >
            <Text style={[
              styles.modalButtonText, 
              { color: themeColors.textSecondary }
            ]}>
              {t('dashboard.modal.cancel')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  if (localError) {
    return (
      <View style={[
        styles.errorContainer,
        { backgroundColor: themeColors.background }
      ]}>
        <Ionicons name="alert-circle" size={32} color={themeColors.error} />
        <Text style={[
          styles.errorText,
          { color: themeColors.text }
        ]}>
          {localError}
        </Text>
        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: themeColors.success }]}
          onPress={clearLocalError}
        >
          <Text style={styles.retryButtonText}>{t('dashboard.errors.tryAgain')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: themeColors.background }}>
      {/* Header */}
      <View style={[
        styles.header,
        { 
          backgroundColor: themeColors.card,
          borderBottomColor: themeColors.border
        }
      ]}>
        <TouchableOpacity
          style={[
            styles.backButton,
            { backgroundColor: isDarkMode ? '#374151' : '#F3F4F6' }
          ]}
          onPress={() => router.back()}
        >
          <Ionicons 
            name="arrow-back" 
            size={24} 
            color={themeColors.text} 
          />
        </TouchableOpacity>
        <Text style={[
          styles.headerTitle,
          { color: themeColors.text }
        ]}>
          {t('dashboard.title')}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={[
          styles.container,
          { backgroundColor: themeColors.background }
        ]}
        showsVerticalScrollIndicator={false}
      >
        {renderCurrentTracking()}

        <View style={[
          styles.section,
          { backgroundColor: themeColors.card }
        ]}>
          <Text style={[
            styles.sectionTitle,
            { color: themeColors.text }
          ]}>
            {t('dashboard.selectCrop')}
          </Text>
          
          {loading.crops ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={themeColors.success} />
              <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>
                {t('common.loadingData')}
              </Text>
            </View>
          ) : (
            <CropSelectorDropdown
              isDarkMode={isDarkMode}
              selectSingle={true}
              onCropSelect={handleCropSelect}
              defaultSelectedCrop={selectedCrop ? { id: selectedCrop.id, name: `${selectedCrop.name} ${selectedCrop.variety}` } : null}
            />
          )}
        </View>

        {renderDatePicker()}
        {renderNotificationPreferences()}

        <TouchableOpacity
          style={[
            styles.startButton,
            { 
              opacity: (!selectedCrop || isProcessing) ? 0.5 : 1,
              backgroundColor: themeColors.success
            }
          ]}
          onPress={trackingMode === 'modify' ? handleModifyExistingTracking : handleStartTracking}
          disabled={Boolean(!selectedCrop || isProcessing)}
        >
          {isProcessing ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <>
              <Ionicons name="play" size={20} color="white" />
              <Text style={styles.startButtonText}>
                {trackingMode === 'modify' ? t('dashboard.modifyTracking') : t('dashboard.startTracking')}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {renderExistingTrackingModal()}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: wp('4%'),
    paddingVertical: wp('3%'),
    borderBottomWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  backButton: {
    padding: wp('2%'),
    borderRadius: wp('2%'),
  },
  headerTitle: {
    fontSize: RFValue(18),
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: wp('12%'),
  },
  container: {
    flex: 1,
    padding: wp('4%'),
  },
  currentTrackingCard: {
    borderRadius: wp('3%'),
    padding: wp('4%'),
    marginBottom: wp('4%'),
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  currentTrackingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: wp('2%'),
  },
  currentTrackingTitle: {
    fontSize: RFValue(16),
    fontWeight: '600',
    marginLeft: wp('2%'),
  },
  currentTrackingCrop: {
    fontSize: RFValue(14),
    fontWeight: '500',
    marginBottom: wp('1%'),
  },
  currentTrackingDate: {
    fontSize: RFValue(12),
  },
  section: {
    borderRadius: wp('3%'),
    padding: wp('4%'),
    marginBottom: wp('4%'),
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 1,
  },
  sectionTitle: {
    fontSize: RFValue(16),
    fontWeight: '600',
    marginBottom: wp('3%'),
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: wp('3%'),
    borderRadius: wp('2%'),
    borderWidth: 1,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 1,
  },
  datePickerText: {
    flex: 1,
    marginLeft: wp('2%'),
    fontSize: RFValue(14),
  },
  preferenceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: wp('2%'),
    borderBottomWidth: 0.5,
  },
  preferenceLabel: {
    fontSize: RFValue(14),
    fontWeight: '500',
    flex: 1,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: wp('4%'),
    borderRadius: wp('3%'),
    marginVertical: wp('4%'),
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  startButtonText: {
    color: 'white',
    fontSize: RFValue(16),
    fontWeight: '600',
    marginLeft: wp('2%'),
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: wp('8%'),
  },
  errorText: {
    fontSize: RFValue(16),
    textAlign: 'center',
    marginVertical: wp('4%'),
    lineHeight: RFValue(24),
  },
  retryButton: {
    paddingHorizontal: wp('6%'),
    paddingVertical: wp('3%'),
    borderRadius: wp('2%'),
    marginTop: wp('2%'),
  },
  retryButtonText: {
    color: 'white',
    fontSize: RFValue(14),
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    padding: wp('5%'),
    borderRadius: wp('3%'),
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  modalTitle: {
    fontSize: RFValue(18),
    fontWeight: '600',
    marginBottom: wp('4%'),
    textAlign: 'center',
  },
  modalDescription: {
    fontSize: RFValue(14),
    textAlign: 'center',
    marginBottom: wp('4%'),
    lineHeight: RFValue(20),
  },
  modalButton: {
    padding: wp('4%'),
    borderRadius: wp('2%'),
    marginBottom: wp('3%'),
    alignItems: 'center',
  },
  modalButtonText: {
    fontWeight: '600',
    textAlign: 'center',
    fontSize: RFValue(14),
  },
  notificationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: wp('2%'),
  },
  notificationText: {
    marginLeft: wp('2%'),
    fontSize: RFValue(14),
    flex: 1,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: wp('8%'),
  },
  loadingText: {
    fontSize: RFValue(14),
    marginTop: wp('2%'),
    textAlign: 'center',
  },
});

export default CropTrackingComponent;