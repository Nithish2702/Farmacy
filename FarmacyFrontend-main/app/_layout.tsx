import { Stack } from 'expo-router';
import React, { useEffect } from 'react';
import { View, StyleSheet, AppState, useWindowDimensions } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { ThemeProvider, useTheme } from '@/context/theme';
import { AuthProvider } from '@/context/AuthContext';
import { CropsProvider } from '@/context/CropsContext';
import { WeatherProvider } from '@/context/WeatherContext';
import { NotificationsProvider } from '@/context/NotificationsContext';
import { SidebarProvider, useSidebar } from '@/context/SidebarContext';
import { NetworkProvider } from '@/context/NetworkContext';
import { useNavigationBar } from '@/hooks/useNavigationBar';
import { useSegments } from 'expo-router';
import SideBar from '@/components/Home/SideBar';
import * as Speech from 'expo-speech';

function AppLayout() {
  const { mode, colors } = useTheme();
  const { width } = useWindowDimensions();
  const segments = useSegments();
  const { isSidebarOpen, setSidebarOpen } = useSidebar();

  const {
    isAvailable,
    setTransparentBar,
    updateTheme,
    detectAndApplyBestMethod,
    detectNavigationType,
  } = useNavigationBar();

  const backgroundColor = colors?.background || (mode === 'dark' ? '#1E293B' : '#FAFAFA');

  useEffect(() => {
    if (!isAvailable) return;

    const setupNavBar = async () => {
      try {
        // Try the working near-transparent method
        await setTransparentBar();
        await updateTheme(mode === 'dark');
      } catch (error) {
        console.log('Navigation bar setup failed:', error);
      }
    };

    setupNavBar();
  }, [mode]);

  useEffect(() => {
    if (!isAvailable) return;
    setTransparentBar();
  }, [segments]);

  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active' && isAvailable) {
        setTransparentBar();
      }
    };

    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => sub.remove();
  }, [isAvailable]);

  useEffect(() => {
    Speech.stop(); // Stop speech on page change
  }, [segments]);

  const sidebarColors = {
    background: mode === 'dark' ? '#1E293B' : '#FAFAFA',
    card: mode === 'dark' ? '#374151' : '#FFFFFF',
    text: mode === 'dark' ? '#F9FAFB' : '#2C3E2C',
    textSecondary: mode === 'dark' ? '#D1D5DB' : '#6B7280',
    primary: '#4CAF50',
    secondary: '#81C784',
    border: mode === 'dark' ? '#4B5563' : '#E5E7EB',
  };

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          gestureEnabled: true,
          contentStyle: { backgroundColor },
          animationTypeForReplace: 'push',
        }}
      />
      <SideBar
        isSidebarOpen={isSidebarOpen}
        setSidebarOpen={setSidebarOpen}
        colors={sidebarColors}
        width={width}
      />
    </View>
  );
}

export default function Layout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <NetworkProvider>
            <NotificationsProvider>
              <CropsProvider>
                <WeatherProvider>
                  <ThemeProvider>
                    <SidebarProvider>
                      <AppLayout />
                    </SidebarProvider>
                  </ThemeProvider>
                </WeatherProvider>
              </CropsProvider>
            </NotificationsProvider>
          </NetworkProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
