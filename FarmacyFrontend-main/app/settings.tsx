import { ThemeContext } from '@/context/theme';
import { useAuth } from '@/context/AuthContext';
import { Picker } from '@react-native-picker/picker';
import { useContext, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  StyleSheet,
  Switch,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { RFValue } from 'react-native-responsive-fontsize';
import { heightPercentageToDP as hp, widthPercentageToDP as wp } from 'react-native-responsive-screen';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authService } from '@/api/authService';
import { notificationService, NotificationSettings } from '@/api/notificationService';
import { SafeAreaLayout } from '@/components/ui/SafeAreaLayout';

const SettingsScreen = () => {
  const { t, i18n } = useTranslation();
  const { mode, toggleTheme, colors, isLoading: themeLoading } = useContext(ThemeContext);
  const { user, selectLanguage, syncUserData, isAuthenticated, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const isDarkMode = mode === 'dark';

  const [language, setLanguage] = useState(i18n.language);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(user?.username || '');
  const [isSavingName, setIsSavingName] = useState(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);

  // Notification settings state
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    email_notifications: true,
    sms_notifications: false,
    push_notifications: true,
    notification_types: {
      daily_updates: true,
      disease_alerts: false,
      weather_alerts: true,
      market_updates: false,
      news_alerts: false,
    },
    notification_times: {
      daily_update_time: '08:00',
      alert_time: 'any',
    },
    topics: {
      weather: true,
      market: false,
      disease: false,
      news: false,
    },
  });

  // Check current language in AsyncStorage when component mounts
  useEffect(() => {
    const checkStoredLanguage = async () => {
      try {
        const storedLang = await AsyncStorage.getItem('language');
        console.log('[LANGUAGE DEBUG] Current stored language in AsyncStorage:', storedLang);
      } catch (error) {
        console.error('[LANGUAGE DEBUG] Error checking stored language:', error);
      }
    };
    checkStoredLanguage();
  }, []);

  // Load notification settings from backend
  useEffect(() => {
    const loadNotificationSettings = async () => {
      if (!isAuthenticated) return;

      try {
        setIsLoadingSettings(true);
        const settings = await notificationService.getNotificationSettings();
        setNotificationSettings(settings);
        console.log('[SETTINGS] Notification settings loaded:', settings);
      } catch (error) {
        console.error('[SETTINGS] Failed to load notification settings:', error);
        // Keep default settings if loading fails
      } finally {
        setIsLoadingSettings(false);
      }
    };

    loadNotificationSettings();
  }, [isAuthenticated]);

  const handleLanguageChange = async (langCode: string) => {
    console.log(`[LANGUAGE DEBUG] Language change requested: ${language} -> ${langCode}`);
    setLanguage(langCode);

    try {
      // Call the context function to update language
      await selectLanguage(langCode);

      // Verify the language was saved to AsyncStorage
      setTimeout(async () => {
        try {
          const storedLang = await AsyncStorage.getItem('language');
          console.log('[LANGUAGE DEBUG] Language in AsyncStorage after change:', storedLang);
          console.log('[LANGUAGE DEBUG] i18n.language after change:', i18n.language);
        } catch (error) {
          console.error('[LANGUAGE DEBUG] Error verifying language change:', error);
        }
      }, 500);
    } catch (error) {
      console.error('[SETTINGS] Error changing language:', error);
      Alert.alert('Error', 'Failed to change language. Please try again.');
    }
  };

  // Update edited name when user data changes
  useEffect(() => {
    setEditedName(user?.username || '');
  }, [user?.username]);

  const handleSaveName = async () => {
    if (!editedName.trim()) {
      Alert.alert('Error', 'Name cannot be empty');
      return;
    }

    if (editedName.trim() === user?.username) {
      setIsEditingName(false);
      return;
    }

    try {
      setIsSavingName(true);
      await authService.updateUser({ username: editedName.trim() });

      // Sync user data to update the context (only if authenticated)
      if (user) {
        await syncUserData();
      }

      Alert.alert('Success', 'Name updated successfully');
      setIsEditingName(false);
    } catch (error: any) {
      console.error('Error updating name:', error);
      Alert.alert('Error', error.message || 'Failed to update name');
    } finally {
      setIsSavingName(false);
    }
  };

  const handleCancelEdit = () => {
    setEditedName(user?.username || '');
    setIsEditingName(false);
  };

  // Handle notification setting changes
  const handleNotificationSettingChange = async (
    key: keyof NotificationSettings,
    value: boolean | any
  ) => {
    try {
      const updatedSettings = {
        ...notificationSettings,
        [key]: value,
      };

      setNotificationSettings(updatedSettings);

      // Update backend
      if (isAuthenticated) {
        await notificationService.updateNotificationSettings({ [key]: value });
        console.log('[SETTINGS] Notification setting updated:', key, value);
      }
    } catch (error) {
      console.error('[SETTINGS] Failed to update notification setting:', error);
      Alert.alert('Error', 'Failed to update notification setting. Please try again.');
      // Revert the change
      setNotificationSettings(notificationSettings);
    }
  };

  // Handle notification type changes
  const handleNotificationTypeChange = async (
    type: keyof NotificationSettings['notification_types'],
    value: boolean
  ) => {
    try {
      const updatedNotificationTypes = {
        ...notificationSettings.notification_types,
        [type]: value,
      };
      const updatedSettings = {
        ...notificationSettings,
        notification_types: updatedNotificationTypes,
      };
      setNotificationSettings(updatedSettings);
      // Update backend with the full notification_types object
      if (isAuthenticated) {
        await notificationService.updateNotificationSettings({
          notification_types: updatedNotificationTypes
        });
        console.log('[SETTINGS] Notification type updated:', type, value);
      }
    } catch (error) {
      console.error('[SETTINGS] Failed to update notification type:', error);
      Alert.alert('Error', 'Failed to update notification type. Please try again.');
      // Revert the change
      setNotificationSettings(notificationSettings);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      t('settings.account.logoutConfirmTitle', 'Confirm Logout'),
      t('settings.account.logoutConfirmMessage', 'Are you sure you want to logout?'),
      [
        {
          text: t('common.cancel', 'Cancel'),
          style: 'cancel',
        },
        {
          text: t('settings.account.logout', 'Logout'),
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
            } catch (error) {
              console.error('Logout error:', error);
            }
          },
        },
      ]
    );
  };

  const styles = getStyles(colors, isDarkMode);

  if (themeLoading) {
    return (
      <SafeAreaLayout
        backgroundColor={colors.background}
        statusBarStyle={isDarkMode ? 'light-content' : 'dark-content'}
        edges={['top', 'left', 'right', 'bottom']}
        contentStyle={styles.container}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading settings...</Text>
        </View>
      </SafeAreaLayout>
    );
  }

  return (
    <SafeAreaLayout
      backgroundColor={colors.background}
      statusBarStyle={isDarkMode ? 'light-content' : 'dark-content'}
      edges={['top', 'left', 'right', 'bottom']}
      contentStyle={styles.container}
    >

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={RFValue(24)} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('settings.title')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 20) }}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="person-circle-outline" size={RFValue(24)} color={colors.primary} />
            <Text style={styles.sectionTitle}>{t('settings.profile.title')}</Text>
          </View>

          <View style={styles.profileCard}>
            <View style={styles.profileItem}>
              <View style={styles.profileHeader}>
                <Text style={styles.profileLabel}>{t('settings.profile.name')}</Text>
                {!isEditingName ? (
                  <TouchableOpacity
                    onPress={() => setIsEditingName(true)}
                    style={styles.editButton}
                  >
                    <Ionicons name="pencil" size={RFValue(18)} color={colors.primary} />
                  </TouchableOpacity>
                ) : (
                  <View style={styles.editActions}>
                    <TouchableOpacity
                      onPress={handleSaveName}
                      style={[styles.actionButton, styles.saveButton]}
                      disabled={isSavingName}
                    >
                      <Ionicons
                        name={isSavingName ? "hourglass" : "checkmark"}
                        size={RFValue(18)}
                        color="#FFFFFF"
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleCancelEdit}
                      style={[styles.actionButton, styles.cancelButton]}
                      disabled={isSavingName}
                    >
                      <Ionicons name="close" size={RFValue(18)} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
              {isEditingName ? (
                <View>
                  <TextInput
                    style={[styles.nameInput, { borderColor: colors.primary, color: colors.text }]}
                    value={editedName}
                    onChangeText={setEditedName}
                    placeholder={t('settings.profile.namePlaceholder', 'Enter your name')}
                    placeholderTextColor={colors.textSecondary}
                    autoFocus
                    maxLength={25}
                    numberOfLines={1}
                  />
                  <Text style={[styles.characterCounter, { color: colors.primary }]}>
                    {editedName.length}/25
                  </Text>
                </View>
              ) : (
                <Text style={styles.profileValue}>{user?.username || t('common.notSet')}</Text>
              )}
            </View>

            <View style={styles.divider} />

            <View style={styles.profileItem}>
              <Text style={styles.profileLabel}>{t('settings.profile.phone')}</Text>
              <Text style={styles.profileValue}>{user?.phone_number || t('common.notSet')}</Text>
            </View>
          </View>
        </View>

        {/* Preferences Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="settings-outline" size={RFValue(24)} color={colors.primary} />
            <Text style={styles.sectionTitle}>{t('settings.preferences.title')}</Text>
          </View>

          <View style={styles.preferencesCard}>
            {/* Language Setting */}
            <View style={styles.preferenceItem}>
              <View style={styles.preferenceLeft}>
                <Ionicons name="language-outline" size={RFValue(20)} color={colors.primary} />
                <Text style={styles.preferenceLabel}>{t('settings.preferences.language')}</Text>
              </View>
            </View>

            <View style={[styles.pickerContainer, { 
              backgroundColor: isDarkMode ? '#374151' : colors.card, 
              borderColor: colors.border 
            }]}>
              <Picker
                selectedValue={language}
                onValueChange={handleLanguageChange}
                style={[styles.picker, { 
                  color: colors.text,
                  backgroundColor: 'transparent'
                }]}
                mode="dropdown"
                dropdownIconColor={colors.text}
              >
                <Picker.Item
                  label='English'
                  value="en"
                  color={colors.text}
                  style={{ backgroundColor: isDarkMode ? '#374151' : colors.card }}
                />
                <Picker.Item
                  label='हिंदी (Hindi)'
                  value="hi"
                  color={colors.text}
                  style={{ backgroundColor: isDarkMode ? '#374151' : colors.card }}
                />
                <Picker.Item
                  label='తెలుగు (Telugu)'
                  value="te"
                  color={colors.text}
                  style={{ backgroundColor: isDarkMode ? '#374151' : colors.card }}
                />
              </Picker>
            </View>

            <View style={styles.divider} />

            {/* Dark Mode Setting */}
            <View style={styles.preferenceItem}>
              <View style={styles.preferenceLeft}>
                <Ionicons name="moon-outline" size={RFValue(20)} color={colors.primary} />
                <Text style={styles.preferenceLabel}>{t('settings.preferences.darkMode')}</Text>
              </View>
              <Switch
                value={isDarkMode}
                onValueChange={toggleTheme}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={isDarkMode ? '#FFFFFF' : colors.card}
                ios_backgroundColor={colors.border}
              />
            </View>
          </View>
        </View>

        {/* Notification Settings Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="notifications-outline" size={RFValue(24)} color={colors.primary} />
            <Text style={styles.sectionTitle}>{t('settings.notifications.title')}</Text>
            {isLoadingSettings && (
              <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: 10 }} />
            )}
          </View>

          <View style={styles.preferencesCard}>
            {/* Push Notifications */}
            <View style={styles.preferenceItem}>
              <View style={styles.preferenceLeft}>
                <Ionicons name="phone-portrait-outline" size={RFValue(20)} color={colors.primary} />
                <Text style={styles.preferenceLabel}>{t('settings.notifications.pushNotifications')}</Text>
              </View>
              <Switch
                value={notificationSettings.push_notifications}
                onValueChange={(value) => handleNotificationSettingChange('push_notifications', value)}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={notificationSettings.push_notifications ? '#FFFFFF' : colors.card}
                ios_backgroundColor={colors.border}
              />
            </View>

            {/* <View style={styles.divider} /> */}

            {/* Daily Updates */}
            {/* <View style={styles.preferenceItem}>
              <View style={styles.preferenceLeft}>
                <Ionicons name="calendar-outline" size={RFValue(20)} color={colors.primary} />
                <Text style={styles.preferenceLabel}>{t('settings.notifications.dailyUpdates', 'Daily Updates')}</Text>
              </View>
              <Switch
                value={notificationSettings.notification_types.daily_updates}
                onValueChange={(value) => handleNotificationTypeChange('daily_updates', value)}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={notificationSettings.notification_types.daily_updates ? '#FFFFFF' : colors.card}
                ios_backgroundColor={colors.border}
              />
            </View> */}
          </View>
        </View>

        {/* Logout Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="log-out-outline" size={RFValue(24)} color="#EF4444" />
            <Text style={[styles.sectionTitle, { color: '#EF4444' }]}>{t('settings.account.title', 'Account')}</Text>
          </View>

          <View style={styles.preferencesCard}>
            <TouchableOpacity
              style={styles.logoutButton}
              onPress={handleLogout}
              activeOpacity={0.7}
            >
              <View style={styles.logoutButtonContent}>
                <Ionicons name="log-out-outline" size={RFValue(20)} color="#FFFFFF" />
                <Text style={styles.logoutButtonText}>{t('settings.account.logout', 'Logout')}</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Additional spacing at bottom */}
        <View style={styles.bottomSpacing} />
      </ScrollView>
    </SafeAreaLayout>
  );
};

