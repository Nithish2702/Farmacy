import { useState, useEffect, useCallback, useRef } from 'react';
import { weatherService, WeatherData } from '@/api/weatherService';
import { useAuth } from '@/context/AuthContext';

// Re-export the WeatherData type from the service for consumers
export { WeatherData } from '@/api/weatherService';

export interface CurrentWeather {
  temperature: number;
  humidity: number;
  windSpeed: number;
  pressure: number;
  description: string;
  iconUrl: string;
  location: {
    name: string;
    country: string;
    state: string;
  };
}

export interface WeatherError {
  message: string;
  code: string;
}

const logger = {
  info: (message: string, data?: any) => {
    console.log(`🌤️ ${message}`, data || '');
  },
  error: (message: string, error?: any) => {
    console.error(`🌤️ ERROR ${message}`, error || '');
  },
  debug: (message: string, data?: any) => {
    console.log(`🌤️ DEBUG ${message}`, data || '');
  }
};

export const useWeather = () => {
  const { isAuthenticated, language } = useAuth();
  const isMounted = useRef(true);
  const isLoadingRef = useRef(false);

  // State
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<WeatherError | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Set error with code
  const setErrorWithCode = useCallback((message: string, code: string) => {
    setError({ message, code });
  }, []);

  // Get current weather from forecast
  const getCurrentWeather = useCallback((): CurrentWeather | null => {
    if (!weatherData?.forecast?.[0]) {
      return null;
    }
    const today = weatherData.forecast[0];
    const currentHour = new Date().getHours();
    const currentHourlyForecast = today.hourly_forecast.find(hour => {
      const [hourStr] = hour.time.split(':');
      return parseInt(hourStr) >= currentHour;
    }) || today.hourly_forecast[0];
    return {
      temperature: currentHourlyForecast.temperature,
      humidity: currentHourlyForecast.humidity,
      windSpeed: currentHourlyForecast.wind_speed,
      pressure: currentHourlyForecast.pressure,
      description: currentHourlyForecast.description,
      iconUrl: currentHourlyForecast.icon_url,
      location: weatherData.location
    };
  }, [weatherData]);

  // Load weather data
  const loadWeather = useCallback(async (latitude: number, longitude: number, forceRefresh: boolean = false) => {
    if (!isAuthenticated) {
      logger.debug('User not authenticated, skipping weather load');
      return;
    }

    // Prevent multiple simultaneous requests
    if (isLoadingRef.current) {
      logger.debug('Weather load already in progress, skipping');
      return;
    }

    isLoadingRef.current = true;
    setLoading(true);
    setError(null);
    
    try {
      logger.debug(`Loading weather for coordinates: ${latitude}, ${longitude}, forceRefresh: ${forceRefresh}`);
      const data = await weatherService.getWeather(latitude, longitude, forceRefresh);
      if (isMounted.current) {
        setWeatherData(data);
        logger.debug('Weather data loaded successfully');
      }
    } catch (error: any) {
      if (isMounted.current) {
        const message = error.message || 'Failed to load weather data';
        setErrorWithCode(message, 'WEATHER_LOAD_ERROR');
        logger.error('Failed to load weather data', error);
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
        isLoadingRef.current = false;
      }
    }
  }, [isAuthenticated]); // Remove setErrorWithCode dependency to prevent infinite loops

  // Refresh weather data
  const refreshWeather = useCallback(async (latitude: number, longitude: number) => {
    logger.debug('Refreshing weather data');
    await loadWeather(latitude, longitude, true);
  }, [loadWeather]);

  // Clear weather cache
  const clearWeatherCache = useCallback(async () => {
    try {
      await weatherService.clearCache(language);
      logger.info('Weather cache cleared');
    } catch (error: any) {
      logger.error('Failed to clear weather cache', error);
    }
  }, [language]);

  return {
    weatherData,
    currentWeather: getCurrentWeather(),
    loading,
    error,
    clearError,
    loadWeather,
    refreshWeather,
    clearWeatherCache,
  };
}; 