import { useEffect } from 'react';
import { Platform, StatusBar } from 'react-native';
import { useTheme } from '@/context/theme';

// Safe import with fallback
let NavigationBar: any = null;
let SystemBars: any = null;
try {
  NavigationBar = require('expo-navigation-bar');
  SystemBars = require('expo-system-ui');
} catch (error) {
  console.warn('System UI modules not available:', error);
}

export const useSystemUI = () => {
  const { mode } = useTheme();
  const isDark = mode === 'dark';

  useEffect(() => {
    const setupSystemUI = async () => {
      if (Platform.OS === 'android') {
        try {
          // Set status bar
          StatusBar.setBarStyle(isDark ? 'light-content' : 'dark-content', true);
          StatusBar.setBackgroundColor('transparent');
          StatusBar.setTranslucent(true);

          // Set navigation bar
          if (NavigationBar) {
            await NavigationBar.setBackgroundColorAsync('transparent');
            await NavigationBar.setButtonStyleAsync(isDark ? 'light' : 'dark');
            await NavigationBar.setPositionAsync('absolute');
          }

          // Set immersive mode for better transparency
          if (SystemBars) {
            await SystemBars.setBackgroundColorAsync('transparent');
          }
        } catch (error) {
          console.warn('Failed to setup system UI:', error);
        }
      }
    };

    setupSystemUI();
  }, [isDark]);

  const resetSystemUI = async () => {
    if (Platform.OS === 'android' && NavigationBar) {
      try {
        await NavigationBar.setBackgroundColorAsync(isDark ? '#1F2937' : '#FFFFFF');
        await NavigationBar.setPositionAsync('sticky');
      } catch (error) {
        console.warn('Failed to reset system UI:', error);
      }
    }
  };

  return { resetSystemUI };
}; 