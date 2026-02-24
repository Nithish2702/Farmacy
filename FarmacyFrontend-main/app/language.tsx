import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import i18n from '../i18n.config'; // adjust path as needed
import { useAuth } from '@/context/AuthContext';

export default function LanguageScreen() {
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null);
  const router = useRouter();
  const { t } = useTranslation();
  const { selectLanguage } = useAuth();

  const languages = [
    { code: 'en', name: 'English' },
    { code: 'hi', name: 'हिंदी' },
    { code: 'te', name: 'తెలుగు' },
  ];

  const handleLanguageSelect = async (langCode: string) => {
    selectLanguage(langCode);
    setSelectedLanguage(langCode);
  };

  const handleContinue = () => {
    if (selectedLanguage) {
      router.push('/welcome');
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" backgroundColor="#F7F9F7" />

      <View style={styles.header}>
        <Ionicons name="leaf" size={48} color="#4CAF50" style={{ marginBottom: 10 }} />
        <Text style={styles.title}>{t('language.chooseLanguage')}</Text>
        <Text style={styles.subtitle}>{t('language.selectPreferredLanguage')}</Text>
      </View>

      <View style={styles.languageContainer}>
        {languages.map((lang) => (
          <TouchableOpacity
            key={lang.code}
            style={[
              styles.languageButton,
              selectedLanguage === lang.code && styles.languageButtonSelected,
            ]}
            onPress={() => handleLanguageSelect(lang.code)}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.languageText,
                selectedLanguage === lang.code && styles.languageTextSelected,
              ]}
            >
              {lang.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[
          styles.continueButton,
          !selectedLanguage && styles.disabledButton,
        ]}
        disabled={!selectedLanguage}
        onPress={handleContinue}
        activeOpacity={0.9}
      >
        <Text style={styles.continueText}>{t('language.continue')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    backgroundColor: '#F7F9F7',
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  subtitle: {
    fontSize: 16,
    color: '#607D8B',
    textAlign: 'center',
    marginTop: 8,
  },
  languageContainer: {
    marginVertical: 20,
  },
  languageButton: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderWidth: 1.5,
    borderColor: '#C8E6C9',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    marginBottom: 14,
    elevation: 1,
  },
  languageButtonSelected: {
    backgroundColor: '#4CAF50',
    borderColor: '#388E3C',
    elevation: 3,
  },
  languageText: {
    fontSize: 20,
    color: '#455A64',
    textAlign: 'center',
    fontWeight: '500',
  },
  languageTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  continueButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 3,
  },
  disabledButton: {
    backgroundColor: '#BDBDBD',
  },
  continueText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
});