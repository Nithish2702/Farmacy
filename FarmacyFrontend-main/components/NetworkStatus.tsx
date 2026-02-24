import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useNetwork } from '@/context/NetworkContext';
import { useTheme } from '@/context/theme';
import { useTranslation } from 'react-i18next';

export const NetworkStatus: React.FC = () => {
  const { isConnected, isInternetReachable } = useNetwork();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (!isConnected || !isInternetReachable) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [isConnected, isInternetReachable, fadeAnim]);

  if (isConnected && isInternetReachable) {
    return null;
  }

  return (
    <Animated.View 
      style={[
        styles.container,
        {
          backgroundColor: colors?.error || '#ff6b6b',
          opacity: fadeAnim,
        }
      ]}
    >
      <Text style={styles.text}>
        {t('common.noInternetConnection')}
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingVertical: 8,
    paddingHorizontal: 16,
    zIndex: 1000,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
}); 