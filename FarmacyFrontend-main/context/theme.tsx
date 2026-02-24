// context/ThemeContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ThemeColors {
  primary: string;
  background: string;
  card: string;
  text: string;
  textSecondary: string;
  border: string;
  warning: string;
  success: string;
  error: string;
  info: string;
  accent: string;
  white: string;
  black: string;
  secondary: string;
}

interface ThemeContextType {
  mode: 'light' | 'dark';
  toggleTheme: () => void;
  colors: ThemeColors;
  isDarkMode: boolean;
  isLoading: boolean;
}

const defaultMode = Appearance.getColorScheme() || 'light';

const lightColors: ThemeColors = {
  primary: '#2E7D32',
  background: '#F7F9F7',
  card: '#FFFFFF',
  text: '#1F2937',
  textSecondary: '#6B7280',
  border: '#E5E7EB',
  warning: '#F59E0B',
  success: '#10B981',
  error: '#EF4444',
  info: '#3B82F6',
  accent: '#8B5CF6',
  white: '#FFFFFF',
  black: '#000000',
  secondary: '#6B7280',
};

const darkColors: ThemeColors = {
  primary: '#4CAF50',
  background: '#1F2937',
  card: '#374151',
  text: '#F9FAFB',
  textSecondary: '#D1D5DB',
  border: '#4B5563',
  warning: '#FBBF24',
  success: '#34D399',
  error: '#F87171',
  info: '#60A5FA',
  accent: '#A78BFA',
  white: '#FFFFFF',
  black: '#000000',
  secondary: '#9CA3AF',
};

const THEME_STORAGE_KEY = 'app_theme_mode';

export const ThemeContext = createContext<ThemeContextType>({
  mode: 'light',
  toggleTheme: () => {},
  colors: lightColors,
  isDarkMode: false,
  isLoading: true,
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<'light' | 'dark'>(defaultMode);
  const [isLoading, setIsLoading] = useState(true);

  // Load theme from AsyncStorage on mount
  useEffect(() => {
    const loadThemeFromStorage = async () => {
      try {
        const storedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (storedTheme && (storedTheme === 'light' || storedTheme === 'dark')) {
          console.log('[THEME] Loading theme from storage:', storedTheme);
          setMode(storedTheme);
        } else {
          console.log('[THEME] No stored theme found, using default:', defaultMode);
          setMode(defaultMode);
        }
      } catch (error) {
        console.error('[THEME] Error loading theme from storage:', error);
        setMode(defaultMode);
      } finally {
        setIsLoading(false);
      }
    };

    loadThemeFromStorage();
  }, []);

  const toggleTheme = async () => {
    const newMode = mode === 'light' ? 'dark' : 'light';
    setMode(newMode);
    
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, newMode);
      console.log('[THEME] Theme saved to storage:', newMode);
    } catch (error) {
      console.error('[THEME] Error saving theme to storage:', error);
    }
  };

  const value = {
    mode,
    toggleTheme,
    colors: mode === 'light' ? lightColors : darkColors,
    isDarkMode: mode === 'dark',
    isLoading,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
