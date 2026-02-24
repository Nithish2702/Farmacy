import React from 'react';
import { View, useWindowDimensions } from 'react-native';
import { useTheme } from '@/context/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Platform } from 'react-native';
import Dashboard from '../dashboard';

export default function HomeTab() {
  const { width } = useWindowDimensions();
  const { mode } = useTheme();
  const insets = useSafeAreaInsets();
  const isDarkMode = mode === 'dark';

  const colors = {
    background: isDarkMode ? '#1F2937' : '#F9FAFB',
    card: isDarkMode ? '#374151' : '#FFFFFF',
    text: isDarkMode ? '#F9FAFB' : '#2C3E2C',
    textSecondary: isDarkMode ? '#D1D5DB' : '#6B7280',
    primary: '#4CAF50',
    secondary: '#81C784',
    white: '#FFFFFF',
    border: isDarkMode ? '#4B5563' : '#E5E7EB',
    accent: '#FF6B6B',
    success: '#4CAF50',
    warning: '#FFA726',
    info: '#2196F3',
    error: '#F44336'
  };

  // Calculate bottom padding to account for enhanced tab bar
  const extraBottomPadding = Platform.OS === 'android' ? 20 : 0;
  const bottomPadding = Math.max(
    Platform.OS === 'android' ? 12 : 8,
    insets.bottom + extraBottomPadding
  );

  return (
    <View style={{ 
      flex: 1, 
      backgroundColor: colors.background,
      // Remove double padding - dashboard ScrollView handles its own bottom padding
    }}>
      <Dashboard colors={colors} width={width} />
    </View>
  );
} 