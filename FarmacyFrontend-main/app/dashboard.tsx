import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  StatusBar,
  Image,
  ActivityIndicator,
  RefreshControl,
  AppState,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RFValue } from 'react-native-responsive-fontsize';
import { heightPercentageToDP as hp, widthPercentageToDP as wp } from 'react-native-responsive-screen';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  interpolate,
  Extrapolation,
  withDelay,
  withSequence,
  withRepeat,
} from 'react-native-reanimated';
import { useTheme } from '@/context/theme';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import { useLocation } from '@/hooks/useLocation';
import { useWeather } from '@/hooks/useWeather';
import * as Location from 'expo-location';
import { useSystemUI } from '@/hooks/useSystemUI';
import { useCropsContext } from '@/context/CropsContext';
import { useSidebar } from '@/context/SidebarContext';
import CropHandholdingSuggestions from '@/components/Home/CropHandholdingSuggestions';
import { router, useFocusEffect } from 'expo-router';
import chatbotService from '@/api/chatbotService';
import { ChatMessage } from '@/api/chatbotService';
import ChatModal from '@/components/Home/ChatModel';
import { useNotification } from '@/context/NotificationsContext';
import { SafeAreaLayout } from '@/components/ui/SafeAreaLayout';

interface DetailedLocation {
  name: string;
  district?: string;
  city?: string;
  region?: string;
  country: string;
  postalCode?: string;
  street?: string;
  streetNumber?: string;
  subregion?: string;
}

interface DashboardProps {
  colors: {
    success: string;
    warning: string;
    info: string;
    error: string;
    accent: string;
    white: string;
    secondary: string;
    primary: string;
    background: string;
    card: string;
    text: string;
    textSecondary: string;
    border: string;
  };
  width: number;
}

