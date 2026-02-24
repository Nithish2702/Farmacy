import React from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { RFValue } from 'react-native-responsive-fontsize';
import { heightPercentageToDP as hp, widthPercentageToDP as wp } from 'react-native-responsive-screen';
import { useTheme } from '@/context/theme';
import i18n from '@/i18n.config';

interface DailyForecast {
  date: string;
  temperature: {
    day: number | null;
    night: number | null;
    min: number | null;
    max: number | null;
  };
  humidity: number;
  wind_speed: number;
  description: string;
  hourly_forecast: Array<{
    time: string;
    temperature: number;
    humidity: number;
    wind_speed: number;
    description: string;
    feels_like: number;
  }>;
}

interface WeatherForecast {
  coordinates: {
    lat: number;
    lon: number;
  };
  location: {
    name: string;
    country: string;
    state?: string;
    lat: number;
    lon: number;
  };
  forecast_interval_hours: number;
  forecast: DailyForecast[];
}

interface ForecastCardProps {
  weatherForecast: WeatherForecast;
  colors: {
    card: string;
    text: string;
  };
}

const getWeatherIcon = (description: string): keyof typeof Ionicons.glyphMap => {
  const desc = description.toLowerCase();
  if (desc.includes('clear')) return 'sunny';
  if (desc.includes('cloud')) return desc.includes('scattered') ? 'partly-sunny' : 'cloudy';
  if (desc.includes('rain')) return 'rainy';
  if (desc.includes('thunder')) return 'thunderstorm';
  if (desc.includes('snow')) return 'snow';
  if (desc.includes('mist') || desc.includes('fog')) return 'water';
  return 'partly-sunny';
};

const ForecastCard: React.FC<ForecastCardProps> = ({ weatherForecast, colors }) => {
  const { t } = useTranslation();
  const { mode } = useTheme();
  const isDarkMode = mode === 'dark';

  const getDayName = (dateStr: string): string => {
    const date = new Date(dateStr);
    const currentLanguage = i18n.language;
    
    // Map language codes to locale codes
    const localeMap: { [key: string]: string } = {
      'en': 'en-US',
      'hi': 'hi-IN',
      'te': 'te-IN'
    };
    
    const locale = localeMap[currentLanguage] || 'en-US';
    
    try {
      return date.toLocaleDateString(locale, { weekday: 'short' });
    } catch (error) {
      // Fallback to translation keys if locale is not supported
      const dayNames = [
        'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'
      ];
      const dayName = dayNames[date.getDay()];
      return t(`common.daysShort.${dayName}`);
    }
  };

  const getWeatherIconColor = (description: string) => {
    const desc = description.toLowerCase();
    if (desc.includes('rain') || desc.includes('drizzle')) return '#3B82F6'; // Blue for rain
    if (desc.includes('cloud')) return '#6B7280'; // Gray for clouds
    if (desc.includes('sun') || desc.includes('clear')) return '#F59E0B'; // Orange/Yellow for sun
    if (desc.includes('snow')) return '#E5E7EB'; // Light gray for snow
    if (desc.includes('thunder') || desc.includes('storm')) return '#7C3AED'; // Purple for storms
    return '#10B981'; // Default green
  };

  return (
    <View style={[
      styles.forecastCard, 
      { 
        backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : colors.card,
        borderWidth: isDarkMode ? 1 : 0,
        borderColor: isDarkMode ? 'rgba(255,255,255,0.2)' : 'transparent'
      }
    ]}>
      <View style={styles.locationHeader}>
        <Text style={[styles.locationText, { color: colors.text }]}>
          {weatherForecast.location.name}
        </Text>
        <Text style={[styles.locationSubtext, { color: isDarkMode ? 'rgba(255,255,255,0.7)' : colors.text, opacity: isDarkMode ? 1 : 0.7 }]}>
          {weatherForecast.location.state ? `${weatherForecast.location.state}, ` : ''}{weatherForecast.location.country}
        </Text>
      </View>
      <Text style={[styles.forecastTitle, { color: colors.text }]}>
        {t('dashboard.forecast.title')}
      </Text>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={weatherForecast.forecast}
        keyExtractor={(item) => item.date}
        renderItem={({ item, index }) => (
          <View style={[
            styles.forecastItem,
            {
              backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
              borderRadius: wp('3%'),
              padding: wp('3%'),
              marginRight: wp('2%')
            }
          ]}>
            <Text style={[styles.forecastDay, { color: colors.text }]}>
              {index === 0 ? t('common.today') : getDayName(item.date)}
            </Text>
            <Ionicons
              name={getWeatherIcon(item.description)}
              size={RFValue(24)}
              color={getWeatherIconColor(item.description)}
            />
            <Text style={[styles.forecastHigh, { color: colors.text }]}>
              {item.temperature.max !== null ? Math.round(item.temperature.max) : '--'}°
            </Text>
            <Text style={[styles.forecastLow, { color: colors.text, opacity: 0.7 }]}>
              {item.temperature.min !== null ? Math.round(item.temperature.min) : '--'}°
            </Text>
            <Text style={[styles.forecastDesc, { color: colors.text, opacity: 0.8 }]}>
              {item.description}
            </Text>
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  forecastCard: {
    padding: wp('4%'),
    borderRadius: 15,
    marginTop: hp('2%'),
  },
  forecastTitle: {
    fontSize: RFValue(16),
    fontWeight: '600',
    marginBottom: hp('2%'),
  },
  forecastItem: {
    alignItems: 'center',
    minWidth: wp('20%'),
  },
  forecastDay: {
    fontSize: RFValue(14),
    marginBottom: hp('1%'),
  },
  forecastHigh: {
    fontSize: RFValue(16),
    fontWeight: '600',
    marginTop: hp('1%'),
  },
  forecastLow: {
    fontSize: RFValue(14),
    opacity: 0.7,
  },
  forecastDesc: {
    fontSize: RFValue(12),
    textAlign: 'center',
    marginTop: hp('0.5%'),
    opacity: 0.8,
  },
  locationHeader: {
    marginBottom: hp('2%'),
  },
  locationText: {
    fontSize: RFValue(18),
    fontWeight: '600',
  },
  locationSubtext: {
    fontSize: RFValue(14),
    opacity: 0.7,
  },
});

export default ForecastCard;