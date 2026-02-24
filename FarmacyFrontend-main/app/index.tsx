import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Animated,
  StyleSheet,
  Dimensions,
  StatusBar,
  Platform,
  Keyboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { SafeAreaLayout } from '@/components/ui/SafeAreaLayout';
import { useNavigationBar } from '@/hooks/useNavigationBar';

export default function SplashScreen() {
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);
  const { isInitialized, isAuthenticated } = useAuth();
  const { updateTheme, setTransparentBar } = useNavigationBar();
  // Simple animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const textOpacityAnim = useRef(new Animated.Value(1)).current;

  // Simple animation function with gentle fade
  const startAnimation = () => {
    fadeAnim.setValue(0);
    textOpacityAnim.setValue(1);

    // Initial fade in
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();

    // Gentle breathing effect - text gets lighter and back to original
    Animated.loop(
      Animated.sequence([
        Animated.timing(textOpacityAnim, {
          toValue: 0.6,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(textOpacityAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  useEffect(() => {
    if (isNavigating) return;
    if (!isInitialized) return;
    // Add 5 second delay before navigation
    const timer = setTimeout(() => {
      setIsNavigating(true);
      if (isAuthenticated) {
        router.replace('/(tabs)');
      } else {
        router.replace('/language');
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [isInitialized, isAuthenticated, isNavigating, router]);

  // Restart animation every time screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (!isNavigating) {
        startAnimation();
      }
      // Ensure navigation bar is transparent
      updateTheme(false); // false for light theme
      setTransparentBar();
    }, [isNavigating, updateTheme, setTransparentBar])
  );

  return (
    <SafeAreaLayout
      gradient={{
        colors: ['#a8e6cf', '#dcedc1'],
        locations: [0, 1],
      }}
      statusBarStyle="dark-content"
      edges={['top', 'left', 'right', 'bottom']}
      contentStyle={styles.container}
    >
      <View style={styles.textContainer}>
        <Animated.Text
          style={[
            styles.title,
            {
              opacity: Animated.multiply(fadeAnim, textOpacityAnim),
            },
          ]}
        >
          Farmacy
        </Animated.Text>
        <Animated.Text
          style={[
            styles.subtitle,
            {
              opacity: fadeAnim,
            },
          ]}
        >
          Your Smart Farming Companion
        </Animated.Text>
      </View>
    </SafeAreaLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#388e3c',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 18,
    color: '#388e3c',
  },
});
