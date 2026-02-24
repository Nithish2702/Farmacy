// app/weather/index.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RFValue } from 'react-native-responsive-fontsize';
import { heightPercentageToDP as hp, widthPercentageToDP as wp } from 'react-native-responsive-screen';
import { useRouter } from 'expo-router';
import { useTheme } from '@/context/theme';
import { useWeather } from '@/hooks/useWeather';
import { useLocation } from '@/hooks/useLocation';
import { WeatherData } from '@/api/weatherService';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  withTiming,
  withSequence,
  withDelay,
  interpolate,
  Extrapolation,
  runOnJS,
  SlideInDown,
  FadeIn,
  SlideInUp,
  SlideInLeft,
  SlideInRight,
  BounceIn,
  ZoomIn,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import { useTranslation } from 'react-i18next';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

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

const WeatherScreen: React.FC = () => {
  const { location, loading: locationLoading } = useLocation();
  const { weatherData, currentWeather, loading, error, refreshWeather, loadWeather } = useWeather();
  const [refreshing, setRefreshing] = useState(false);
  const [detailedLocation, setDetailedLocation] = useState<DetailedLocation | null>(null);
  const [detailedLocationLoading, setDetailedLocationLoading] = useState(false);
  const router = useRouter();
  const { colors, mode } = useTheme();
  const insets = useSafeAreaInsets();
  const isDarkMode = mode === 'dark';
  const { t } = useTranslation();

  // Enhanced nature-themed color palette with gradients
  const themeColors = {
    ...colors,
    success: mode === 'dark' ? '#22C55E' : '#16A34A',
    warning: mode === 'dark' ? '#F59E0B' : '#D97706',
    info: mode === 'dark' ? '#3B82F6' : '#2563EB',
    accent: mode === 'dark' ? '#EF4444' : '#DC2626',
    white: '#FFFFFF',
    secondary: mode === 'dark' ? '#059669' : '#15803D',
    // Nature-themed weather gradients
    weatherGradient: isDarkMode 
      ? ['#0F172A', '#1E293B', '#334155'] 
      : ['#E0F2FE', '#BAE6FD', '#7DD3FC'],
    cardGradient: isDarkMode
      ? ['rgba(15, 23, 42, 0.85)', 'rgba(30, 41, 59, 0.75)', 'rgba(51, 65, 85, 0.65)']
      : ['rgba(255, 255, 255, 0.85)', 'rgba(248, 250, 252, 0.75)', 'rgba(241, 245, 249, 0.65)'],
    headerGradient: isDarkMode
      ? ['rgba(15, 23, 42, 0.95)', 'rgba(30, 41, 59, 0.9)']
      : ['rgba(255, 255, 255, 0.95)', 'rgba(248, 250, 252, 0.9)'],
    // Full page sky blue gradient (slightly darker at bottom, overall darker)
    pageGradient: isDarkMode
      ? ['#1F2937', '#374151', '#4B5563', '#6B7280'] // Better dark mode gradient
      : ['#E0F2FE', '#DBEAFE', '#93C5FD', '#7DD3FC'],
  };

  // Animation values
  const translateY = useSharedValue(SCREEN_HEIGHT);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.8);
  const heroScale = useSharedValue(0.9);
  const heroOpacity = useSharedValue(0);
  const cardsTranslateY = useSharedValue(100);
  const cardsOpacity = useSharedValue(0);

  // Reverse geocoding to get detailed location
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
        console.log('Detailed location:', detailed);
      }
    } catch (error) {
      console.error('Error getting detailed location:', error);
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

  // Get detailed location when weather data changes
  useEffect(() => {
    if (weatherData?.coordinates) {
      getDetailedLocation(weatherData.coordinates.lat, weatherData.coordinates.lon);
    }
  }, [weatherData]);

  // Reset and trigger animations when screen is focused
  useFocusEffect(
    React.useCallback(() => {
      // Reset all animation values
      translateY.value = SCREEN_HEIGHT;
      opacity.value = 0;
      scale.value = 0.8;
      heroScale.value = 0.9;
      heroOpacity.value = 0;
      cardsTranslateY.value = 100;
      cardsOpacity.value = 0;

      // Trigger entrance animations with staggered delays
      setTimeout(() => {
        // Main container animation
        translateY.value = withSpring(0, {
          damping: 20,
          stiffness: 90,
          mass: 1,
        });
        opacity.value = withTiming(1, { duration: 400 });
        scale.value = withSpring(1, {
          damping: 15,
          stiffness: 100,
        });

        // Hero section animation
        setTimeout(() => {
          heroOpacity.value = withTiming(1, { duration: 600 });
          heroScale.value = withSpring(1, {
            damping: 12,
            stiffness: 120,
          });
        }, 200);

        // Cards animation
        setTimeout(() => {
          cardsOpacity.value = withTiming(1, { duration: 500 });
          cardsTranslateY.value = withSpring(0, {
            damping: 18,
            stiffness: 100,
          });
        }, 400);
      }, 100);

      return () => {
        // Reset values when screen loses focus
        translateY.value = SCREEN_HEIGHT;
        opacity.value = 0;
        scale.value = 0.8;
        heroScale.value = 0.9;
        heroOpacity.value = 0;
        cardsTranslateY.value = 100;
        cardsOpacity.value = 0;
      };
    }, [])
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { scale: scale.value }
    ],
    opacity: opacity.value,
  }));

  const heroAnimatedStyle = useAnimatedStyle(() => ({
    opacity: heroOpacity.value,
    transform: [{ scale: heroScale.value }],
  }));

  const cardsAnimatedStyle = useAnimatedStyle(() => ({
    opacity: cardsOpacity.value,
    transform: [{ translateY: cardsTranslateY.value }],
  }));

  // Load weather data when location is available
  useEffect(() => {
    if (location) {
      loadWeather(location.latitude, location.longitude);
    }
  }, [location, loadWeather]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (location) {
      await refreshWeather(location.latitude, location.longitude);
    }
    setRefreshing(false);
  };

  const getWeatherIcon = (description: string): keyof typeof Ionicons.glyphMap => {
    const desc = description.toLowerCase();
    if (desc.includes('rain') || desc.includes('drizzle')) return 'rainy';
    if (desc.includes('cloud')) return 'cloudy';
    if (desc.includes('clear') || desc.includes('sunny')) return 'sunny';
    if (desc.includes('snow')) return 'snow';
    if (desc.includes('thunder') || desc.includes('storm')) return 'thunderstorm';
    if (desc.includes('mist') || desc.includes('fog')) return 'cloud';
    return 'partly-sunny';
  };

  const getWeatherGradient = (description: string): [string, string, ...string[]] => {
    // Improved dark mode gradient with better contrast
    return isDarkMode 
      ? ['#1F2937', '#374151', '#4B5563', '#6B7280'] // Dark gray gradient with better contrast
      : ['#E0F2FE', '#DBEAFE', '#93C5FD', '#7DD3FC'];
  };

  const formatDetailedLocation = () => {
    if (!detailedLocation) {
      return {
        primary: weatherData?.location?.name || 'Unknown Location',
        secondary: weatherData?.location?.state ? `${weatherData.location.state}, ${weatherData.location.country}` : weatherData?.location?.country || 'Unknown',
        tertiary: weatherData?.coordinates ? `${weatherData.coordinates.lat.toFixed(4)}°, ${weatherData.coordinates.lon.toFixed(4)}°` : '',
      };
    }

    const parts = [];
    if (detailedLocation.street && detailedLocation.streetNumber) {
      parts.push(`${detailedLocation.streetNumber} ${detailedLocation.street}`);
    } else if (detailedLocation.street) {
      parts.push(detailedLocation.street);
    }
    
    if (detailedLocation.district && detailedLocation.district !== detailedLocation.name) {
      parts.push(detailedLocation.district);
    }
    
    if (detailedLocation.region && detailedLocation.region !== detailedLocation.name) {
      parts.push(detailedLocation.region);
    }

    return {
      primary: detailedLocation.name,
      secondary: parts.length > 0 ? parts.join(', ') : `${detailedLocation.region || ''}, ${detailedLocation.country}`.replace(/^, /, ''),
      tertiary: `${detailedLocation.postalCode ? detailedLocation.postalCode + ' • ' : ''}${weatherData?.coordinates ? `${weatherData.coordinates.lat.toFixed(4)}°, ${weatherData.coordinates.lon.toFixed(4)}°` : ''}`,
    };
  };



  if (loading && !weatherData) {
    return (
      <LinearGradient
        colors={themeColors.pageGradient as [string, string, ...string[]]}
        style={[styles.container, animatedStyle]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      >
        <Animated.View 
          style={[styles.loadingContainer]}
        >
          <LinearGradient
            colors={themeColors.cardGradient as [string, string, ...string[]]}
            style={styles.loadingCard}
          >
            <ActivityIndicator size="large" color={themeColors.primary} />
            <Text style={[styles.loadingText, { color: themeColors.text }]}>
              {t('weather.loadingData')}
            </Text>
            <Text style={[styles.loadingSubtext, { color: themeColors.textSecondary }]}>
              {t('weather.gettingLocationForecast')}
            </Text>
          </LinearGradient>
        </Animated.View>
      </LinearGradient>
    );
  }

  if (error) {
    const errorMsg = typeof error === 'string' ? error : error?.message || '';
    return (
      <LinearGradient
        colors={themeColors.pageGradient as [string, string, ...string[]]}
        style={[styles.container, animatedStyle]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      > 
        <Animated.View 
          style={[styles.errorContainer]}
        >
          <LinearGradient
            colors={themeColors.cardGradient as [string, string, ...string[]]}
            style={styles.errorCard}
          >
            <Ionicons name="alert-circle" size={RFValue(50)} color={themeColors.accent} />
            <Text style={[styles.errorText, { color: themeColors.text }]}> 
              {errorMsg || t('weather.weatherError')}
            </Text>
            <TouchableOpacity 
              style={[styles.retryButton, { backgroundColor: themeColors.primary }]} 
              onPress={() => {
                if (location) {
                  refreshWeather(location.latitude, location.longitude);
                }
              }}
            >
              <Text style={styles.retryText}>{t('weather.retry')}</Text>
            </TouchableOpacity>
          </LinearGradient>
        </Animated.View>
      </LinearGradient>
    );
  }

  if (!weatherData || !weatherData.forecast || weatherData.forecast.length === 0) {
    return (
      <LinearGradient
        colors={themeColors.pageGradient as [string, string, ...string[]]}
        style={[styles.container, animatedStyle]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      >
        <Animated.View 
          style={[styles.errorContainer]}
        >
          <LinearGradient
            colors={themeColors.cardGradient as [string, string, ...string[]]}
            style={styles.errorCard}
          >
            <Ionicons name="cloud-offline-outline" size={RFValue(50)} color={themeColors.textSecondary} />
            <Text style={[styles.errorText, { color: themeColors.text }]}>{t('weather.noData')}</Text>
            <TouchableOpacity 
              style={[styles.retryButton, { backgroundColor: themeColors.primary }]} 
              onPress={() => {
                if (location) {
                  refreshWeather(location.latitude, location.longitude);
                }
              }}
            >
              <Text style={styles.retryText}>{t('weather.retry')}</Text>
            </TouchableOpacity>
          </LinearGradient>
        </Animated.View>
      </LinearGradient>
    );
  }

  const currentDay = weatherData.forecast[0];
  const weatherGradient = getWeatherGradient(currentWeather?.description || '');
  const locationInfo = formatDetailedLocation();

  return (
    <LinearGradient
      colors={weatherGradient}
      style={[styles.container, animatedStyle]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      <StatusBar 
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: hp('12%') }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            colors={[themeColors.white]}
            tintColor={themeColors.white}
            progressBackgroundColor="rgba(255,255,255,0.2)"
          />
        }
      >
        {/* Hero Weather Section */}
        <Animated.View style={[heroAnimatedStyle]}>
          <View style={styles.heroSection}>
            <View style={styles.locationHeader}>
              <View style={styles.locationContainer}>
                <View style={styles.locationRow}>
                  <Ionicons name="location" size={RFValue(16)} color={isDarkMode ? "rgba(255,255,255,0.9)" : "rgba(30,41,59,0.9)"} />
                  <Text style={[styles.cityText, { color: isDarkMode ? 'rgba(255,255,255,1)' : 'rgba(30,41,59,1)' }]}>
                    {locationInfo.primary}
                  </Text>
                  {detailedLocationLoading && (
                    <ActivityIndicator size="small" color={isDarkMode ? "rgba(255,255,255,0.9)" : "rgba(30,41,59,0.9)"} style={styles.locationLoader} />
                  )}
                </View>
                <Text style={[styles.countryText, { color: isDarkMode ? 'rgba(255,255,255,0.8)' : 'rgba(30,41,59,0.8)' }]}>
                  {locationInfo.secondary}
                </Text>
                {locationInfo.tertiary && (
                  <Text style={[styles.coordinatesText, { color: isDarkMode ? 'rgba(255,255,255,0.6)' : 'rgba(30,41,59,0.6)' }]}>
                    {locationInfo.tertiary}
                  </Text>
                )}
              </View>
            </View>

            <View style={styles.currentWeatherHero}>
              <View style={styles.temperatureHero}>
                <Text style={[styles.temperatureLarge, { color: isDarkMode ? 'rgba(255,255,255,1)' : 'rgba(30,41,59,1)' }]}>
                  {Math.round(currentWeather?.temperature || 0)}°
                </Text>
                <Text style={[styles.descriptionHero, { color: isDarkMode ? 'rgba(255,255,255,0.9)' : 'rgba(30,41,59,0.9)' }]}>
                  {currentWeather?.description}
                </Text>
              </View>
              
              <View style={styles.weatherIconHero}>
                {currentWeather?.iconUrl ? (
                  <Image
                    source={{ uri: currentWeather.iconUrl }}
                    style={styles.weatherIconLarge}
                    resizeMode="contain"
                  />
                ) : (
                  <Ionicons
                    name={getWeatherIcon(currentWeather?.description || '')}
                    size={RFValue(80)}
                    color={isDarkMode ? "rgba(255,255,255,0.9)" : "rgba(30,41,59,0.9)"}
                  />
                )}
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Weather Details Cards */}
        <Animated.View style={[cardsAnimatedStyle]}>
          <View style={styles.detailsGrid}>
            <View style={[styles.detailCard, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.25)' }]}>
              <Ionicons name="water" size={RFValue(24)} color={isDarkMode ? '#60A5FA' : '#3B82F6'} />
              <Text style={[styles.detailValue, { color: isDarkMode ? 'rgba(255,255,255,0.95)' : 'rgba(30,41,59,0.95)' }]}> 
                {currentWeather?.humidity || 0}%
              </Text>
              <Text style={[styles.detailLabel, { color: isDarkMode ? 'rgba(255,255,255,0.7)' : 'rgba(30,41,59,0.7)' }]}>{t('weather.metrics.humidity')}</Text>
            </View>

            <View style={[styles.detailCard, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.25)' }]}>
              <Ionicons name="flag" size={RFValue(24)} color={isDarkMode ? '#34D399' : '#10B981'} />
              <Text style={[styles.detailValue, { color: isDarkMode ? 'rgba(255,255,255,0.95)' : 'rgba(30,41,59,0.95)' }]}> 
                {currentWeather?.windSpeed || 0} m/s
              </Text>
              <Text style={[styles.detailLabel, { color: isDarkMode ? 'rgba(255,255,255,0.7)' : 'rgba(30,41,59,0.7)' }]}>{t('weather.metrics.windSpeed')}</Text>
            </View>

            <View style={[styles.detailCard, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.25)' }]}>
              <Ionicons name="speedometer" size={RFValue(24)} color={isDarkMode ? '#FBBF24' : '#F59E0B'} />
              <Text style={[styles.detailValue, { color: isDarkMode ? 'rgba(255,255,255,0.95)' : 'rgba(30,41,59,0.95)' }]}> 
                {currentWeather?.pressure || 0} hPa
              </Text>
              <Text style={[styles.detailLabel, { color: isDarkMode ? 'rgba(255,255,255,0.7)' : 'rgba(30,41,59,0.7)' }]}>{t('weather.metrics.pressure')}</Text>
            </View>

            <View style={[styles.detailCard, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.25)' }]}>
              <Ionicons name="thermometer" size={RFValue(24)} color={isDarkMode ? '#F87171' : '#EF4444'} />
              <Text style={[styles.detailValue, { color: isDarkMode ? 'rgba(255,255,255,0.95)' : 'rgba(30,41,59,0.95)' }]}> 
                {Math.round(currentWeather?.temperature || 0)}{t('weather.units.celsius')}
              </Text>
              <Text style={[styles.detailLabel, { color: isDarkMode ? 'rgba(255,255,255,0.7)' : 'rgba(30,41,59,0.7)' }]}>{t('weather.metrics.temperature')}</Text>
            </View>
          </View>
        </Animated.View>

        {/* Hourly Forecast */}
        <View style={[styles.section, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.2)' }]}>
          <Text style={[styles.sectionTitle, { color: isDarkMode ? 'rgba(255,255,255,0.95)' : 'rgba(30,41,59,0.95)' }]}>{t('weather.hourlyForecast')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hourlyScroll}>
            {currentDay.hourly_forecast.map((hour, index) => {
              const getColorfulIconColor = (description: string) => {
                const desc = description.toLowerCase();
                if (desc.includes('rain') || desc.includes('drizzle')) return '#3B82F6'; // Blue for rain
                if (desc.includes('cloud')) return '#3B82F6'; // Blue for clouds (changed from gray)
                if (desc.includes('sun') || desc.includes('clear')) return '#F59E0B'; // Orange/Yellow for sun
                if (desc.includes('snow')) return '#E5E7EB'; // Light gray for snow
                if (desc.includes('thunder') || desc.includes('storm')) return '#7C3AED'; // Purple for storms
                return '#10B981'; // Default green
              };
              
              return (
                <View key={index} style={[styles.hourlyItem, { 
                  backgroundColor: isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(59,130,246,0.2)',
                  backdropFilter: 'blur(10px)'
                }]}>
                  <Text style={[styles.hourTime, { color: isDarkMode ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.9)' }]}>{hour.time}</Text>
                  <Ionicons
                    name={getWeatherIcon(hour.description)}
                    size={RFValue(24)}
                    color={getColorfulIconColor(hour.description)}
                  />
                  <Text style={[styles.hourTemp, { color: isDarkMode ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.9)' }]}>{Math.round(hour.temperature)}°C</Text>
                  <Text style={[styles.hourFeelsLike, { color: isDarkMode ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)' }]}> 
                    {t('weather.feelsLike')} {Math.round(hour.feels_like)}°C
                  </Text>
                  <Text style={[styles.hourPressure, { color: isDarkMode ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)' }]}> 
                    {hour.pressure} hPa
                  </Text>
                </View>
              );
            })}
          </ScrollView>
        </View>

        {/* Daily Forecast */}
        <View style={[styles.section, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.2)' }]}>
          <Text style={[styles.sectionTitle, { color: isDarkMode ? 'rgba(255,255,255,0.95)' : 'rgba(30,41,59,0.95)' }]}>{t('weather.sixDayForecast')}</Text>
          {weatherData.forecast.map((day, index) => {
            // Get weekday key (e.g., 'monday', 'tuesday', ...)
            const weekdayKey = new Date(day.date).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
            return (
              <View key={index} style={[styles.dailyItem]}>
                <View style={styles.dailyLeft}>
                  <Text style={[styles.dayText, { color: isDarkMode ? 'rgba(255,255,255,0.95)' : 'rgba(30,41,59,0.95)' }]}> 
                    {index === 0 ? t('weather.days.today') : t(`weather.days.${weekdayKey}`)}
                  </Text>
                  <Text style={[styles.dailyPressure, { color: isDarkMode ? 'rgba(255,255,255,0.7)' : 'rgba(30,41,59,0.7)' }]}> 
                    {Math.round(day.pressure)} hPa
                  </Text>
                </View>
                <View style={styles.dailyInfo}>
                  <Ionicons
                    name={getWeatherIcon(day.description)}
                    size={RFValue(20)}
                    color={isDarkMode ? '#60A5FA' : '#3B82F6'}
                  />
                  <Text style={[styles.dailyTemp, { color: isDarkMode ? 'rgba(255,255,255,0.95)' : 'rgba(30,41,59,0.95)' }]}> 
                    {Math.round(day.temperature.max || 0)}°C {t('weather.separator')} {Math.round(day.temperature.min || 0)}°C
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('2%'),
  },
  backButton: {
    marginRight: wp('3%'),
    padding: wp('2%'),
  },
  headerTitle: {
    fontSize: RFValue(18),
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: wp('5%'),
  },
  loadingText: {
    marginTop: hp('2%'),
    fontSize: RFValue(14),
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: wp('5%'),
  },
  errorText: {
    marginTop: hp('2%'),
    marginBottom: hp('2%'),
    fontSize: RFValue(14),
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: wp('6%'),
    paddingVertical: hp('1.5%'),
    borderRadius: wp('6%'),
  },
  retryText: {
    color: 'white',
    fontSize: RFValue(12),
    fontWeight: '600',
  },
  locationHeader: {
    alignItems: 'center',
    marginVertical: hp('3%'),
    paddingHorizontal: wp('4%'),
  },
  cityText: {
    fontSize: RFValue(20),
    fontWeight: '700',
    textAlign: 'center',
  },
  countryText: {
    fontSize: RFValue(12),
    marginTop: hp('0.5%'),
    textAlign: 'center',
  },
  coordinatesText: {
    fontSize: RFValue(10),
    marginTop: hp('0.5%'),
    textAlign: 'center',
  },
  currentWeatherCard: {
    marginHorizontal: wp('4%'),
    marginBottom: hp('3%'),
    padding: wp('5%'),
    borderRadius: wp('4%'),
  },
  currentWeatherContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp('2%'),
  },
  temperatureSection: {
    flex: 1,
  },
  temperature: {
    fontSize: RFValue(28),
    fontWeight: '700',
    marginBottom: hp('0.5%'),
  },
  description: {
    fontSize: RFValue(12),
    textTransform: 'capitalize',
  },
  weatherIconSection: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  weatherIconImage: {
    width: wp('12%'),
    height: wp('12%'),
  },
  weatherDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: hp('2%'),
  },
  detailItem: {
    alignItems: 'center',
    flex: 1,
  },
  detailText: {
    fontSize: RFValue(14),
    fontWeight: '600',
    marginTop: hp('0.5%'),
  },
  detailLabel: {
    fontSize: RFValue(10),
    marginTop: hp('0.2%'),
  },
  section: {
    marginHorizontal: wp('4%'),
    marginBottom: hp('3%'),
    padding: wp('4%'),
    borderRadius: wp('4%'),
  },
  sectionTitle: {
    fontSize: RFValue(14),
    fontWeight: '600',
    marginBottom: hp('2%'),
  },
  hourlyScroll: {
    marginHorizontal: -wp('2%'),
  },
  hourlyItem: {
    alignItems: 'center',
    padding: wp('3%'),
    marginHorizontal: wp('1%'),
    borderRadius: wp('3%'),
    minWidth: wp('20%'),
  },
  hourTime: {
    fontSize: RFValue(10),
    marginBottom: hp('0.5%'),
  },
  hourTemp: {
    fontSize: RFValue(12),
    fontWeight: '600',
    marginTop: hp('0.5%'),
  },
  hourFeelsLike: {
    fontSize: RFValue(8),
    marginTop: hp('0.3%'),
    textAlign: 'center',
  },
  hourPressure: {
    fontSize: RFValue(8),
    marginTop: hp('0.3%'),
    textAlign: 'center',
  },
  dailyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: hp('1.5%'),
  },
  dayText: {
    fontSize: RFValue(14),
    fontWeight: '500',
  },
  dailyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dailyTemp: {
    fontSize: RFValue(14),
    fontWeight: '600',
    marginLeft: wp('2%'),
  },
  dailyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dailyPressure: {
    fontSize: RFValue(10),
    fontWeight: '500',
    marginLeft: wp('2%'),
  },
  heroSection: {
    padding: wp('4%'),
    borderRadius: wp('4%'),
    marginBottom: hp('3%'),
  },
  currentWeatherHero: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  temperatureHero: {
    marginRight: wp('4%'),
  },
  temperatureLarge: {
    fontSize: RFValue(48),
    fontWeight: '700',
  },
  descriptionHero: {
    fontSize: RFValue(12),
    textTransform: 'capitalize',
  },
  weatherIconHero: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  weatherIconLarge: {
    width: wp('20%'),
    height: wp('20%'),
  },
  errorCard: {
    padding: wp('4%'),
    borderRadius: wp('4%'),
    marginBottom: hp('3%'),
  },
  // New enhanced styles
  refreshHeaderButton: {
    marginLeft: wp('3%'),
    padding: wp('2%'),
  },
  loadingCard: {
    padding: wp('6%'),
    borderRadius: wp('6%'),
    alignItems: 'center',
  },
  loadingSubtext: {
    marginTop: hp('1%'),
    fontSize: RFValue(12),
    textAlign: 'center',
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: wp('2%'),
    marginBottom: hp('3%'),
  },
  detailCard: {
    width: (SCREEN_WIDTH - wp('8%')) / 2 - wp('2%'),
    margin: wp('1%'),
    padding: wp('4%'),
    borderRadius: wp('4%'),
    alignItems: 'center',
  },
  detailValue: {
    fontSize: RFValue(18),
    fontWeight: '700',
    marginTop: hp('1%'),
  },
  enhancedSection: {
    marginHorizontal: wp('4%'),
    marginBottom: hp('3%'),
    padding: wp('4%'),
    borderRadius: wp('6%'),
  },
  sectionTitleEnhanced: {
    fontSize: RFValue(16),
    fontWeight: '700',
    marginBottom: hp('2%'),
  },
  hourlyScrollEnhanced: {
    marginHorizontal: -wp('2%'),
  },
  hourlyItemEnhanced: {
    alignItems: 'center',
    padding: wp('3%'),
    marginHorizontal: wp('1.5%'),
    borderRadius: wp('4%'),
    minWidth: wp('22%'),
  },
  hourTimeEnhanced: {
    fontSize: RFValue(11),
    fontWeight: '600',
    marginBottom: hp('0.8%'),
  },
  hourIconContainer: {
    marginVertical: hp('0.5%'),
  },
  hourIcon: {
    width: wp('8%'),
    height: wp('8%'),
  },
  hourTempEnhanced: {
    fontSize: RFValue(14),
    fontWeight: '700',
    marginTop: hp('0.5%'),
  },
  hourDetails: {
    alignItems: 'center',
    marginTop: hp('0.5%'),
  },
  hourFeelsLikeEnhanced: {
    fontSize: RFValue(9),
    textAlign: 'center',
  },
  hourHumidity: {
    fontSize: RFValue(8),
    textAlign: 'center',
    marginTop: hp('0.2%'),
  },
  dailyItemEnhanced: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: hp('2%'),
    paddingHorizontal: wp('2%'),
    borderRadius: wp('3%'),
    marginBottom: hp('0.5%'),
  },
  dailyLeftEnhanced: {
    flex: 1,
  },
  dayTextEnhanced: {
    fontSize: RFValue(14),
    fontWeight: '600',
  },
  dailyDateEnhanced: {
    fontSize: RFValue(11),
    marginTop: hp('0.3%'),
  },
  dailyCenter: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dailyIconContainer: {
    marginRight: wp('2%'),
  },
  dailyIcon: {
    width: wp('6%'),
    height: wp('6%'),
  },
  dailyDescription: {
    fontSize: RFValue(11),
    textTransform: 'capitalize',
    flex: 1,
  },
  dailyRightEnhanced: {
    flex: 1,
    alignItems: 'flex-end',
  },
  dailyTempEnhanced: {
    fontSize: RFValue(16),
    fontWeight: '700',
  },
  dailyTempMinEnhanced: {
    fontSize: RFValue(12),
    marginTop: hp('0.2%'),
  },
  locationContainer: {
    alignItems: 'center',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationLoader: {
    marginLeft: wp('2%'),
  },
});

export default WeatherScreen;