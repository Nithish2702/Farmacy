import React, { useEffect, useRef } from 'react';
import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { View, Animated, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/theme';

export default function TabLayout() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { mode, colors } = useTheme();
  const isDarkMode = mode === 'dark';
  
  // Calculate safe bottom padding
  const safeBottomPadding = Math.max(insets.bottom, Platform.OS === 'ios' ? 20 : 15);
  
  // Dynamic colors based on theme
  const tabColors = {
    background: isDarkMode ? '#374151' : '#FFFFFF',
    activeTint: '#4CAF50',
    inactiveTint: isDarkMode ? '#9CA3AF' : '#6B7280',
    border: isDarkMode ? '#4B5563' : '#E5E7EB',
    shadow: isDarkMode ? '#000000' : '#000000',
  };
  
  // Pulsating animation for crops button
  const pulseAnim = useRef(new Animated.Value(1)).current;
  
  useEffect(() => {
    const pulsate = () => {
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]).start(() => pulsate());
    };
    pulsate();
  }, [pulseAnim]);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: tabColors.activeTint,
        tabBarInactiveTintColor: tabColors.inactiveTint,
        tabBarShowLabel: true,
        animation: 'fade',
        contentStyle: { backgroundColor: colors.background },
        tabBarStyle: {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: tabColors.background,
          borderTopLeftRadius: 25,
          borderTopRightRadius: 25,
          height: 85 + safeBottomPadding,
          shadowColor: tabColors.shadow,
          shadowOffset: {
            width: 0,
            height: -3,
          },
          shadowOpacity: isDarkMode ? 0.25 : 0.08,
          shadowRadius: 8,
          elevation: 20,
          zIndex: 1000,
          borderTopWidth: 0.5,
          borderTopColor: tabColors.border,
          paddingHorizontal: 10,
          paddingBottom: safeBottomPadding,
          paddingTop: 10,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
          color: isDarkMode ? '#D1D5DB' : '#374151',
        },
        tabBarItemStyle: {
          height: 85 + safeBottomPadding,
          justifyContent: 'center',
          alignItems: 'center',
          paddingTop: 0,
          paddingBottom: safeBottomPadding + 5,
        },
        headerShown: false,
      }}
    >
      {/* HOME TAB */}
      <Tabs.Screen
        name="index"
        options={{
          title: t('navigation.tabs.home'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons 
              name={focused ? "home" : "home-outline"} 
              size={24} 
              color={color} 
            />
          ),
        }}
      />
      
      {/* NEWS TAB */}
      <Tabs.Screen
        name="news"
        options={{
          title: t('navigation.tabs.news'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons 
              name={focused ? "newspaper" : "newspaper-outline"} 
              size={24} 
              color={color} 
            />
          ),
        }}
      />
      
      {/* CROPS TAB - MAIN CENTER BUTTON */}
      <Tabs.Screen
        name="crops"
        options={{
          title: t('navigation.tabs.crops'),
          tabBarIcon: ({ focused }) => (
            <View style={{
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'visible', // Allow shadow but contain it properly
            }}>
              <Animated.View style={[
                {
                  alignItems: 'center', 
                  justifyContent: 'center',
                  width: 60,
                  height: 60,
                  borderRadius: 30,
                  backgroundColor: '#4CAF50',
                  marginTop: -25, // Reduced to prevent shadow extending too far
                  shadowColor: '#4CAF50',
                  shadowOffset: {
                    width: 0,
                    height: 2, // Reduced shadow height to prevent extending into safe area
                  },
                  shadowOpacity: 0.25, // Slightly reduced opacity
                  shadowRadius: 6, // Reduced radius for tighter shadow
                  elevation: 6, // Reduced elevation for Android
                  borderWidth: 3,
                  borderColor: tabColors.background,
                },
                { transform: [{ scale: pulseAnim }] }
              ]}>
                <Ionicons 
                  name="leaf" 
                  size={28} 
                  color="#FFFFFF" 
                />
              </Animated.View>
            </View>
          ),
        }}
      />
      
      {/* LEARN TAB */}
      <Tabs.Screen
        name="learn"
        options={{
          title: t('navigation.tabs.learn'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons 
              name={focused ? "book" : "book-outline"} 
              size={24} 
              color={color} 
            />
          ),
        }}
      />
      
      {/* WEATHER TAB */}
      <Tabs.Screen
        name="weather"
        options={{
          title: t('navigation.tabs.weather'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons 
              name={focused ? "partly-sunny" : "partly-sunny-outline"} 
              size={24} 
              color={color} 
            />
          ),
        }}
      />
    </Tabs>
  ); 
}
