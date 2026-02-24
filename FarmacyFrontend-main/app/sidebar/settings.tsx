import { useTheme } from '@/context/theme';
import { useAuth } from '@/context/AuthContext';
import { Picker } from '@react-native-picker/picker';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  StyleSheet,
  Switch,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RFValue } from 'react-native-responsive-fontsize';
import { heightPercentageToDP as hp, widthPercentageToDP as wp } from 'react-native-responsive-screen';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SettingsScreen = () => {
  const { t, i18n } = useTranslation();
  const { colors, mode, toggleTheme } = useTheme();
  const { user, selectLanguage, logout } = useAuth();
  const isDarkMode = mode === 'dark';

  // Enhanced color palette to match other pages
  const enhancedColors = {
    ...colors,
    success: mode === 'dark' ? '#22C55E' : '#16A34A',
    warning: mode === 'dark' ? '#F59E0B' : '#D97706',
    info: mode === 'dark' ? '#3B82F6' : '#2563EB',
    accent: mode === 'dark' ? '#EF4444' : '#DC2626',
    white: '#FFFFFF',
    secondary: mode === 'dark' ? '#059669' : '#15803D',
  };

  const [language, setLanguage] = useState(i18n.language);
  const [notifications, setNotifications] = useState(true);

  // Check current language in AsyncStorage when component mounts
  useEffect(() => {
    const checkStoredLanguage = async () => {
      try {
        const storedLang = await AsyncStorage.getItem('language');
        console.log('[SIDEBAR LANGUAGE DEBUG] Current stored language in AsyncStorage:', storedLang);
      } catch (error) {
        console.error('[SIDEBAR LANGUAGE DEBUG] Error checking stored language:', error);
      }
    };
    checkStoredLanguage();
  }, []);

  const handleLanguageChange = (langCode: string) => {
    console.log(`[SIDEBAR LANGUAGE DEBUG] Language change requested: ${language} -> ${langCode}`);
    setLanguage(langCode);
    
    // Update using Auth context function if available
    if (selectLanguage) {
      console.log('[SIDEBAR LANGUAGE DEBUG] Using Auth context selectLanguage function');
      selectLanguage(langCode);
    } else {
      console.log('[SIDEBAR LANGUAGE DEBUG] Using i18n.changeLanguage directly');
      i18n.changeLanguage(langCode);
      
      // Also save to AsyncStorage manually if not using Auth context
      AsyncStorage.setItem('language', langCode)
        .then(() => console.log('[SIDEBAR LANGUAGE DEBUG] Language saved to AsyncStorage manually'))
        .catch(error => console.error('[SIDEBAR LANGUAGE DEBUG] Error saving language:', error));
    }
    
    // Verify the language was saved
    setTimeout(async () => {
      try {
        const storedLang = await AsyncStorage.getItem('language');
        console.log('[SIDEBAR LANGUAGE DEBUG] Language in AsyncStorage after change:', storedLang);
        console.log('[SIDEBAR LANGUAGE DEBUG] i18n.language after change:', i18n.language);
      } catch (error) {
        console.error('[SIDEBAR LANGUAGE DEBUG] Error verifying language change:', error);
      }
    }, 500);
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

  return (
    <View style={[styles.container, { backgroundColor: enhancedColors.background }]}>
      <StatusBar
        barStyle={mode === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={enhancedColors.background}
      />
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: enhancedColors.background, borderBottomColor: enhancedColors.border }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={RFValue(22)} color={enhancedColors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: enhancedColors.text }]}>{t('settings.title')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView 
        style={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Section */}
        <View style={[styles.section, { backgroundColor: enhancedColors.card, borderColor: enhancedColors.border }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="person" size={RFValue(20)} color={enhancedColors.primary} />
            <Text style={[styles.sectionTitle, { color: enhancedColors.text }]}>{t('settings.profile.title')}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={[styles.label, { color: enhancedColors.textSecondary }]}>{t('settings.profile.name')}</Text>
            <Text style={[styles.value, { color: enhancedColors.text }]}>{user?.username || t('common.notSet', 'Not set')}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={[styles.label, { color: enhancedColors.textSecondary }]}>{t('settings.profile.email')}</Text>
            <Text style={[styles.value, { color: enhancedColors.text }]}>{user?.email || t('common.notSet', 'Not set')}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={[styles.label, { color: enhancedColors.textSecondary }]}>{t('settings.profile.phone')}</Text>
            <Text style={[styles.value, { color: enhancedColors.text }]}>{user?.phone_number || t('common.notSet', 'Not set')}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={[styles.label, { color: enhancedColors.textSecondary }]}>{t('settings.profile.farmType')}</Text>
            <Text style={[styles.value, { color: enhancedColors.text }]}>{user?.farm_type || t('common.notSet', 'Not set')}</Text>
          </View>
        </View>

        {/* Preferences Section */}
        <View style={[styles.section, { backgroundColor: enhancedColors.card, borderColor: enhancedColors.border }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="settings" size={RFValue(20)} color={enhancedColors.primary} />
            <Text style={[styles.sectionTitle, { color: enhancedColors.text }]}>{t('settings.preferences.title')}</Text>
          </View>

          <View style={styles.preferenceRow}>
            <Ionicons name="language" size={RFValue(18)} color={enhancedColors.textSecondary} />
            <Text style={[styles.preferenceLabel, { color: enhancedColors.text }]}>{t('settings.preferences.language')}</Text>
          </View>

          <View style={[styles.pickerWrapper, { 
            backgroundColor: isDarkMode ? '#374151' : enhancedColors.background, 
            borderColor: enhancedColors.border 
          }]}>
            <Picker
              selectedValue={language}
              onValueChange={handleLanguageChange}
              style={[styles.picker, { 
                color: enhancedColors.text,
                backgroundColor: 'transparent'
              }]}
              mode="dropdown"
              dropdownIconColor={enhancedColors.textSecondary}
            >
              <Picker.Item 
                label={t('language.languages.english', 'English')} 
                value="en" 
                color={enhancedColors.text}
                style={{ backgroundColor: isDarkMode ? '#374151' : enhancedColors.background }}
              />
              <Picker.Item 
                label={t('language.languages.hindi', 'हिंदी (Hindi)')} 
                value="hi" 
                color={enhancedColors.text}
                style={{ backgroundColor: isDarkMode ? '#374151' : enhancedColors.background }}
              />
              <Picker.Item 
                label={t('language.languages.telugu', 'తెలుగు (Telugu)')} 
                value="te" 
                color={enhancedColors.text}
                style={{ backgroundColor: isDarkMode ? '#374151' : enhancedColors.background }}
              />
            </Picker>
          </View>

          <View style={styles.preferenceRow}>
            <Ionicons name="moon" size={RFValue(18)} color={enhancedColors.textSecondary} />
            <Text style={[styles.preferenceLabel, { color: enhancedColors.text }]}>{t('settings.preferences.darkMode')}</Text>
            <Switch
              value={isDarkMode}
              onValueChange={toggleTheme}
              trackColor={{ false: enhancedColors.border, true: enhancedColors.primary }}
              thumbColor={enhancedColors.white}
            />
          </View>

          <View style={styles.preferenceRow}>
            <Ionicons name="notifications" size={RFValue(18)} color={enhancedColors.textSecondary} />
            <Text style={[styles.preferenceLabel, { color: enhancedColors.text }]}>{t('settings.preferences.notifications')}</Text>
            <Switch
              value={notifications}
              onValueChange={setNotifications}
              trackColor={{ false: enhancedColors.border, true: enhancedColors.primary }}
              thumbColor={enhancedColors.white}
            />
          </View>

          {/* Logout Section */}
          <View style={styles.divider} />
          
          <View style={styles.preferenceRow}>
            <Ionicons name="log-out-outline" size={RFValue(18)} color="#EF4444" />
            <Text style={[styles.preferenceLabel, { color: '#EF4444' }]}>{t('settings.account.logout', 'Logout')}</Text>
            <TouchableOpacity
              style={styles.logoutButton}
              onPress={handleLogout}
              activeOpacity={0.7}
            >
              <Ionicons name="log-out-outline" size={RFValue(18)} color="#EF4444" />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('1.5%'),
    borderBottomWidth: 0.5,
  },
  backButton: {
    padding: wp('2%'),
  },
  headerTitle: {
    fontSize: RFValue(18),
    fontWeight: '700',
  },
  headerSpacer: {
    width: wp('10%'),
  },
  scrollContainer: {
    flex: 1,
    paddingHorizontal: wp('4%'),
  },
  section: {
    marginTop: hp('2%'),
    marginBottom: hp('2%'),
    borderRadius: wp('4%'),
    padding: wp('4%'),
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp('2%'),
  },
  sectionTitle: {
    fontSize: RFValue(16),
    fontWeight: '600',
    marginLeft: wp('3%'),
  },
  detailRow: {
    marginBottom: hp('1.5%'),
  },
  label: {
    fontSize: RFValue(12),
    marginBottom: hp('0.5%'),
    fontWeight: '500',
  },
  value: {
    fontSize: RFValue(14),
    fontWeight: '400',
  },
  preferenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: hp('1%'),
  },
  preferenceLabel: {
    fontSize: RFValue(14),
    marginLeft: wp('3%'),
    flex: 1,
    fontWeight: '500',
  },
  pickerWrapper: {
    borderWidth: 1,
    borderRadius: wp('3%'),
    overflow: 'hidden',
    marginTop: hp('1%'),
    marginBottom: hp('2%'),
    height: hp('6%'),
    justifyContent: 'center',
  },
  picker: {
    height: hp('6%'),
    width: '100%',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: hp('2%'),
  },
  logoutButton: {
    padding: wp('2%'),
  },
});

export default SettingsScreen;

