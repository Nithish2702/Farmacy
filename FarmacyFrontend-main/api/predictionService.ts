import axios from 'axios';
import { API_BASE_URL } from '@/config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export interface DiseaseInfo {
  name: string;
  confidence: number;
  symptoms: string[];
  causes: string[];
  treatment: string[];
  fertilizer_recommendations: string[];
  prevention_tips: string[];
}

// Fresh prediction response from API
export interface PredictionResponse {
  prediction_id: string;
  crop_name: string;
  query: string;
  status: 'HEALTHY' | 'DISEASED' | 'UNKNOWN';
  primary_disease?: DiseaseInfo | null;
  other_possible_diseases: DiseaseInfo[];
  overall_confidence_score: number;
  general_recommendations: string[];
  analysis: string;
}

// Historical prediction data (includes database fields)
export interface PredictionHistory {
  // Database fields
  id: string | number;
  prediction_id: string;
  crop_name?: string;
  query?: string;
  image_url?: string;
  created_at: string;
  
  // The prediction_result contains the actual prediction data
  prediction_result: PredictionResponse;
}

export interface PredictionHistoryResponse {
  predictions: PredictionHistory[];
  current_page: number;
  limit: number;
}

class PredictionService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = `${API_BASE_URL}/user`;
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

  async predictPlantDisease(imageUri: string, cropName?: string): Promise<PredictionResponse> {
    try {
      const formData = new FormData();
      
      // Create proper file object for upload
      const imageUriParts = imageUri.split('.');
      const fileType = imageUriParts[imageUriParts.length - 1];
      
      formData.append('image', {
        uri: Platform.OS === 'ios' ? imageUri.replace('file://', '') : imageUri,
        type: `image/${fileType}` || 'image/jpeg',
        name: `plant_image.${fileType}`,
      } as any);
      
      // Only append crop_name if it's provided and not empty
      if (cropName?.trim()) {
        formData.append('crop_name', cropName.trim());
      }

      // Append language
      const lang = await this.getLanguage();
      formData.append('lang', lang);

      const headers = await this.getAuthHeader();
      console.log('Making prediction request with headers:', headers);
      console.log('Image URI:', imageUri);
      console.log('Crop Name:', cropName);
      console.log('Lang:', lang);

      const response = await axios.post(`${this.baseUrl}/predict-disease`, formData, {
        headers: {
          ...headers,
          'Content-Type': 'multipart/form-data',
          'Accept': 'application/json',
        },
        timeout: 30000, // 30 second timeout
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });

      console.log('Raw API response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error predicting plant disease:', error);
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          throw new Error('Request timed out. Please try again.');
        }
        if (!error.response) {
          throw new Error('Network error. Please check your internet connection.');
        }
        console.error('API Error details:', {
          status: error.response?.status,
          data: error.response?.data,
          headers: error.response?.headers
        });
        throw new Error(error.response?.data?.detail || 'Failed to analyze image. Please try again.');
      }
      throw new Error('An unexpected error occurred. Please try again.');
    }
  }

  async getPredictionHistory(skip: number = 0, limit: number = 10): Promise<PredictionHistoryResponse> {
    try {
      const headers = await this.getAuthHeader();

      const response = await axios.get(`${this.baseUrl}/prediction-history`, {
        params: { skip, limit },
        headers,
      });

      return {
        predictions: response.data,
        current_page: Math.floor(skip / limit),
        limit: limit
      };
    } catch (error) {
      console.error('Error fetching prediction history:', error);
      throw error;
    }
  }

  async getPredictionById(id: number): Promise<PredictionHistory> {
    try {
      const headers = await this.getAuthHeader();

      const response = await axios.get(`${this.baseUrl}/prediction-history/${id}`, {
        headers,
      });

      return response.data;
    } catch (error) {
      console.error('Error fetching prediction details:', error);
      throw error;
    }
  }
}

const predictionService = new PredictionService();
export default predictionService;