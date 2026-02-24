import axios, { AxiosError } from 'axios';
import { API_BASE_URL, API_CONFIG } from '@/config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { cacheManager, CACHE_KEYS } from './cacheManager';

export interface Coordinates {
  lat: number;
  lon: number;
}

export interface Location {
  name: string;
  country: string;
  state: string;
  lat: number;
  lon: number;
}

export interface Temperature {
  day: number;
  night: number;
  min: number;
  max: number;
}

export interface Coordinates {
  lat: number;
  lon: number;
}

export interface Location {
  name: string;
  country: string;
  state: string;
  lat: number;
  lon: number;
}

export interface Temperature {
  day: number;
  night: number;
  min: number;
  max: number;
}

export interface HourlyForecast {
  time: string;
  temperature: number;
  humidity: number;
  wind_speed: number;
  description: string;
  feels_like: number;
  pressure: number;
  icon_url: string;
}

export interface DailyForecast {
  date: string;
  temperature: Temperature;
  humidity: number;
  wind_speed: number;
  description: string;
  hourly_forecast: HourlyForecast[];
  forecast_interval: string;
  pressure: number;
  icon_url: string;
}

export interface WeatherData {
  coordinates: Coordinates;
  location: Location;
  forecast_interval_hours: number;
  forecast: DailyForecast[];
}

export interface WeatherError {
  message: string;
  code: string;
}

class WeatherService {
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = `${API_BASE_URL}/user`;
    this.setupAxiosInterceptor();
    
    // Configure axios defaults
    axios.defaults.timeout = API_CONFIG.timeout;
    axios.defaults.headers.common = {
      ...axios.defaults.headers.common,
      ...API_CONFIG.headers,
    };
  }

  private setupAxiosInterceptor() {
    axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (axios.isAxiosError(error)) {
          const axiosError = error as AxiosError<any>;
          if (axiosError.response?.status === 401) {
            // Handle unauthorized access
            console.warn('Weather API unauthorized access');
          }
        }
        return Promise.reject(error);
      }
    );
  }

  private async getAuthHeader() {
    const token = await AsyncStorage.getItem('access_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  private async getLanguage(): Promise<string> {
    try {
      const lang = await AsyncStorage.getItem('language');
      return lang || 'en';
    } catch (error) {
      console.error('Error getting language:', error);
      return 'en';
    }
  }

  private handleError(error: unknown): WeatherError {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<any>;
      
      if (axiosError.response) {
        const status = axiosError.response.status;
        const detail = axiosError.response.data?.detail;

        switch (status) {
          case 400:
            return {
              message: detail || 'Invalid request data',
              code: 'INVALID_REQUEST'
            };
          case 401:
            return {
              message: detail || 'Authentication required',
              code: 'UNAUTHORIZED'
            };
          case 403:
            return {
              message: detail || 'Access forbidden',
              code: 'FORBIDDEN'
            };
          case 404:
            return {
              message: detail || 'Weather data not found',
              code: 'NOT_FOUND'
            };
          default:
            return {
              message: detail || 'An error occurred',
              code: 'SERVER_ERROR'
            };
        }
      }
    }
    
    return {
      message: 'An unexpected error occurred',
      code: 'UNKNOWN_ERROR'
    };
  }

  // Get weather data with caching
  async getWeather(lat: number, lon: number, forceRefresh: boolean = false): Promise<WeatherData> {
    const language = await this.getLanguage();
    const cacheKey = `${CACHE_KEYS.WEATHER}_${lat.toFixed(4)}_${lon.toFixed(4)}`;
    
    return cacheManager.getWithCache(
      cacheKey,
      async () => {
        const headers = await this.getAuthHeader();
        const response = await axios.get<WeatherData>(
          `${this.baseUrl}/forecast/coordinates?lat=${lat}&lon=${lon}`,
          { headers }
        );
        return response.data;
      },
      { language, forceRefresh }
    );
  }

  // Get weather by location name with caching
  async getWeatherByLocation(location: string, forceRefresh: boolean = false): Promise<WeatherData> {
    const language = await this.getLanguage();
    const cacheKey = `${CACHE_KEYS.WEATHER}_location_${location}`;
    
    return cacheManager.getWithCache(
      cacheKey,
      async () => {
        const headers = await this.getAuthHeader();
        const response = await axios.get<WeatherData>(
          `${this.baseUrl}/forecast/location?location=${encodeURIComponent(location)}`,
          { headers }
        );
        return response.data;
      },
      { language, forceRefresh }
    );
  }

  // Clear weather cache
  async clearCache(language?: string): Promise<void> {
    const lang = language || await this.getLanguage();
    const keys = [CACHE_KEYS.WEATHER];
    await cacheManager.invalidateCache(keys, lang);
  }

  // Clear specific weather cache
  async clearWeatherCache(lat?: number, lon?: number, language?: string): Promise<void> {
    const lang = language || await this.getLanguage();
    const keys = [];
    
    if (lat !== undefined && lon !== undefined) {
      keys.push(`${CACHE_KEYS.WEATHER}_${lat.toFixed(4)}_${lon.toFixed(4)}`);
    } else {
      keys.push(CACHE_KEYS.WEATHER);
    }
    
    await cacheManager.invalidateCache(keys, lang);
  }
}

export const weatherService = new WeatherService(); 