const Dashboard: React.FC<DashboardProps> = ({ colors: propColors, width }) => {
  const { colors: themeColors, mode } = useTheme();
  const { t, i18n } = useTranslation();
  const { language, selectLanguage, user } = useAuth();
  const { location, loading: locationLoading, getCurrentLocation, requestPermission, error: locationError } = useLocation();
  const insets = useSafeAreaInsets();
  const { resetSystemUI } = useSystemUI();

  // Use global notification context
  const {
    notifications,
    unreadCount,
    markNotificationAsRead,
    loadNotifications,
    isLoadingNotifications
  } = useNotification();

  // Enhanced color palette based on current theme
  const colors = {
    ...themeColors,
    // Add additional colors for enhanced UI
    success: mode === 'dark' ? '#22C55E' : '#16A34A',
    warning: mode === 'dark' ? '#F59E0B' : '#D97706',
    info: mode === 'dark' ? '#3B82F6' : '#2563EB',
    accent: mode === 'dark' ? '#EF4444' : '#DC2626',
    white: '#FFFFFF',
    secondary: mode === 'dark' ? '#059669' : '#15803D',
  };

  // Function to get detection steps image based on language
  const getDetectionStepsImage = () => {
    const currentLang = i18n.language || language || 'en';

    switch (currentLang) {
      case 'hi':
        return require('@/assets/detection_steps_hi.png');
      case 'te':
        return require('@/assets/detection_steps_te.png');
      default:
        return require('@/assets/detection_steps.png');
    }
  };

  // Use weather hook
  const {
    weatherData,
    loading: weatherLoading,
    error: weatherError,
    refreshWeather,
    currentWeather,
    loadWeather,
  } = useWeather();

  // Detailed location state (same as weather page)
  const [detailedLocation, setDetailedLocation] = useState<DetailedLocation | null>(null);
  const [detailedLocationLoading, setDetailedLocationLoading] = useState(false);

  const {
    currentCrop,
    currentTracking,
    weeks,
    loading,
    error,
    crops,
    handholdCrops,
    allTrackings,
    dailyUpdate,
    setCurrentCropTracking,
    loadDailyUpdate,
    loadCrops,
    loadTrackings,
    loadCurrentTracking,
  } = useCropsContext();

  // Debug effect to track data flow (commented out to reduce logs)
  // useEffect(() => {
  //   console.log('[Dashboard] Data state summary:', {
  //     cropsLoaded: crops.length > 0,
  //     currentTrackingLoaded: !!currentTracking,
  //     currentTrackingId: currentTracking?.id,
  //     dailyUpdateLoaded: !!dailyUpdate,
  //     isLoading: Object.values(loading).some(Boolean),
  //     language: language
  //   });
  // }, [crops, currentTracking, dailyUpdate, loading, language]);

  // Effect to refresh daily update when current tracking changes
  useEffect(() => {
    if (currentTracking?.id) {
      // console.log('[Dashboard] Current tracking changed, refreshing daily update for:', currentTracking.id);
      loadDailyUpdate(currentTracking.id, true);
    }
  }, [currentTracking?.id, loadDailyUpdate]);

  // Reverse geocoding to get detailed location (same as weather page)
  const getDetailedLocation = async (lat: number, lon: number) => {
    try {
      setDetailedLocationLoading(true);
      const reverseGeocode = await Location.reverseGeocodeAsync({
        latitude: lat,
        longitude: lon,
      });

      if (reverseGeocode && reverseGeocode.length > 0) {
        const location = reverseGeocode[0];
        const detailed: DetailedLocation = {
          name: location.city || location.district || location.subregion || weatherData?.location?.name || 'Unknown',
          district: location.district || undefined,
          city: location.city || undefined,
          region: location.region || location.subregion || undefined,
          country: location.country || weatherData?.location?.country || 'Unknown',
          postalCode: location.postalCode || undefined,
          street: location.street || undefined,
          streetNumber: location.streetNumber || undefined,
          subregion: location.subregion || undefined,
        };
        setDetailedLocation(detailed);
      }
    } catch (error) {
      console.error('📍 Error getting detailed location:', error);
      // Fallback to basic location from weather data
      if (weatherData?.location) {
        setDetailedLocation({
          name: weatherData.location.name,
          region: weatherData.location.state || undefined,
          country: weatherData.location.country,
        });
      }
    } finally {
      setDetailedLocationLoading(false);
    }
  };

  // Animation values
  const scaleAnim = useSharedValue(1);
  const rotateAnim = useSharedValue(0);
  const fadeAnim = useSharedValue(0);
  const slideAnim = useSharedValue(50);

  const { isSidebarOpen, setSidebarOpen } = useSidebar();
  const [isNotificationOpen, setNotificationOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isCropDropdownOpen, setIsCropDropdownOpen] = useState(false);
  const [trackingCrops, setTrackingCrops] = useState<any[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const mainScrollViewRef = useRef<ScrollView>(null);
  const dropdownScrollViewRef = useRef<ScrollView>(null);
  const cropHandholdingRef = useRef<View>(null);

  // Format date for notifications
  const formatNotificationDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      const diffInMins = Math.floor(diffInHours * 60);
      return diffInMins <= 1 ? 'Just now' : `${diffInMins} mins ago`;
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)} hours ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  // Mark notification as read using global context
  const handleMarkNotificationAsRead = async (notificationId: number) => {
    try {
      await markNotificationAsRead(notificationId);
      // Global state is automatically updated by the context
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  // Force refresh all data - only when absolutely necessary
  const forceRefreshAllData = useCallback(async () => {
    // console.log('[Dashboard] Force refreshing all data...');
    try {
      // Force refresh all crop data
      await Promise.allSettled([
        loadCrops(true),
        loadTrackings(true),
        loadCurrentTracking(true)
      ]);

      // Force refresh daily update if we have current tracking
      if (currentTracking?.id) {
        await loadDailyUpdate(currentTracking.id, true);
      }

      // console.log('[Dashboard] Force refresh completed');
    } catch (error) {
      console.error('[Dashboard] Error in force refresh:', error);
    }
  }, [loadCrops, loadTrackings, loadCurrentTracking, loadDailyUpdate, currentTracking?.id]);

  // Check if data is fresh enough (less than 5 minutes old)
  const isDataFresh = useCallback(() => {
    // For now, assume data is fresh if we have current tracking
    // In a more sophisticated implementation, we could check cache timestamps
    return !!currentTracking;
  }, [currentTracking]);

  // App state change listener - only refresh if data is stale (disabled for now to reduce API calls)
  // useEffect(() => {
  //   const handleAppStateChange = (nextAppState: string) => {
  //     if (nextAppState === 'active') {
  //       // Only refresh if data is very stale (more than 5 minutes old)
  //       // For now, disabled to reduce API calls
  //       // console.log('[Dashboard] App became active, checking if refresh needed...');
  //     }
  //   };

  //   const subscription = AppState.addEventListener('change', handleAppStateChange);
  //   return () => subscription?.remove();
  // }, []);

  // Pull to refresh handler - optimized to reduce API calls
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      console.log('[Dashboard] Starting selective refresh...');

      // Only refresh weather if location is available
      if (location) {
        weatherLoadedRef.current = false; // Reset flag to allow weather reload
        await refreshWeather(location.latitude, location.longitude);
      }

      // Only refresh essential data, use cache for others
      await Promise.allSettled([
        loadCrops(true), // Force refresh crops when user pulls to refresh
        loadCurrentTracking(false), // Use cache first, only refresh if needed
        loadDailyUpdate(currentTracking?.id || 0, false), // Use cache first
        loadNotifications() // Refresh notifications as they're time-sensitive
      ]);

      console.log('[Dashboard] Selective refresh completed');
    } catch (error) {
      console.error('Error refreshing dashboard:', error);
    } finally {
      setRefreshing(false);
    }
  }, [refreshWeather, location, loadCrops, loadCurrentTracking, loadDailyUpdate, currentTracking?.id, loadNotifications]);

  // Load weather data when location is available
  const weatherLoadedRef = useRef(false);

  useEffect(() => {
    if (location && !weatherLoadedRef.current) {
      weatherLoadedRef.current = true;
      loadWeather(location.latitude, location.longitude);
    }

    // Reset flag when location changes
    return () => {
      weatherLoadedRef.current = false;
    };
  }, [location]); // Remove loadWeather dependency to prevent infinite loops

  // Get detailed location when weather data changes (same as weather page)
  useEffect(() => {
    if (weatherData?.coordinates) {
      getDetailedLocation(weatherData.coordinates.lat, weatherData.coordinates.lon);
    }
  }, [weatherData]);

  // Monitor language changes and refresh data
  useEffect(() => {
    if (language && i18n.language !== language) {
      console.log('[Dashboard] Language changed from', i18n.language, 'to', language);

      // Change i18n language
      i18n.changeLanguage(language).catch(error => {
        console.error('[Dashboard] Error changing i18n language:', error);
      });

      // Refresh data that contains translated content
      const refreshData = async () => {
        try {
          console.log('[Dashboard] Refreshing data for new language:', language);

          // Refresh weeks data (contains translated titles)
          if (currentTracking?.id) {
            await loadDailyUpdate(currentTracking.id, true);
          }

          // Refresh crops data (contains translated names)
          await loadCrops(true);

          // Refresh trackings data
          await loadTrackings(true);

          console.log('[Dashboard] Data refresh completed for language:', language);
        } catch (error) {
          console.error('[Dashboard] Error refreshing data for language change:', error);
        }
      };

      refreshData();
    }
  }, [language, i18n, currentTracking?.id, loadDailyUpdate, loadCrops, loadTrackings]);

  // Load tracking crops from all user trackings
  useEffect(() => {
    if (allTrackings && crops && crops.length > 0 && !loading.crops) {
      console.log('[Dashboard] Loading tracking crops, crops count:', crops.length);
      const trackingCropsData = allTrackings.map((tracking) => {
        const cropDetails = crops.find(crop => crop.id === tracking.cropId);
        const cropName = cropDetails?.name || `Crop ${tracking.cropId}`;
        return {
          id: tracking.cropId,
          name: cropName,
          currentWeek: tracking.currentWeek || 1,
          stage: cropDetails?.variety || 'Growing',
          image_urls: cropDetails?.image_urls && cropDetails.image_urls.length > 0 ? cropDetails.image_urls : [require('@/assets/default-crop.png')],
          isCurrentlyTracked: currentCrop?.id === tracking.cropId,
          progress: ((tracking.currentWeek || 1) / 12) * 100, // Assume 12 weeks total,
          trackingData: tracking
        };
      });
      setTrackingCrops(trackingCropsData);
      fadeAnim.value = withTiming(1, { duration: 600 });
      slideAnim.value = withTiming(0, { duration: 400 });
    }
  }, [allTrackings, crops, currentCrop, loading.crops]); // Remove language dependency



  // Trigger daily update loading when current tracking changes
  useEffect(() => {
    if (currentTracking?.id && !loading.dailyUpdate) {
      console.log('Dashboard: Triggering daily update load for tracking', currentTracking.id);
      loadDailyUpdate(currentTracking.id, true); // Force refresh when tracking changes
    }
  }, [currentTracking?.id, loadDailyUpdate]);

  // Additional effect to ensure daily update is loaded when tracking changes
  useEffect(() => {
    if (currentTracking?.id) {
      console.log('Dashboard: Current tracking changed to ID:', currentTracking.id);
      // Force a fresh load of daily update
      setTimeout(() => {
        if (currentTracking?.id) {
          console.log('Dashboard: Forcing daily update reload for tracking:', currentTracking.id);
          loadDailyUpdate(currentTracking.id, true);
        }
      }, 100);
    }
  }, [currentTracking?.id]); // Add proper dependencies

  // Smart refresh data when returning to dashboard - CACHE-FIRST STRATEGY
  // This significantly reduces API calls by:
  // 1. Only loading missing data, not forcing refresh
  // 2. Using cache first, only fetching from network if cache is stale
  // 3. Avoiding unnecessary refreshes when data is already available
  useFocusEffect(
    useCallback(() => {
      // Only refresh if we don't have current tracking data or if it's stale
      const shouldRefresh = !currentTracking || !dailyUpdate;

      if (shouldRefresh) {
        // console.log('Dashboard: Screen focused, refreshing missing data...');
        // Only load what's missing, don't force refresh everything
        const loadMissingData = async () => {
          try {
            // Only load current tracking if we don't have it
            if (!currentTracking) {
              await loadCurrentTracking(false); // Use cache first
            }

            // Only load daily update if we don't have it or if tracking changed
            if (currentTracking?.id && !dailyUpdate) {
              await loadDailyUpdate(currentTracking.id, false); // Use cache first
            }
          } catch (error) {
            console.error('[Dashboard] Error loading missing data on focus:', error);
          }
        };

        loadMissingData();
      }
    }, [currentTracking, dailyUpdate, loadCurrentTracking, loadDailyUpdate])
  );



  // Handle crop selection from dropdown
  const handleCropSelection = useCallback(async (selectedCrop: any) => {
    // Animate selection
    scaleAnim.value = withSequence(
      withTiming(0.95, { duration: 100 }),
      withTiming(1, { duration: 150 })
    );

    setIsCropDropdownOpen(false);

    try {
      // If the crop has tracking data, set it as current tracking
      if (selectedCrop.trackingData) {
        const success = await setCurrentCropTracking(selectedCrop.id);
        if (success) {
          console.log('Dashboard: Crop tracking switched successfully, daily update should reload');
        }
      }
    } catch (error) {
      console.error('Error switching crop:', error);
    }
  }, [setCurrentCropTracking]);

  // Animated styles
  const scaleOnlyStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleAnim.value }],
  }));

  const fadeInStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
    transform: [{ translateY: slideAnim.value }],
  }));

  const rotatingStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scaleAnim.value },
      { rotate: `${rotateAnim.value}deg` }
    ],
  }));

  // Start continuous rotation only when needed (not by default)
  const startLoadingRotation = useCallback(() => {
    rotateAnim.value = withRepeat(
      withTiming(360, { duration: 2000 }),
      -1,
      false
    );
  }, []);

  const stopLoadingRotation = useCallback(() => {
    rotateAnim.value = withTiming(0, { duration: 300 });
  }, []);

  const getWeatherIcon = useCallback((condition: string) => {
    switch (condition.toLowerCase()) {
      case 'sunny':
        return 'sunny';
      case 'partly cloudy':
        return 'partly-sunny';
      case 'cloudy':
        return 'cloudy';
      case 'rainy':
        return 'rainy';
      default:
        return 'partly-sunny';
    }
  }, []);

  // Enhanced weather icon function based on description
  const getDynamicWeatherIcon = useCallback((description: string): keyof typeof Ionicons.glyphMap => {
    const desc = description?.toLowerCase() || '';
    if (desc.includes('clear') || desc.includes('sunny')) return 'sunny';
    if (desc.includes('cloud')) {
      if (desc.includes('few') || desc.includes('scattered')) return 'partly-sunny';
      return 'cloudy';
    }
    if (desc.includes('rain') || desc.includes('drizzle')) return 'rainy';
    if (desc.includes('thunder') || desc.includes('storm')) return 'thunderstorm';
    if (desc.includes('snow')) return 'snow';
    if (desc.includes('mist') || desc.includes('fog') || desc.includes('haze')) return 'cloudy';
    return 'partly-sunny';
  }, []);

  // Weather icon color function
  const getWeatherIconColor = useCallback((description: string): string => {
    const desc = description?.toLowerCase() || '';
    if (desc.includes('clear') || desc.includes('sunny')) return '#F59E0B'; // Sunny yellow
    if (desc.includes('cloud')) return '#6B7280'; // Cloudy gray
    if (desc.includes('rain') || desc.includes('drizzle')) return '#3B82F6'; // Rainy blue
    if (desc.includes('thunder') || desc.includes('storm')) return '#8B5CF6'; // Storm purple
    if (desc.includes('snow')) return '#E5E7EB'; // Snow white/gray
    return '#10B981'; // Default green
  }, []);

  // Format location information (same logic as weather page)
  const formatLocationInfo = useCallback(() => {
    // Use detailed location if available (same as weather page)
    if (detailedLocation) {
      return detailedLocation.name;
    }

    // Fallback to weather API location
    if (!weatherData || !weatherData.location) {
      return t('weather.loadingLocation');
    }

    const locationName = weatherData.location.name || 'Unknown Location';

    return locationName;
  }, [detailedLocation, weatherData]);

  const handleScanPress = useCallback(() => {

    router.push('/detection' as any);
  }, []);

  const handleViewHistory = useCallback(() => {

    router.push('/history');
  }, []);

  const handleSelectCrop = useCallback(() => {

    router.push('/sidebar/crophandholdselection');
  }, []);

  const handleStartCropTracking = useCallback(() => {

    router.push('/sidebar/crophandholdselection');
  }, []);

  const getCurrentDate = useCallback(() => {
    const today = new Date();
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    return {
      dayName: days[today.getDay()],
      dayNumber: today.getDate(),
      month: months[today.getMonth()],
      fullDate: `${days[today.getDay()]}, ${months[today.getMonth()]} ${today.getDate()}`
    };
  }, []);

  const getGreeting = useCallback(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  }, []);

  const getWeatherForecast = useCallback(() => {
    const days = ['Today', 'Tomorrow', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const icons: Array<keyof typeof Ionicons.glyphMap> = ['sunny', 'partly-sunny', 'cloudy', 'rainy', 'sunny', 'partly-sunny', 'cloudy'];
    const temps = [28, 30, 26, 24, 29, 31, 27];
    const conditions = ['Clear', 'Partly Cloudy', 'Cloudy', 'Rain', 'Sunny', 'Partly Cloudy', 'Cloudy'];
    const humidity = [65, 70, 80, 85, 60, 68, 75];
    const wind = [12, 15, 18, 20, 10, 14, 16];

    return days.map((day, index) => ({
      day,
      icon: icons[index],
      temp: temps[index],
      condition: conditions[index],
      humidity: humidity[index],
      wind: wind[index],
    }));
  }, []);

  const currentWeek = useMemo(() => {
    // Use dailyUpdate data if available, otherwise fall back to weeks data
    if (dailyUpdate) {
      console.log('Dashboard: Using dailyUpdate for currentWeek:', dailyUpdate.title);
      return {
        week_number: dailyUpdate.week_number,
        title: dailyUpdate.title,
        days: dailyUpdate.days
      };
    }

    if (!weeks || !currentTracking) {
      console.log('Dashboard: No weeks or currentTracking available for currentWeek');
      return null;
    }
    const week = weeks.find(week => week.week_number === currentTracking.currentWeek);

    if (week) {
      console.log('Dashboard: Using weeks data for currentWeek:', week.title);
    } else {
      console.log('Dashboard: No matching week found for currentWeek');
    }

    return week || null;
  }, [dailyUpdate, weeks, currentTracking]);

  const renderSelectCropCard = useCallback(() => (
    <View style={[styles.fullWidthCard, styles.cropCardHorizontal, { backgroundColor: colors.card, borderColor: colors.border }]}>  
      <View style={styles.cropContentRow}>
        {/* Icon on the Left - now clickable */}
        <TouchableOpacity onPress={handleSelectCrop} activeOpacity={0.7}>
          <Animated.View style={[styles.selectCropIconLeft, scaleOnlyStyle]}>
            <Ionicons name="add-circle-outline" size={RFValue(28)} color={colors.primary} />
          </Animated.View>
        </TouchableOpacity>

        {/* Details on the Right */}
        <View style={styles.cropDetailsSection}>
          <Text style={[styles.selectCropTitleLeft, { color: colors.text }]}>{t('dashboard.selectCrop')}</Text>

          {/* Description of what to do and what will be displayed */}
          <Text style={[styles.selectCropDescriptionLeft, { color: colors.textSecondary }]}>  
            {t('dashboard.cropCard.description')}
          </Text>

          {/* What will be shown preview */}
          <View style={styles.cropPreviewInfoLeft}>
            <View style={styles.previewRow}>
              <Ionicons name="information-circle-outline" size={RFValue(10)} color={colors.primary} />
              <Text style={[styles.previewText, { color: colors.textSecondary }]}>  
                {t('dashboard.cropCard.preview')}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.selectCropButtonLeft, { backgroundColor: colors.primary }]}
            onPress={handleSelectCrop}
          >
            <Animated.View style={scaleOnlyStyle}>
              <Ionicons name="leaf-outline" size={RFValue(12)} color={colors.white} />
            </Animated.View>
            <Text style={[styles.selectCropButtonTextLeft, { color: colors.white }]}>{t('dashboard.tracking.addCrop')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  ), [colors, handleSelectCrop, scaleOnlyStyle, t]);

  const handleCropCardPress = useCallback(() => {
    if (currentCrop && cropHandholdingRef.current && mainScrollViewRef.current) {
      // Scroll to the crop handholding section
      cropHandholdingRef.current.measureLayout(
        mainScrollViewRef.current as any,
        (x, y) => {
          mainScrollViewRef.current?.scrollTo({
            y: y - 100, // Offset to show some content above
            animated: true,
          });
        },
        () => {
          // Fallback: scroll to bottom if measure fails
          mainScrollViewRef.current?.scrollToEnd({ animated: true });
        }
      );
    }
  }, [currentCrop]);

  const renderCurrentCropCard = useCallback(() => (
    <TouchableOpacity
      style={[styles.fullWidthCard, styles.cropCardHorizontal, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={handleCropCardPress}
      activeOpacity={0.7}
    >
      {loading.crops && !currentCrop ? (
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>{t('common.loadingData')}</Text>
        </View>
      ) : (
        <View style={styles.cropContentRow}>
          {/* Crop Image on the Left */}
          <Image
            source={
              currentCrop?.image_urls?.[0]
                ? { uri: currentCrop.image_urls[0] }
                : require('@/assets/default-crop.png')
            }
            style={styles.cropImageLeft}
          />

          {/* Crop Details on the Right */}
          <View style={styles.cropDetailsSection}>
            <Text style={[styles.cropNameLeft, { color: colors.text }]}>
              {currentCrop?.variety ? `${currentCrop.variety} ${currentCrop.name}` : currentCrop?.name}
            </Text>
            <Text style={[styles.cropStageLeft, { color: colors.textSecondary }]}>
              {t('common.week')} {currentTracking?.currentWeek || 0}
            </Text>
            <Text style={[styles.cropProgressLeft, { color: colors.primary }]}>
              {currentWeek?.title || 'Loading week info...'}
            </Text>
          </View>


        </View>
      )}
    </TouchableOpacity>
  ), [colors, currentCrop, currentTracking, currentWeek, loading.crops, t, handleCropCardPress]);

  const renderCropTrackingWelcome = useCallback(() => (
    <View style={[styles.welcomeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.welcomeHeader}>
        <View style={styles.welcomeIconContainer}>
          <Ionicons name="leaf" size={RFValue(40)} color={colors.primary} />
        </View>
      </View>
      <Text style={[styles.welcomeTitle, { color: colors.text }]}>{t('home.title')}</Text>
      <Text style={[styles.welcomeSubtitle, { color: colors.textSecondary }]}>
        {t('dashboard.tracking.description')}
      </Text>
      <TouchableOpacity
        style={[styles.getStartedButton, { backgroundColor: colors.primary }]}
        onPress={handleStartCropTracking}
      >
        <Text style={[styles.getStartedButtonText, { color: colors.white }]}>{t('dashboard.tracking.getStarted')}</Text>
      </TouchableOpacity>
    </View>
  ), [colors, handleStartCropTracking, t]);

  // Calculate adaptive chatbot position based on safe area and tab bar
  const tabBarHeight = Platform.select({
    ios: 49, // Standard iOS tab bar height
    android: 56, // Standard Android tab bar height
  }) || 56;

  // Add extra padding for Android navigation bar when transparent
  const navigationBarPadding = Platform.OS === 'android' ? 48 : 0; // Standard Android nav bar height

  // Calculate total bottom offset
  const safeAreaBottom = insets.bottom || 0;
  const totalBottomOffset = tabBarHeight + navigationBarPadding + safeAreaBottom;

  // Position chatbot with proper margin above all UI elements
  const chatbotBottomPosition = totalBottomOffset + hp('2%'); // Add 2% screen height margin

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContainer: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
              alignItems: 'center',
        paddingHorizontal: wp('4%'),
        backgroundColor: colors.background,
        borderBottomColor: colors.border,
      borderBottomWidth: 0.5,
      minHeight: hp('7%'), // Add minimum height to prevent shifts
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    menuButton: {
      marginRight: wp('3%'),
      padding: wp('2%'),
    },
    breadcrumb: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    breadcrumbText: {
      fontSize: RFValue(18),
      fontWeight: '700',
      color: colors.text,
    },
    headerRight: {
      position: 'relative',
    },
    notificationButton: {
      padding: wp('2%'),
      position: 'relative',
    },
    notificationBadge: {
      position: 'absolute',
      top: wp('0.5%'),
      right: wp('0.5%'),
      width: wp('3%'),
      height: wp('3%'),
      borderRadius: wp('1.5%'),
      backgroundColor: colors.error,
      borderWidth: 1,
      borderColor: colors.white,
      shadowColor: colors.error,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 3,
      elevation: 3,
    },
    topSection: {
      flexDirection: 'row',
      marginBottom: hp('3%'),
      gap: wp('3%'),
    },
    topCard: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: wp('4%'),
      padding: wp('4%'),
      borderWidth: 1,
    },
    fullWidthCard: {
      backgroundColor: colors.card,
      borderRadius: wp('3%'),
      padding: wp('3.5%'),
      borderWidth: 1,
      marginBottom: hp('1.5%'),
      position: 'relative',
    },
    cropSection: {
      marginBottom: hp('2%'),
    },
    weatherCard: {
      position: 'relative',
    },
    weatherHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: hp('1%'),
    },
    weatherIcon: {
      marginRight: wp('2%'),
    },
    locationText: {
      fontSize: RFValue(11),
      color: colors.text,
      fontWeight: '600',
      flex: 1,
    },
    temperatureRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: hp('1%'),
      gap: wp('2%'),
    },
    temperature: {
      fontSize: RFValue(28),
      fontWeight: '700',
      color: colors.text,
    },
    weatherCondition: {
      fontSize: RFValue(11),
      color: colors.textSecondary,
      marginBottom: hp('1%'),
    },
    weatherDetails: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    weatherDetailItem: {
      flex: 1,
      alignItems: 'center',
      paddingHorizontal: wp('0.5%'),
    },
    weatherDetailValue: {
      fontSize: RFValue(12),
      fontWeight: '600',
      color: colors.text,
    },
    weatherDetailLabel: {
      fontSize: RFValue(9),
      color: colors.textSecondary,
    },
    cropCard: {
      alignItems: 'center',
    },
    cropIconContainer: {
      marginBottom: hp('1%'),
    },
    cropImage: {
      width: wp('12%'),
      height: wp('12%'),
      borderRadius: wp('6%'),
      marginBottom: hp('1%'),
    },
    cropName: {
      fontSize: RFValue(13),
      fontWeight: '600',
      textAlign: 'center',
    },
    cropStage: {
      fontSize: RFValue(11),
      textAlign: 'center',
      marginTop: hp('0.5%'),
    },
    cropProgress: {
      fontSize: RFValue(12),
      fontWeight: '700',
      color: colors.primary,
    },
    selectCropTitle: {
      fontSize: RFValue(13),
      fontWeight: '600',
      textAlign: 'center',
      marginBottom: hp('1%'),
    },
    selectCropButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: wp('4%'),
      paddingVertical: hp('0.8%'),
      borderRadius: wp('6%'),
      marginTop: hp('0.5%'),
      gap: wp('1%'),
    },
    selectCropButtonText: {
      fontSize: RFValue(11),
      fontWeight: '600',
    },
    scannerSection: {
      backgroundColor: colors.card,
      borderRadius: wp('4%'),
      padding: wp('4%'),
      marginBottom: hp('2%'),
      borderWidth: 1,
      borderColor: colors.border,
    },
    scannerContent: {
      alignItems: 'center',
    },
    scannerImage: {
      width: wp('80%'),
      height: hp('25%'),
      marginBottom: hp('0.5%'),
    },

    scannerHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: hp('1%'),
    },
    scannerTitle: {
      fontSize: RFValue(15),
      fontWeight: '600',
      color: colors.text,
      marginLeft: wp('2%'),
    },
    newBadge: {
      backgroundColor: colors.secondary,
      paddingHorizontal: wp('2%'),
      paddingVertical: hp('0.3%'),
      borderRadius: wp('3%'),
      marginLeft: wp('2%'),
    },
    newBadgeText: {
      fontSize: RFValue(8),
      color: colors.white,
      fontWeight: '600',
    },
    scannerDescription: {
      fontSize: RFValue(11),
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: hp('2%'),
      lineHeight: RFValue(16),
    },
    scannerActions: {
      flexDirection: 'row',
      gap: wp('3%'),
    },
    scanButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primary,
      paddingHorizontal: wp('3%'),
      paddingVertical: hp('1.2%'),
      borderRadius: wp('6%'),
      minWidth: wp('35%'),
    },
    scanButtonText: {
      fontSize: RFValue(11),
      color: colors.white,
      fontWeight: '600',
      marginLeft: wp('2%'),
      textAlign: 'center',
      flexShrink: 1,
    },
    historyButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background,
      paddingHorizontal: wp('4%'),
      paddingVertical: hp('1.2%'),
      borderRadius: wp('6%'),
      borderWidth: 1,
      borderColor: colors.border,
    },
    historyButtonText: {
      fontSize: RFValue(12),
      color: colors.text,
      fontWeight: '600',
      marginLeft: wp('2%'),
    },
    welcomeCard: {
      borderRadius: wp('4%'),
      padding: wp('6%'),
      borderWidth: 1,
      alignItems: 'center',
    },
    welcomeHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      width: '100%',
      marginBottom: hp('2%'),
    },
    welcomeIconContainer: {
      flex: 1,
      alignItems: 'center',
    },
    welcomeTitle: {
      fontSize: RFValue(16),
      fontWeight: '700',
      textAlign: 'center',
      marginBottom: hp('1%'),
    },
    welcomeSubtitle: {
      fontSize: RFValue(12),
      textAlign: 'center',
      lineHeight: RFValue(18),
      marginBottom: hp('3%'),
    },
    getStartedButton: {
      paddingHorizontal: wp('6%'),
      paddingVertical: hp('1.5%'),
      borderRadius: wp('6%'),
    },
    getStartedButtonText: {
      fontSize: RFValue(12),
      fontWeight: '600',
    },
    chatbotIcon: {
      position: 'absolute',
      bottom: chatbotBottomPosition,
      right: wp('5%'),
      backgroundColor: colors.primary,
      borderRadius: wp('7%'),
      padding: wp('3%'),
      zIndex: 50,
      elevation: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 6,
      minHeight: wp('12%'),
      minWidth: wp('12%'),
      alignItems: 'center',
      justifyContent: 'center',
    },
    notificationModal: {
      position: 'absolute',
      top: hp('10%'),
      right: wp('4%'),
      width: wp('85%'),
      maxWidth: wp('90%'),
      maxHeight: hp('60%'), // Fixed maximum height
      backgroundColor: colors.card,
      padding: wp('4%'),
      borderRadius: wp('4%'),
      borderWidth: 1,
      borderColor: colors.border,
      zIndex: 999,
      shadowColor: colors.text,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 12,
    },
    notificationScrollContainer: {
      maxHeight: hp('45%'), // Fixed height for scrollable area
      marginBottom: hp('1%'),
    },
    notificationHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: hp('2%'),
      paddingBottom: hp('1%'),
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    notificationTitle: {
      fontSize: RFValue(16),
      fontWeight: '700',
      color: colors.text,
    },
    closeButton: {
      padding: wp('2%'),
      borderRadius: wp('2%'),
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    notificationItem: {
      paddingVertical: hp('1.5%'),
      paddingHorizontal: wp('3%'),
      marginVertical: hp('0.3%'),
      borderRadius: wp('3%'),
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.background,
      position: 'relative',
      minHeight: hp('8%'), // Minimum height for consistent spacing
    },
    notificationItemTitle: {
      fontSize: RFValue(12),
      fontWeight: '600',
      color: colors.text,
      marginBottom: hp('0.3%'),
      lineHeight: RFValue(14),
    },
    notificationItemMessage: {
      fontSize: RFValue(11),
      color: colors.textSecondary,
      lineHeight: RFValue(14),
      marginBottom: hp('0.3%'),
    },
    notificationItemTime: {
      fontSize: RFValue(10),
      color: colors.textSecondary,
      fontStyle: 'italic',
    },
    unreadIndicator: {
      width: wp('3%'),
      height: wp('3%'),
      borderRadius: wp('1.5%'),
      backgroundColor: colors.accent,
      position: 'absolute',
      left: wp('1%'),
      top: hp('1%'),
      shadowColor: colors.accent,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.6,
      shadowRadius: 3,
      elevation: 3,
    },
    viewAllButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: hp('1.5%'),
      paddingHorizontal: wp('4%'),
      marginTop: hp('0.5%'),
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.background,
      borderRadius: wp('3%'),
    },
    viewAllButtonText: {
      fontSize: RFValue(13),
      fontWeight: '600',
      marginRight: wp('2%'),
      color: colors.primary,
    },
    emptyNotificationsContainer: {
      alignItems: 'center',
      paddingVertical: hp('4%'),
      paddingHorizontal: wp('2%'),
      backgroundColor: colors.background,
      borderRadius: wp('2%'),
      marginVertical: hp('1%'),
    },
    emptyNotificationsText: {
      fontSize: RFValue(13),
      marginTop: hp('1%'),
      textAlign: 'center',
      color: colors.textSecondary,
      fontStyle: 'italic',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: wp('4%'),
    },
    loadingText: {
      fontSize: RFValue(12),
      textAlign: 'center',
    },
    cropDropdownSection: {
      backgroundColor: colors.card,
      borderRadius: wp('4%'),
      padding: wp('4%'),
      marginBottom: hp('2%'),
      borderWidth: 1,
    },
    dropdownHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: hp('2%'),
    },
    headerLeftContent: {
      flex: 1,
    },
    dropdownTitle: {
      fontSize: RFValue(16),
      fontWeight: '600',
      marginBottom: hp('0.5%'),
    },
    dropdownSubtitle: {
      fontSize: RFValue(12),
      fontWeight: '400',
    },
    cropDropdown: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: wp('3%'),
      borderRadius: wp('3%'),
      borderWidth: 1,
      marginBottom: hp('1.5%'),
    },
    dropdownContent: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    dropdownCropImage: {
      width: wp('10%'),
      height: wp('10%'),
      borderRadius: wp('5%'),
      marginRight: wp('3%'),
    },
    dropdownCropInfo: {
      flex: 1,
    },
    dropdownCropName: {
      fontSize: RFValue(14),
      fontWeight: '600',
      marginBottom: hp('0.3%'),
    },
    dropdownCropWeek: {
      fontSize: RFValue(11),
      fontWeight: '400',
    },
    addCropButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: hp('1%'),
      paddingHorizontal: wp('4%'),
      borderRadius: wp('6%'),
    },
    addCropButtonText: {
      fontSize: RFValue(12),
      fontWeight: '600',
      marginLeft: wp('1%'),
    },
    cropDropdownList: {
      backgroundColor: colors.card,
      borderRadius: wp('4%'),
      borderWidth: 1,
      marginTop: hp('1%'),
      maxHeight: hp('25%'), // Height to show exactly 3 crops
      minHeight: hp('25%'), // Fixed height to show 3 crops consistently
      shadowColor: colors.text,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 5,
      overflow: 'hidden', // Ensure content doesn't overflow
    },
    cropDropdownItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: wp('4%'),
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      height: hp('8%'), // Fixed height to show exactly 3 items (25% / 3 ≈ 8.33%)
      justifyContent: 'center',
    },
    cropItemLeft: {
      position: 'relative',
      marginRight: wp('3%'),
    },
    dropdownItemImage: {
      width: wp('9%'),
      height: wp('9%'),
      borderRadius: wp('6%'),
      borderWidth: 2,
      borderColor: colors.border,
    },
    cropStatusIndicator: {
      position: 'absolute',
      top: -wp('1%'),
      right: -wp('1%'),
      backgroundColor: colors.card,
      borderRadius: wp('3%'),
      padding: wp('0.5%'),
    },
    dropdownItemInfo: {
      flex: 1,
    },
    cropNameRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: hp('0.3%'),
    },
    dropdownItemName: {
      fontSize: RFValue(14),
      fontWeight: '600',
      color: colors.text,
    },
    dropdownItemWeek: {
      fontSize: RFValue(11),
      fontWeight: '500',
      color: colors.textSecondary,
      marginBottom: hp('0.5%'),
    },
    noCropsMessage: {
      padding: wp('4%'),
      alignItems: 'center',
    },
    noCropsText: {
      fontSize: RFValue(12),
      fontStyle: 'italic',
    },
    weatherForecastSection: {
      borderRadius: wp('4%'),
      padding: wp('4%'),
      marginTop: hp('2%'),
      borderWidth: 1,
    },
    forecastHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: hp('2%'),
    },
    forecastTitle: {
      fontSize: RFValue(16),
      fontWeight: '600',
    },
    viewAllText: {
      fontSize: RFValue(12),
      fontWeight: '600',
    },
    forecastScroll: {
      flexDirection: 'row',
    },
    forecastCard: {
      alignItems: 'center',
      padding: wp('2.5%'),
      borderRadius: wp('3%'),
      marginRight: wp('2%'),
      minWidth: wp('17%'),
      maxWidth: wp('17%'),
      borderWidth: 1,
      flex: 0,
    },
    forecastDay: {
      fontSize: RFValue(10),
      fontWeight: '500',
      marginBottom: hp('0.5%'),
    },
    forecastIcon: {
      marginBottom: hp('0.5%'),
    },
    forecastTemp: {
      fontSize: RFValue(14),
      fontWeight: '600',
      marginBottom: hp('0.3%'),
    },
    forecastCondition: {
      fontSize: RFValue(9),
      textAlign: 'center',
      marginBottom: hp('0.5%'),
    },
    forecastDetails: {
      alignItems: 'center',
    },
    forecastDetail: {
      fontSize: RFValue(8),
      marginBottom: hp('0.2%'),
    },

    reloadButton: {
      padding: wp('2%'),
      borderRadius: wp('3%'),
      borderWidth: 1,
      borderColor: colors.border,
    },
    errorText: {
      fontSize: RFValue(12),
      fontWeight: '600',
      color: colors.accent, // Using accent color instead of error
    },
    weatherLoadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: wp('2%'),
      height: hp('10%'),
    },
    weatherLoadingText: {
      fontSize: RFValue(10),
      textAlign: 'center',
      marginTop: hp('1%'),
    },
    weatherContainer: {
      padding: 16,
      borderRadius: 12,
      marginHorizontal: 16,
      marginTop: 8,
    },
    weatherError: {
      padding: 16,
      alignItems: 'center',
    },
    weatherErrorText: {
      fontSize: 14,
      marginBottom: 8,
    },
    retryText: {
      fontSize: 14,
      textDecorationLine: 'underline',
    },
    weatherErrorContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: wp('4%'),
    },
    retryButton: {
      padding: wp('2%'),
      borderRadius: wp('3%'),
      borderWidth: 1,
      borderColor: colors.primary,
    },
    weatherContent: {
      alignItems: 'center',
      paddingVertical: hp('1%'),
    },
    description: {
      fontSize: RFValue(11),
      color: colors.textSecondary,
      marginBottom: hp('1%'),
    },
    detailItem: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    detailText: {
      fontSize: RFValue(12),
      fontWeight: '600',
      color: colors.text,
    },
    detailLabel: {
      fontSize: RFValue(9),
      color: colors.textSecondary,
    },
    weatherContentRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: hp('1%'),
      gap: wp('2%'),
    },
    weatherIconTempCol: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    weatherDetailsCol: {
      flex: 1,
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: hp('1%'),
    },
    detailItemCol: {
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: hp('1%'),
    },
    weatherLocationHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: hp('0.5%'),
    },
    temperatureText: {
      fontSize: RFValue(28),
      fontWeight: '700',
      color: colors.text,
    },
    weatherIconContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    weatherDescription: {
      fontSize: RFValue(11),
      color: colors.textSecondary,
      marginBottom: hp('0.5%'),
    },
    weatherDetailsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'center',
      paddingHorizontal: wp('1%'),
    },
    detailValue: {
      fontSize: RFValue(10),
      fontWeight: '600',
      color: colors.text,
    },
    // Enhanced Weather Card Styles
    enhancedWeatherCard: {
      backgroundColor: colors.card,
      borderRadius: wp('4%'),
      padding: wp('4%'),
      borderWidth: 1,
      marginBottom: hp('1.5%'),
      shadowColor: mode === 'dark' ? '#000' : colors.text,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: mode === 'dark' ? 0.3 : 0.1,
      shadowRadius: 12,
      elevation: 5,
    },
    locationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: wp('2%'),
    },
    weatherMainContent: {
      marginTop: hp('1%'),
    },
    weatherPrimaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: hp('1.5%'),
    },
    temperatureSection: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    temperatureLarge: {
      fontSize: RFValue(28),
      fontWeight: '700',
      color: colors.text,
    },
    temperatureUnit: {
      fontSize: RFValue(12),
      fontWeight: '400',
      marginTop: hp('0.5%'),
      marginLeft: wp('1%'),
    },
    weatherIconSection: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    weatherIconLarge: {
      width: wp('10%'),
      height: wp('10%'),
      marginBottom: hp('0.3%'),
    },
    weatherDescriptionMain: {
      fontSize: RFValue(10),
      fontWeight: '500',
      textAlign: 'center',
      textTransform: 'capitalize',
    },
    weatherDetailsGrid: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: wp('3%'),
      marginTop: hp('0.5%'),
    },
    weatherDetailCard: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: hp('1.2%'),
      paddingHorizontal: wp('2%'),
      borderRadius: wp('3%'),
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: mode === 'dark' ? '#000' : colors.text,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    detailValueLarge: {
      fontSize: RFValue(10),
      fontWeight: '700',
      color: colors.text,
      marginTop: hp('0.3%'),
    },
    detailLabelMain: {
      fontSize: RFValue(8),
      color: colors.textSecondary,
      marginTop: hp('0.3%'),
      textAlign: 'center',
    },
    // Balanced Weather Card Styles
    compactWeatherCard: {
      borderRadius: wp('3%'),
      padding: wp('3.5%'),
      borderWidth: 1,
      marginBottom: hp('1.5%'),
      shadowColor: mode === 'dark' ? '#000' : colors.text,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: mode === 'dark' ? 0.2 : 0.08,
      shadowRadius: 4,
      elevation: 2,
    },
    compactWeatherContent: {
      gap: hp('1.2%'),
    },
    compactWeatherHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    compactLocationSection: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    compactLocationText: {
      fontSize: RFValue(11),
      marginLeft: wp('1%'),
      fontWeight: '500',
    },
    compactMainWeather: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: wp('2.5%'),
    },
    compactTemperature: {
      fontSize: RFValue(20),
      fontWeight: '700',
    },
    compactWeatherIcon: {
      width: wp('8%'),
      height: wp('8%'),
    },
    compactDetailsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: hp('0.6%'),
    },
    compactDescription: {
      fontSize: RFValue(11),
      fontWeight: '500',
      textTransform: 'capitalize',
      flex: 1,
    },
    compactDetailsGroup: {
      flexDirection: 'row',
      gap: wp('3%'),
    },
    compactDetailText: {
      fontSize: RFValue(10),
      fontWeight: '500',
    },
    // Horizontal Crop Card Styles
    cropCardHorizontal: {
      // Remove center alignment for horizontal layout
    },
    cropContentRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: wp('3.5%'),
    },
    cropImageLeft: {
      width: wp('14%'),
      height: wp('14%'),
      borderRadius: wp('7%'),
      borderWidth: 2,
      borderColor: colors.border,
    },
    cropDetailsSection: {
      flex: 1,
      justifyContent: 'center',
    },
    cropNameLeft: {
      fontSize: RFValue(15),
      fontWeight: '700',
      color: colors.text,
      marginBottom: hp('0.4%'),
    },
    cropStageLeft: {
      fontSize: RFValue(11),
      color: colors.textSecondary,
      marginBottom: hp('0.2%'),
    },
    cropProgressLeft: {
      fontSize: RFValue(12),
      fontWeight: '600',
      color: colors.primary,
    },

    // Select Crop Horizontal Styles
    selectCropIconLeft: {
      width: wp('14%'),
      height: wp('14%'),
      borderRadius: wp('7%'),
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: colors.border,
    },
    selectCropTitleLeft: {
      fontSize: RFValue(15),
      fontWeight: '700',
      color: colors.text,
      marginBottom: hp('0.6%'),
    },
    selectCropButtonLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: wp('3%'),
      paddingVertical: hp('0.6%'),
      borderRadius: wp('5%'),
      alignSelf: 'flex-start',
      gap: wp('1%'),
    },
    selectCropButtonTextLeft: {
      fontSize: RFValue(11),
      fontWeight: '600',
    },
    selectCropDescriptionLeft: {
      fontSize: RFValue(11),
      lineHeight: RFValue(15),
      marginBottom: hp('0.8%'),
      marginTop: hp('0.4%'),
    },
    cropPreviewInfoLeft: {
      marginBottom: hp('1%'),
      marginTop: hp('0.5%'),
    },
    previewRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: wp('1.5%'),
    },
    previewText: {
      fontSize: RFValue(10),
      fontStyle: 'italic',
      flex: 1,
      lineHeight: RFValue(14),
    },
  });

  const currentDate = getCurrentDate();
  const handleSendMessage = async (message: ChatMessage) => {
    try {
      setIsSending(true);

      // Add user message to chat history
      setChatHistory(prev => [...prev, message]);

      // Send message to chatbot service
      const response = await chatbotService.sendMessage(message.message);

      if (response.status === 'success') {
        // Add assistant response to chat history
        const assistantMessage: ChatMessage = {
          id: Date.now() + 1,
          type: 'assistant',
          message: response.response,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        setChatHistory(prev => [...prev, assistantMessage]);
      } else {
        // Handle error response
        const errorMessage: ChatMessage = {
          id: Date.now() + 1,
          type: 'assistant',
          message: 'Sorry, I encountered an error. Please try again.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        setChatHistory(prev => [...prev, errorMessage]);
      }
    } catch (error) {
      console.error('Error sending message:', error);

      // Add error message to chat history
      const errorMessage: ChatMessage = {
        id: Date.now() + 1,
        type: 'assistant',
        message: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setChatHistory(prev => [...prev, errorMessage]);
    } finally {
      setIsSending(false);
    }
  };
  // Removed layout ready effect to fix infinite loading issue

  // Handle location permission and updates
  useEffect(() => {
    const initializeLocation = async () => {
      try {
        const hasPermission = await requestPermission();
        if (hasPermission) {
          await getCurrentLocation();
        }
      } catch (error) {
        console.warn('Location initialization failed:', error);
      }
    };

    initializeLocation();
  }, [requestPermission, getCurrentLocation]);

  return (
    <SafeAreaLayout
      backgroundColor={themeColors.background}
      statusBarStyle={mode === 'dark' ? 'light-content' : 'dark-content'}
      edges={['top', 'left', 'right', 'bottom']}
      contentStyle={styles.container}
    >
      {/* Remove problematic layout loader - individual components handle their own loading */}
      <>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              style={styles.menuButton}
              onPress={() => {
                setSidebarOpen(true);
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="menu" size={RFValue(22)} color={colors.text} />
            </TouchableOpacity>
            <View style={styles.breadcrumb}>
              <Text style={styles.breadcrumbText}>{t('dashboard.title')}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.notificationButton}
            onPress={() => setNotificationOpen(!isNotificationOpen)}
          >
            <Ionicons name="notifications-outline" size={RFValue(22)} color={colors.text} />
            {unreadCount > 0 && (
              <View style={styles.notificationBadge} />
            )}
          </TouchableOpacity>
        </View>

        {/* Main Content */}
        <ScrollView
          ref={mainScrollViewRef}
          style={styles.scrollContainer}
          contentContainerStyle={{
            paddingBottom: Platform.OS === 'android' ? hp('20%') : hp('18%'), // Significantly increased padding
            flexGrow: 1, // Ensure content can expand to fill available space
            paddingHorizontal: wp('4%'),
          }}
          showsVerticalScrollIndicator={false} // Disable scroll indicator
          bounces={true} // Enable bouncing for better UX
          overScrollMode="auto" // Android: allow overscroll
          nestedScrollEnabled={true} // Better nested scroll handling
          keyboardShouldPersistTaps="handled" // Ensure touches work properly
          scrollEnabled={true} // Allow normal scrolling
          scrollEventThrottle={16} // Smooth scroll handling

          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
        >
          {/* Compact Weather Card */}
          <TouchableOpacity
            style={[styles.compactWeatherCard, { borderColor: colors.border, backgroundColor: colors.card }]}
            onPress={() => router.push('/(tabs)/weather')}
            activeOpacity={0.7}
          >
            {weatherError ? (
              <View style={styles.weatherErrorContainer}>
                <Ionicons name="alert-circle" size={RFValue(18)} color={colors.accent} />
                <Text style={[styles.weatherErrorText, { color: colors.textSecondary }]}>
                  {t('dashboard.weather.unavailable')}
                </Text>
              </View>
            ) : (
              <View style={styles.compactWeatherContent}>
                {/* Location and Main Weather in One Row */}
                <View style={styles.compactWeatherHeader}>
                  <View style={styles.compactLocationSection}>
                    <Ionicons name="location" size={RFValue(12)} color={colors.primary} />
                    <Text style={[styles.compactLocationText, { color: colors.textSecondary }]}>
                      {formatLocationInfo()}
                    </Text>
                  </View>
                  <View style={styles.compactMainWeather}>
                    <Text style={[styles.compactTemperature, { color: colors.text }]}>
                      {currentWeather?.temperature !== undefined && currentWeather?.temperature !== null ? `${Math.round(currentWeather.temperature)}°C` : `--°C`}
                    </Text>
                    {currentWeather?.iconUrl ? (
                      <Image
                        source={{ uri: currentWeather.iconUrl }}
                        style={styles.compactWeatherIcon}
                        resizeMode="contain"
                      />
                    ) : (
                      <Ionicons
                        name={getDynamicWeatherIcon(currentWeather?.description || '')}
                        size={RFValue(24)}
                        color={getWeatherIconColor(currentWeather?.description || '')}
                      />
                    )}
                  </View>
                </View>

                {/* Compact Details Row */}
                <View style={styles.compactDetailsRow}>
                  <Text style={[styles.compactDescription, { color: colors.text }]}>
                    {currentWeather?.description || 'N/A'}
                  </Text>
                  <View style={styles.compactDetailsGroup}>
                    <Text style={[styles.compactDetailText, { color: colors.textSecondary }]}>
                      💧 {currentWeather?.humidity !== undefined ? `${currentWeather.humidity}%` : '--'}
                    </Text>
                    <Text style={[styles.compactDetailText, { color: colors.textSecondary }]}>
                      🌪️ {currentWeather?.windSpeed !== undefined ? `${currentWeather.windSpeed} m/s` : '--'}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </TouchableOpacity>

          {/* Crop Card - Current Crop or Select Crop */}
          <View style={styles.cropSection}>
            {currentCrop ? renderCurrentCropCard() : renderSelectCropCard()}
          </View>

          {/* Crop Scanner Section */}
          <View style={styles.scannerSection}>
            <View style={styles.scannerContent}>
              <Image
                source={getDetectionStepsImage()}
                style={styles.scannerImage}
                resizeMode="contain"
              />
              <View style={styles.scannerHeader}>
                <Ionicons name="leaf" size={RFValue(20)} color={colors.primary} />
                <Text style={styles.scannerTitle}>{t('dashboard.scanner.title')}</Text>
                <View style={styles.newBadge}>
                  <Text style={styles.newBadgeText}>{t('common.new')}</Text>
                </View>
              </View>
              <Text style={styles.scannerDescription}>
                {t('dashboard.scanner.description')}
              </Text>
              <View style={styles.scannerActions}>
                <TouchableOpacity
                  style={styles.scanButton}
                  onPress={handleScanPress}
                  activeOpacity={0.7}
                >
                  <Animated.View style={scaleOnlyStyle}>
                    <Ionicons name="camera" size={RFValue(16)} color="white" />
                  </Animated.View>
                  <Text style={styles.scanButtonText}>{t('dashboard.scanner.startDetection')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.historyButton}
                  onPress={handleViewHistory}
                  activeOpacity={0.7}
                >
                  <Animated.View style={scaleOnlyStyle}>
                    <Ionicons name="time-outline" size={RFValue(16)} color={colors.text} />
                  </Animated.View>
                  <Text style={styles.historyButtonText}>{t('dashboard.scanner.viewHistory')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Crop Tracking Section */}
          {(loading.currentTracking || loading.trackings || loading.crops) && !currentCrop ? (
            <View style={[styles.welcomeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>{t('common.loadingData')}</Text>
              </View>
            </View>
          ) : currentCrop && currentTracking ? (
            <>
              {/* Crop Dropdown for Handholding */}
              <View style={[styles.cropDropdownSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.dropdownHeader}>
                  <View style={styles.headerLeftContent}>
                    <Text style={[styles.dropdownTitle, { color: colors.text }]}>
                      {getGreeting()}, {user?.username || 'Farmer'}!
                    </Text>
                    <Text style={[styles.dropdownSubtitle, { color: colors.textSecondary }]}>
                      Currently tracking: {currentCrop?.name}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.cropDropdown, { backgroundColor: colors.background, borderColor: colors.border }]}
                  onPress={() => setIsCropDropdownOpen(!isCropDropdownOpen)}
                >
                  <View style={styles.dropdownContent}>
                    <Image
                      source={
                        currentCrop?.image_urls?.[0]
                          ? { uri: currentCrop.image_urls[0] }
                          : require('@/assets/default-crop.png')
                      }
                      style={[styles.dropdownCropImage, { width: wp('9%'), height: wp('9%') }]}
                    />
                    <View style={styles.dropdownCropInfo}>
                      <Text style={[styles.dropdownCropName, { color: colors.text }]}>
                        {currentCrop?.name}
                      </Text>
                      <Text style={[styles.dropdownCropWeek, { color: colors.textSecondary }]}>
                        Week {currentTracking?.currentWeek || 1} • {currentWeek?.title || 'Loading...'}
                      </Text>
                    </View>
                  </View>
                  <Ionicons
                    name={isCropDropdownOpen ? "chevron-up" : "chevron-down"}
                    size={RFValue(20)}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>

                {/* Enhanced Crop Dropdown List */}
                {isCropDropdownOpen && (
                  <Animated.View
                    style={[styles.cropDropdownList, { backgroundColor: colors.card, borderColor: colors.border }, fadeInStyle]}
                  >
                    <View style={{ position: 'relative', flex: 1 }}>
                      <ScrollView
                        ref={dropdownScrollViewRef}
                        style={{ flex: 1, maxHeight: hp('25%') }}
                        contentContainerStyle={{ flexGrow: 1, paddingBottom: hp('0.5%') }}
                        showsVerticalScrollIndicator={true}
                        indicatorStyle={Platform.OS === 'ios' ? 'default' : 'white'}
                        nestedScrollEnabled={true}
                        keyboardShouldPersistTaps="handled"
                        bounces={false}
                        overScrollMode="never"
                        scrollEventThrottle={16}
                        removeClippedSubviews={true}
                        persistentScrollbar={true}
                        fadingEdgeLength={Platform.OS === 'android' ? 20 : 0}
                        alwaysBounceVertical={false}
                        scrollIndicatorInsets={{ right: 1 }}
                        pointerEvents="auto"

                      >
                        {trackingCrops.length > 0 ? (
                          trackingCrops.map((crop, index) => (
                            <TouchableOpacity
                              key={crop.id || index}
                              style={[styles.cropDropdownItem, { borderBottomColor: colors.border }]}
                              onPress={() => handleCropSelection(crop)}
                              activeOpacity={0.7}
                            >
                              <View style={styles.cropItemLeft}>
                                <Image
                                  source={typeof crop.image_urls?.[0] === 'string' ? { uri: crop.image_urls[0] } : crop.image_urls?.[0] || require('@/assets/default-crop.png')}
                                  style={[styles.dropdownItemImage, { width: wp('9%'), height: wp('9%') }]}
                                />
                                <Animated.View style={[styles.cropStatusIndicator, scaleOnlyStyle]}>
                                  <Ionicons
                                    name={crop.isCurrentlyTracked ? "checkmark-circle" : "radio-button-off"}
                                    size={RFValue(12)}
                                    color={crop.isCurrentlyTracked ? colors.success : colors.textSecondary}
                                  />
                                </Animated.View>
                              </View>
                              <View style={styles.dropdownItemInfo}>
                                <View style={styles.cropNameRow}>
                                  <Text style={[styles.dropdownItemName, { color: colors.text }]}>
                                    {crop.name}
                                  </Text>
                                </View>
                                <Text style={[styles.dropdownItemWeek, { color: colors.textSecondary }]}>
                                  Week {crop.currentWeek} • {crop.stage}
                                </Text>
                              </View>
                              <Animated.View style={scaleOnlyStyle}>
                                <Ionicons
                                  name="chevron-forward"
                                  size={RFValue(16)}
                                  color={colors.textSecondary}
                                />
                              </Animated.View>
                            </TouchableOpacity>
                          ))
                        ) : (
                          <View style={styles.noCropsMessage}>
                            <Animated.View style={scaleOnlyStyle}>
                              <Ionicons name="leaf-outline" size={RFValue(24)} color={colors.textSecondary} />
                            </Animated.View>
                            <Text style={[styles.noCropsText, { color: colors.textSecondary }]}>
                              {t('dashboard.tracking.noCropsTracked')}
                            </Text>
                          </View>
                        )}
                      </ScrollView>




                    </View>
                  </Animated.View>
                )}

                <TouchableOpacity
                  style={[styles.addCropButton, { backgroundColor: colors.primary }]}
                  onPress={handleSelectCrop}
                >
                  <Ionicons name="add" size={RFValue(16)} color={colors.white} />
                  <Text style={[styles.addCropButtonText, { color: colors.white }]}>{t('dashboard.tracking.addCrop')}</Text>
                </TouchableOpacity>
              </View>

              <View ref={cropHandholdingRef}>
                <CropHandholdingSuggestions
                  key={currentTracking?.id || 'no-tracking'}
                  cropTracking={currentTracking}
                  colors={colors}
                />
              </View>
            </>
          ) : (
            renderCropTrackingWelcome()
          )}
        </ScrollView>

        {/* Notification Modal */}
        {isNotificationOpen && (
          <View style={styles.notificationModal} pointerEvents="box-none">
            <View style={styles.notificationHeader}>
              <Text style={styles.notificationTitle}>{t('notifications.title')}</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setNotificationOpen(false)}
              >
                <Ionicons name="close" size={RFValue(18)} color={colors.text} />
              </TouchableOpacity>
            </View>

            {isLoadingNotifications ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading notifications...</Text>
              </View>
            ) : notifications.length > 0 && unreadCount > 0 ? (
              <>
                <ScrollView
                  style={styles.notificationScrollContainer}
                  showsVerticalScrollIndicator={true}
                  nestedScrollEnabled={true}
                  keyboardShouldPersistTaps="handled"
                >
                  {notifications.filter(notification => !notification.is_read).map((notification) => (
                    <TouchableOpacity
                      key={notification.id}
                      style={styles.notificationItem}
                      onPress={() => handleMarkNotificationAsRead(notification.id)}
                    >
                      <View style={styles.unreadIndicator} />
                      <Text style={styles.notificationItemTitle}>{notification.title}</Text>
                      <Text style={styles.notificationItemMessage} numberOfLines={2}>{notification.message}</Text>
                      <Text style={styles.notificationItemTime}>{formatNotificationDate(notification.created_at)}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <TouchableOpacity
                  style={styles.viewAllButton}
                  onPress={() => {
                    setNotificationOpen(false);
                    router.push('/notifications' as any);
                  }}
                >
                  <Text style={[styles.viewAllButtonText, { color: colors.primary }]}>
                    View All Notifications
                  </Text>
                  <Ionicons name="arrow-forward" size={RFValue(16)} color={colors.primary} />
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.emptyNotificationsContainer}>
                <Ionicons name="checkmark-circle-outline" size={RFValue(32)} color={colors.success} />
                <Text style={[styles.emptyNotificationsText, { color: colors.textSecondary }]}>
                  All caught up! No new notifications
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ChatBot */}
        <TouchableOpacity
          style={styles.chatbotIcon}
          onPress={() => setIsChatOpen(!isChatOpen)}
        >
          <Ionicons name="chatbubble-ellipses-outline" size={RFValue(24)} color={colors.white} />
        </TouchableOpacity>

        <ChatModal
          isChatOpen={isChatOpen}
          setChatOpen={setIsChatOpen}
          chatInput={chatInput}
          setChatInput={setChatInput}
          sendMessage={handleSendMessage}
          chatHistory={chatHistory}
          colors={colors}
        />
      </>
    </SafeAreaLayout>
  );
};

export default Dashboard;