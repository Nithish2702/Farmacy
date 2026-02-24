import axios from 'axios';
import { API_BASE_URL } from '../config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { stateManager } from './stateManager';

// Cache keys for disease data
const CACHE_KEYS = {
  DISEASES_BY_STAGE: 'diseases_by_stage',
  DISEASE_DETAILS: 'disease_details',
  STAGE_DISEASES: 'stage_diseases',
  CROP_DISEASES: 'crop_diseases',
} as const;

export interface DiseaseDescription {
  overview: string;
  pathogen: string;
  disease_type: string;
  symptoms: string[];
  causes: string[];
  prevention: string[];
  treatment: string[];
  impact: string;
  prevalence_telangana?: string;
}

export interface Disease {
  id: number;
  name: string;
  type: string;
  description: DiseaseDescription | { [key: string]: DiseaseDescription } | string;
  image_urls?: string[];
}

export interface DiseaseListResponse {
  diseases: Disease[];
  total: number;
  hasMore: boolean;
}

export interface StageDiseases {
  stage_number: number;
  stage_title: string;
  diseases: Disease[];
}

export interface CropStageDiseases {
  crop_id: number;
  crop_name: string;
  stages: StageDiseases[];
}

class DiseaseService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = `${API_BASE_URL}/crops`;
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

  async getDiseases(params: {
    crop_id?: number;
    stage_number?: number;
    disease_type?: string;
    limit?: number;
    skip?: number;
    page?: number;
    search?: string;
  }, forceRefresh: boolean = false): Promise<DiseaseListResponse> {
    const language = await this.getLanguage();
    const cacheKey = `diseases_${JSON.stringify(params)}_${language}`;
    
    return stateManager.fetchData(cacheKey, async () => {
      try {
        const headers = await this.getAuthHeader();
        console.log('[DISEASE SERVICE] Making API request to:', `${this.baseUrl}/diseases`);
        console.log('[DISEASE SERVICE] With params:', { ...params, lang: language });

        const response = await axios.get(`${this.baseUrl}/diseases`, {
          params: {
            ...params,
            lang: language
          },
          headers,
        });

        // Handle different response formats
        if (Array.isArray(response.data)) {
          console.log('[DISEASE SERVICE] Converting array response to DiseaseListResponse format');
          return {
            diseases: response.data,
            total: response.data.length,
            hasMore: response.data.length === (params.limit || 10)
          };
        }

        // Ensure the response has the expected format
        if (!response.data.diseases || !Array.isArray(response.data.diseases)) {
          console.error('[DISEASE SERVICE] Invalid response format:', response.data);
          throw new Error('Invalid response format from API');
        }

        return {
          diseases: response.data.diseases,
          total: response.data.total || response.data.diseases.length,
          hasMore: response.data.hasMore || response.data.diseases.length === (params.limit || 10)
        };
      } catch (error) {
        console.error('[DISEASE SERVICE] Error in getDiseases:', error);
        if (axios.isAxiosError(error)) {
          console.error('[DISEASE SERVICE] API Error:', error.response?.data);
          throw new Error(error.response?.data?.message || 'Failed to fetch diseases');
        }
        throw error;
      }
    }, {
      cacheKey: `${CACHE_KEYS.CROP_DISEASES}_${cacheKey}`,
      language,
      forceRefresh,
      onSuccess: (data, source) => {
        console.log(`[DISEASE SERVICE] Diseases loaded from ${source}:`, data.diseases.length);
      },
      onError: (error) => {
        console.error('[DISEASE SERVICE] Failed to load diseases:', error);
      }
    });
  }

  async getDiseaseById(id: number, forceRefresh: boolean = false): Promise<Disease> {
    const language = await this.getLanguage();
    const cacheKey = `disease_${id}_${language}`;
    
    return stateManager.fetchData(cacheKey, async () => {
      try {
        const headers = await this.getAuthHeader();
        const response = await axios.get(`${this.baseUrl}/diseases/${id}`, {
          params: { lang: language },
          headers,
        });
        return response.data;
      } catch (error) {
        console.error('[DISEASE SERVICE] Error fetching disease details:', error);
        throw error;
      }
    }, {
      cacheKey: `${CACHE_KEYS.DISEASE_DETAILS}_${id}_${language}`,
      language,
      forceRefresh,
      onSuccess: (data, source) => {
        console.log(`[DISEASE SERVICE] Disease ${id} loaded from ${source}:`, data.name);
      },
      onError: (error) => {
        console.error(`[DISEASE SERVICE] Failed to load disease ${id}:`, error);
      }
    });
  }

  // Optimized method to get diseases by stage for a specific crop with caching
  async getDiseasesByStage(cropId: number, forceRefresh: boolean = false): Promise<CropStageDiseases> {
    const language = await this.getLanguage();
    const cacheKey = `diseases_by_stage_${cropId}_${language}`;
    
    return stateManager.fetchData(cacheKey, async () => {
      try {
        const headers = await this.getAuthHeader();
        
        console.log(`[DISEASE SERVICE] Fetching diseases by stage for crop ${cropId} using optimized endpoint`);
        
        // Use the optimized endpoint that returns all diseases for all stages in one call
        const response = await axios.get(`${this.baseUrl}/${cropId}/diseases-by-stage`, {
          params: { lang: language },
          headers,
        });
        
        const result = response.data;
        console.log(`[DISEASE SERVICE] Optimized API Response:`, {
          crop_id: result.crop_id,
          crop_name: result.crop_name,
          stages_count: result.stages?.length || 0,
          total_diseases: result.stages?.reduce((sum: number, stage: any) => sum + (stage.diseases?.length || 0), 0) || 0
        });
        
        return result;
        
      } catch (error) {
        console.error('[DISEASE SERVICE] Error with optimized endpoint, trying fallback method:', error);
        
        // Fallback to the original method if the optimized endpoint is not available
        if (axios.isAxiosError(error) && (error.response?.status === 404 || error.response?.status === 501)) {
          console.log('[DISEASE SERVICE] Optimized endpoint not found (404/501), using fallback method');
          return this.getDiseasesByStageFallback(cropId, language);
        }
        
        // For other errors, try fallback as well
        if (axios.isAxiosError(error) && error.response?.status && error.response.status >= 500) {
          console.log('[DISEASE SERVICE] Server error with optimized endpoint, trying fallback method');
          return this.getDiseasesByStageFallback(cropId, language);
        }
        
        if (axios.isAxiosError(error)) {
          console.error('[DISEASE SERVICE] API Error:', error.response?.data);
          throw new Error(error.response?.data?.message || 'Failed to fetch diseases by stage');
        }
        throw error;
      }
    }, {
      cacheKey: `${CACHE_KEYS.DISEASES_BY_STAGE}_${cropId}_${language}`,
      language,
      forceRefresh,
      onSuccess: (data, source) => {
        console.log(`[DISEASE SERVICE] Diseases by stage for crop ${cropId} loaded from ${source}:`, {
          stages: data.stages?.length || 0,
          totalDiseases: data.stages?.reduce((sum: number, stage: any) => sum + (stage.diseases?.length || 0), 0) || 0
        });
      },
      onError: (error) => {
        console.error(`[DISEASE SERVICE] Failed to load diseases by stage for crop ${cropId}:`, error);
      }
    });
  }

  // Fallback method using individual stage endpoints
  private async getDiseasesByStageFallback(cropId: number, language: string): Promise<CropStageDiseases> {
    try {
      const headers = await this.getAuthHeader();
      console.log(`[DISEASE SERVICE] Using fallback method for crop ${cropId}`);
      
      // First get the crop details
      const cropResponse = await axios.get(`${this.baseUrl}/id/${cropId}`, {
        params: { lang: language },
        headers,
      });
      
      const crop = cropResponse.data;
      console.log(`[DISEASE SERVICE] Crop details:`, crop);
      
      // Get all stages for this crop
      const stagesResponse = await axios.get(`${this.baseUrl}/${cropId}/stages`, {
        params: { lang: language },
        headers,
      });
      
      const stages = stagesResponse.data;
      console.log(`[DISEASE SERVICE] Stages found:`, stages.length);
      
      // For each stage, get the diseases
      const stagesWithDiseases: StageDiseases[] = [];
      
      for (const stage of stages) {
        try {
          console.log(`[DISEASE SERVICE] Fetching diseases for stage ${stage.stage_number}`);
          const diseasesResponse = await axios.get(`${this.baseUrl}/${cropId}/stages/${stage.stage_number}/diseases`, {
            params: { lang: language },
            headers,
          });
          
          const diseases = diseasesResponse.data;
          console.log(`[DISEASE SERVICE] Stage ${stage.stage_number} has ${diseases.length} diseases`);
          
          stagesWithDiseases.push({
            stage_number: stage.stage_number,
            stage_title: stage.title,
            diseases: diseases
          });
        } catch (error) {
          console.warn(`[DISEASE SERVICE] No diseases found for stage ${stage.stage_number}:`, error);
          stagesWithDiseases.push({
            stage_number: stage.stage_number,
            stage_title: stage.title,
            diseases: []
          });
        }
      }
      
      const result = {
        crop_id: cropId,
        crop_name: crop.name,
        stages: stagesWithDiseases
      };
      
      console.log(`[DISEASE SERVICE] Fallback result:`, result);
      return result;
      
    } catch (error) {
      console.error('[DISEASE SERVICE] Error in fallback method:', error);
      if (axios.isAxiosError(error)) {
        console.error('[DISEASE SERVICE] API Error:', error.response?.data);
        throw new Error(error.response?.data?.message || 'Failed to fetch diseases by stage');
      }
      throw error;
    }
  }

  // Method to get diseases for a specific stage with caching
  async getStageDiseases(cropId: number, stageNumber: number, forceRefresh: boolean = false): Promise<Disease[]> {
    const language = await this.getLanguage();
    const cacheKey = `stage_diseases_${cropId}_${stageNumber}_${language}`;
    
    return stateManager.fetchData(cacheKey, async () => {
      try {
        const headers = await this.getAuthHeader();
        
        const response = await axios.get(`${this.baseUrl}/${cropId}/stages/${stageNumber}/diseases`, {
          params: { lang: language },
          headers,
        });
        
        return response.data;
      } catch (error) {
        console.error('[DISEASE SERVICE] Error fetching stage diseases:', error);
        if (axios.isAxiosError(error)) {
          console.error('[DISEASE SERVICE] API Error:', error.response?.data);
          throw new Error(error.response?.data?.message || 'Failed to fetch stage diseases');
        }
        throw error;
      }
    }, {
      cacheKey: `${CACHE_KEYS.STAGE_DISEASES}_${cropId}_${stageNumber}_${language}`,
      language,
      forceRefresh,
      onSuccess: (data, source) => {
        console.log(`[DISEASE SERVICE] Stage diseases for crop ${cropId}, stage ${stageNumber} loaded from ${source}:`, data.length);
      },
      onError: (error) => {
        console.error(`[DISEASE SERVICE] Failed to load stage diseases for crop ${cropId}, stage ${stageNumber}:`, error);
      }
    });
  }

  // Method to get all diseases for a crop (across all stages) with caching
  async getCropDiseases(cropId: number, forceRefresh: boolean = false): Promise<Disease[]> {
    const language = await this.getLanguage();
    const cacheKey = `crop_diseases_${cropId}_${language}`;
    
    return stateManager.fetchData(cacheKey, async () => {
      try {
        const headers = await this.getAuthHeader();
        
        const response = await axios.get(`${this.baseUrl}/diseases`, {
          params: { 
            crop_id: cropId,
            lang: language,
            limit: 100 // Get all diseases for the crop
          },
          headers,
        });
        
        return response.data.diseases || response.data;
      } catch (error) {
        console.error('[DISEASE SERVICE] Error fetching crop diseases:', error);
        if (axios.isAxiosError(error)) {
          console.error('[DISEASE SERVICE] API Error:', error.response?.data);
          throw new Error(error.response?.data?.message || 'Failed to fetch crop diseases');
        }
        throw error;
      }
    }, {
      cacheKey: `${CACHE_KEYS.CROP_DISEASES}_${cropId}_${language}`,
      language,
      forceRefresh,
      onSuccess: (data, source) => {
        console.log(`[DISEASE SERVICE] Crop diseases for crop ${cropId} loaded from ${source}:`, data.length);
      },
      onError: (error) => {
        console.error(`[DISEASE SERVICE] Failed to load crop diseases for crop ${cropId}:`, error);
      }
    });
  }

  // Clear cache for specific crop
  async clearCropCache(cropId: number): Promise<void> {
    try {
      const language = await this.getLanguage();
      const cacheKeys = [
        `${CACHE_KEYS.DISEASES_BY_STAGE}_${cropId}_${language}`,
        `${CACHE_KEYS.CROP_DISEASES}_${cropId}_${language}`,
      ];
      
      // Clear stage-specific caches
      for (let stage = 1; stage <= 10; stage++) {
        cacheKeys.push(`${CACHE_KEYS.STAGE_DISEASES}_${cropId}_${stage}_${language}`);
      }
      
      // Note: Individual cache clearing not available, using clearAllCache as fallback
      await stateManager.clearAllCache();
      console.log(`[DISEASE SERVICE] Cleared cache for crop ${cropId}`);
    } catch (error) {
      console.error(`[DISEASE SERVICE] Error clearing cache for crop ${cropId}:`, error);
    }
  }

  // Clear all disease cache
  async clearAllCache(): Promise<void> {
    try {
      await stateManager.clearAllCache();
      console.log('[DISEASE SERVICE] Cleared all disease cache');
    } catch (error) {
      console.error('[DISEASE SERVICE] Error clearing all cache:', error);
    }
  }
}

const diseaseService = new DiseaseService();
export default diseaseService;