const getStyles = (colors: any, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: wp('4%'),
      paddingVertical: hp('2%'),
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.background,
    },
    backButton: {
      padding: wp('2%'),
      borderRadius: wp('2%'),
      backgroundColor: colors.card,
    },
    headerTitle: {
      fontSize: RFValue(20),
      fontWeight: '700',
      color: colors.text,
    },
    headerSpacer: {
      width: wp('10%'), // Same width as back button to center title
    },
    scrollContainer: {
      flex: 1,
      paddingHorizontal: wp('4%'),
    },
    section: {
      marginTop: hp('3%'),
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: hp('2%'),
    },
    sectionTitle: {
      fontSize: RFValue(18),
      fontWeight: '600',
      color: colors.text,
      marginLeft: wp('3%'),
    },
    profileCard: {
      backgroundColor: colors.card,
      borderRadius: wp('4%'),
      padding: wp('4%'),
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: colors.text,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    profileItem: {
      paddingVertical: hp('1.5%'),
    },
    profileLabel: {
      fontSize: RFValue(12),
      color: colors.textSecondary,
      fontWeight: '500',
      marginBottom: hp('0.5%'),
    },
    profileValue: {
      fontSize: RFValue(14),
      color: colors.text,
      fontWeight: '600',
    },
    preferencesCard: {
      backgroundColor: colors.card,
      borderRadius: wp('4%'),
      padding: wp('4%'),
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: colors.text,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    preferenceItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: hp('1.5%'),
    },
    preferenceLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    preferenceLabel: {
      fontSize: RFValue(14),
      color: colors.text,
      fontWeight: '500',
      marginLeft: wp('3%'),
    },
    pickerContainer: {
      backgroundColor: isDark ? '#374151' : colors.card,
      borderRadius: wp('3%'),
      borderWidth: 1,
      borderColor: colors.border,
      marginVertical: hp('1%'),
      overflow: 'hidden',
    },
    picker: {
      height: hp('7%'),
      width: '100%',
      color: colors.text,
      backgroundColor: 'transparent',
    },
    pickerItem: {
      fontSize: RFValue(14),
      color: colors.text,
      backgroundColor: isDark ? '#374151' : colors.card,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: hp('1%'),
    },
    bottomSpacing: {
      height: hp('4%'),
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
    },
    loadingText: {
      marginTop: hp('2%'),
      fontSize: RFValue(16),
      color: colors.textSecondary,
    },
    profileHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: hp('1%'),
    },
    editButton: {
      padding: wp('2%'),
      borderRadius: wp('2%'),
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    editActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: wp('2%'),
    },
    actionButton: {
      padding: wp('2.5%'),
      borderRadius: wp('2%'),
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveButton: {
      backgroundColor: '#4CAF50',
    },
    cancelButton: {
      backgroundColor: '#F44336',
    },
    nameInput: {
      fontSize: RFValue(12),
      fontWeight: '600',
      borderWidth: 2,
      borderRadius: wp('2%'),
      paddingHorizontal: wp('4%'),
      paddingVertical: hp('1.5%'),
      backgroundColor: colors.background,
      width: '100%',
    },
    characterCounter: {
      fontSize: RFValue(10),
      textAlign: 'right',
      marginTop: hp('0.5%'),
      fontWeight: '500',
    },
    logoutButton: {
      backgroundColor: '#EF4444',
      borderRadius: wp('3%'),
      paddingVertical: hp('2%'),
      paddingHorizontal: wp('4%'),
      marginVertical: hp('1%'),
    },
    logoutButtonContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    logoutButtonText: {
      color: '#FFFFFF',
      fontSize: RFValue(16),
      fontWeight: '600',
      marginLeft: wp('3%'),
    },
  });

export default SettingsScreen;