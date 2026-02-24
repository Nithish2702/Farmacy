import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ViewStyle, TextStyle, ImageStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing, Typography } from '@/constants/theme';

interface Styles {
  container: ViewStyle;
  content: ViewStyle;
  image: ImageStyle;
  title: TextStyle;
  description: TextStyle;
  button: ViewStyle;
  buttonText: TextStyle;
}

const HandholdIntro = () => {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Image 
          source={require('@/assets/handholding.png')} 
          style={styles.image}
          resizeMode="contain"
        />
        <Text style={styles.title}>{t('handholding.title')}</Text>
        <Text style={styles.description}>{t('handholding.description')}</Text>
      </View>
      <TouchableOpacity 
        style={styles.button}
        onPress={() => router.push('/sidebar/handhold')}
      >
        <Text style={styles.buttonText}>{t('handholding.getStarted')}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create<Styles>({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: Spacing.medium,
    justifyContent: 'space-between',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '80%',
    height: 200,
    marginBottom: Spacing.large,
  },
  title: {
    ...Typography.h1,
    textAlign: 'center',
    marginBottom: Spacing.medium,
  },
  description: {
    ...Typography.body1,
    textAlign: 'center',
    color: Colors.textSecondary,
    marginBottom: Spacing.large,
  },
  button: {
    backgroundColor: Colors.primary,
    padding: Spacing.medium,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    ...Typography.button,
    color: Colors.white,
  },
});

export default HandholdIntro; 