import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG } from '../config';
import { cacheManager, CACHE_KEYS } from './cacheManager';
import { stateManager } from './stateManager';

export interface Crop {
  id: number;
  code: string;
  name: string;
  cultivated_in?: string;
  variety: string;
  description?: string;
  cultivation_overview?: string;
  image_urls?: string[];
}

export interface Task {
  id: number;
  title: string;
  description: string;
  type: string;
  status: 'pending' | 'done';
}

export interface DailyTasks {
  day: number;
  tasks: Task[];
}

export interface Week {
  week_number: number;
  title: string;
  day_range?: string;
  days: {
    [key: string]: {
      tasks: string[];
      recommendations: string[];
    };
  };
  image_urls?: string[];
  video_urls?: string[];
  stage_id?: number;
  diseases?: Disease[];
}

export interface Stage {
  stage_number: number;
  title: string;
  description: {
    [key: string]: string;
  };
  image_urls?: string[];
  weeks?: Week[];
  diseases?: Disease[];
}

export interface StageWithWeeks extends Stage {
  weeks: Week[];
}

export interface WeekWithStages extends Week {
  stage: Stage;
}

export interface Disease {
  id: number;
  name: string;
  type: string;
  description: {
    [key: string]: string;
  };
  image_urls?: string[];
}

export interface UserCropTracking {
  trackingId: number;
  cropId: number;
  cropName: string;
  variety: string;
  startDate: string;
  status: string;
  progress: number;
  [key: string]: any; // Add additional fields as needed
}

export interface DailyCropUpdate {
  trackingId: number;
  updates: {
    day: number;
    tasks: string[];
  }[];
}

class CropService {
  private readonly baseUrl = `${API_CONFIG.baseURL}/crops`;

  private async getAuthHeaders() {
    try {
      const token = await AsyncStorage.getItem('access_token');
      if (!token) {
        throw new Error('No access token found');
      }
      return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      };
    } catch (error) {
      console.error('Error getting auth headers:', error);
      throw error;
    }
  }

  private async getLanguage(): Promise<string> {
    try {
      const lang = await AsyncStorage.getItem('language');
      console.log('[API LANGUAGE DEBUG] Retrieved language from AsyncStorage:', lang);
      // Always return a valid language, default to 'en' if nothing found
      return lang || 'en';
    } catch (error) {
      console.error('[API LANGUAGE DEBUG] Error getting language:', error);
      return 'en'; // Default to English on error
    }
  }

  private handleError(error: any): Error {
    if (error.response && error.response.data && error.response.data.message) {
      return new Error(error.response.data.message);
    }
    if (error.message) {
      return new Error(error.message);
    }
    return new Error('An unknown error occurred');
  }

  // Get all crops with enhanced state management and caching
  async getAllCrops(forceRefresh: boolean = false): Promise<Crop[]> {
    const language = await this.getLanguage();
    
    return stateManager.fetchData('crops', async () => {
      const headers = await this.getAuthHeaders();
      const params = { lang: language };
      console.log('[API CROPS DEBUG] Making API request with language:', language);
      console.log('[API CROPS DEBUG] URL:', `${this.baseUrl}/`);
      console.log('[API CROPS DEBUG] Headers:', headers);
      console.log('[API CROPS DEBUG] Params:', params);
      
      const response = await axios.get(`${this.baseUrl}/`, { headers, params });
      console.log('[API CROPS DEBUG] Response status:', response.status);
      console.log('[API CROPS DEBUG] Response data length:', response.data?.length);
      
      if (!response.data || !Array.isArray(response.data)) {
        throw new Error('Invalid response format from server');
      }
      
      return response.data.map((crop: any) => ({
        id: crop.id,
        name: crop.name,
        code: crop.code,
        variety: crop.variety || '',
        image_urls: crop.image_urls || [],
        weather_info: crop.weather_info
      }));
    }, {
      cacheKey: CACHE_KEYS.CROPS,
      language,
      forceRefresh,
      onSuccess: (data, source) => {
        console.log(`[CROP SERVICE] Crops loaded from ${source}:`, data.length);
      },
      onError: (error) => {
        console.error('[CROP SERVICE] Failed to load crops:', error);
      },
      onCacheHit: (data) => {
        console.log(`[CROP SERVICE] Using cached crops data:`, data.length);
      },
      onCacheFallback: (data, error) => {
        console.log(`[CROP SERVICE] Falling back to cached crops due to network error:`, error.message);
      }
    });
  }

  // Get crop by ID with enhanced state management and caching
  async getCropById(cropId: number, forceRefresh: boolean = false): Promise<Crop> {
    const language = await this.getLanguage();
    
    return stateManager.fetchData(`crop_${cropId}`, async () => {
      const headers = await this.getAuthHeaders();
      const params = { lang: language };
      console.log(`[API CROP DEBUG] Making API request for crop ID ${cropId} with language:`, language);
      console.log(`[API CROP DEBUG] URL:`, `${this.baseUrl}/id/${cropId}`);
      
      const response = await axios.get(`${this.baseUrl}/id/${cropId}`, { headers, params });
      console.log(`[API CROP DEBUG] Response status:`, response.status);
      
      if (!response.data) {
        throw new Error('Crop not found');
      }
      
      return response.data;
    }, {
      cacheKey: `${CACHE_KEYS.CROPS}_${cropId}`,
      language,
      forceRefresh,
      onSuccess: (data, source) => {
        console.log(`[CROP SERVICE] Crop ${cropId} loaded from ${source}`);
      },
      onError: (error) => {
        console.error(`[CROP SERVICE] Failed to load crop ${cropId}:`, error);
      },
      onCacheHit: (data) => {
        console.log(`[CROP SERVICE] Using cached crop data for ID ${cropId}`);
      },
      onCacheFallback: (data, error) => {
        console.log(`[CROP SERVICE] Falling back to cached crop ${cropId} due to network error:`, error.message);
      }
    });
  }

  // Get crop weeks with enhanced state management and caching
  async getCropWeeks(cropId: number, forceRefresh: boolean = false): Promise<Week[]> {
    const language = await this.getLanguage();
    
    return stateManager.fetchData(`weeks_${cropId}`, async () => {
      const headers = await this.getAuthHeaders();
      const params = { lang: language };
      console.log('[API WEEK DEBUG] Making API request for weeks with language:', language);
      console.log('[API WEEK DEBUG] URL:', `${this.baseUrl}/${cropId}/weeks`);
      
      const response = await axios.get(`${this.baseUrl}/${cropId}/weeks`, { headers, params });
      console.log(`[API WEEK DEBUG] Response status:`, response.status);
      console.log(`[API WEEK DEBUG] Response data length:`, response.data?.length);
      
      if (!response.data || !Array.isArray(response.data)) {
        throw new Error('Invalid weeks response format from server');
      }
      
      return response.data;
    }, {
      cacheKey: `${CACHE_KEYS.WEEKS}_${cropId}`,
      language,
      forceRefresh,
      onSuccess: (data, source) => {
        console.log(`[CROP SERVICE] Weeks for crop ${cropId} loaded from ${source}:`, data.length);
      },
      onError: (error) => {
        console.error(`[CROP SERVICE] Failed to load weeks for crop ${cropId}:`, error);
      },
      onCacheHit: (data) => {
        console.log(`[CROP SERVICE] Using cached weeks data for crop ${cropId}:`, data.length);
      },
      onCacheFallback: (data, error) => {
        console.log(`[CROP SERVICE] Falling back to cached weeks for crop ${cropId} due to network error:`, error.message);
      }
    });
  }

  // Get specific crop week with enhanced state management and caching
  async getCropWeek(params: {
      cropId: number,
      weeknumber: number,
      language?: string
    }, forceRefresh: boolean = false): Promise<Week> {
    const language = params.language || await this.getLanguage() || 'en';
    
    return stateManager.fetchData(`week_${params.cropId}_${params.weeknumber}`, async () => {
      const headers = await this.getAuthHeaders();
      console.log(`[API WEEK DEBUG] Making API request for week ${params.weeknumber} with language:`, language);
      console.log(`[API WEEK DEBUG] URL:`, `${this.baseUrl}/${params.cropId}/weeks/${params.weeknumber}`);
      
      const queryParams = { lang: language };
      const response = await axios.get(`${this.baseUrl}/${params.cropId}/weeks/${params.weeknumber}`,
        { headers, params: queryParams }
      );
      
      if (!response.data) {
        throw new Error('Week not found');
      }
      
      return response.data;
    }, {
      cacheKey: `${CACHE_KEYS.WEEKS}_${params.cropId}_${params.weeknumber}`,
      language,
      forceRefresh,
      onSuccess: (data, source) => {
        console.log(`[CROP SERVICE] Week ${params.weeknumber} for crop ${params.cropId} loaded from ${source}`);
      },
      onError: (error) => {
        console.error(`[CROP SERVICE] Failed to load week ${params.weeknumber} for crop ${params.cropId}:`, error);
      }
    });
  }

  // Get crop stages with enhanced state management and caching
  async getCropStages(cropId: number, forceRefresh: boolean = false): Promise<Stage[]> {
    const language = await this.getLanguage();
    
    return stateManager.fetchData(`stages_${cropId}`, async () => {
      const headers = await this.getAuthHeaders();
      const params = { lang: language };
      console.log(`[API STAGES DEBUG] Making API request for stages with language:`, language);
      console.log(`[API STAGES DEBUG] URL:`, `${this.baseUrl}/${cropId}/stages`);
      
      const response = await axios.get(`${this.baseUrl}/${cropId}/stages`, { headers, params });
      console.log(`[API STAGES DEBUG] Response status:`, response.status);
      
      if (!response.data || !Array.isArray(response.data)) {
        throw new Error('Invalid stages response format from server');
      }
      
      return response.data;
    }, {
      cacheKey: `${CACHE_KEYS.WEEKS}_stages_${cropId}`,
      language,
      forceRefresh,
      onSuccess: (data, source) => {
        console.log(`[CROP SERVICE] Stages for crop ${cropId} loaded from ${source}:`, data.length);
      },
      onError: (error) => {
        console.error(`[CROP SERVICE] Failed to load stages for crop ${cropId}:`, error);
      }
    });
  }

  // Get specific crop stage with enhanced state management and caching
  async getCropStage(params: {
      cropId: number,
      stageNumber: number,
      language?: string
    }, forceRefresh: boolean = false): Promise<Stage> {
    const language = params.language || await this.getLanguage() || 'en';
    
    return stateManager.fetchData(`stage_${params.cropId}_${params.stageNumber}`, async () => {
      const headers = await this.getAuthHeaders();
      console.log(`[API STAGE DEBUG] Making API request for stage ${params.stageNumber} with language:`, language);
      console.log(`[API STAGE DEBUG] URL:`, `${this.baseUrl}/${params.cropId}/stages/${params.stageNumber}`);
      
      const queryParams = { lang: language };
      const response = await axios.get(`${this.baseUrl}/${params.cropId}/stages/${params.stageNumber}`,
        { headers, params: queryParams }
      );
      
      if (!response.data) {
        throw new Error('Stage not found');
      }
      
      return response.data;
    }, {
      cacheKey: `${CACHE_KEYS.WEEKS}_stage_${params.cropId}_${params.stageNumber}`,
      language,
      forceRefresh,
      onSuccess: (data, source) => {
        console.log(`[CROP SERVICE] Stage ${params.stageNumber} for crop ${params.cropId} loaded from ${source}`);
      },
      onError: (error) => {
        console.error(`[CROP SERVICE] Failed to load stage ${params.stageNumber} for crop ${params.cropId}:`, error);
      }
    });
  }

  // Get crop stages with weeks with enhanced state management and caching
  async getCropStagesWithWeeks(cropId: number, forceRefresh: boolean = false): Promise<StageWithWeeks[]> {
    const language = await this.getLanguage();
    
    return stateManager.fetchData(`stages_with_weeks_${cropId}`, async () => {
      const headers = await this.getAuthHeaders();
      const params = { lang: language };
      console.log(`[API STAGES WITH WEEKS DEBUG] Making API request with language:`, language);
      console.log(`[API STAGES WITH WEEKS DEBUG] URL:`, `${this.baseUrl}/${cropId}/stages-with-weeks`);
      
      const response = await axios.get(`${this.baseUrl}/${cropId}/stages-with-weeks`, { headers, params });
      console.log(`[API STAGES WITH WEEKS DEBUG] Response status:`, response.status);
      
      if (!response.data || !Array.isArray(response.data)) {
        throw new Error('Invalid stages with weeks response format from server');
      }
      
      return response.data;
    }, {
      cacheKey: `${CACHE_KEYS.WEEKS}_stages_with_weeks_${cropId}`,
      language,
      forceRefresh,
      onSuccess: (data, source) => {
        console.log(`[CROP SERVICE] Stages with weeks for crop ${cropId} loaded from ${source}:`, data.length);
      },
      onError: (error) => {
        console.error(`[CROP SERVICE] Failed to load stages with weeks for crop ${cropId}:`, error);
      }
    });
  }

  // Get crop weeks with stages with enhanced state management and caching
  async getCropWeeksWithStages(cropId: number, forceRefresh: boolean = false): Promise<WeekWithStages[]> {
    const language = await this.getLanguage();
    
    return stateManager.fetchData(`weeks_with_stages_${cropId}`, async () => {
      const headers = await this.getAuthHeaders();
      const params = { lang: language };
      console.log(`[API WEEKS WITH STAGES DEBUG] Making API request with language:`, language);
      console.log(`[API WEEKS WITH STAGES DEBUG] URL:`, `${this.baseUrl}/${cropId}/weeks-with-stages`);
      
      const response = await axios.get(`${this.baseUrl}/${cropId}/weeks-with-stages`, { headers, params });
      console.log(`[API WEEKS WITH STAGES DEBUG] Response status:`, response.status);
      
      if (!response.data || !Array.isArray(response.data)) {
        throw new Error('Invalid weeks with stages response format from server');
      }
      
      return response.data;
    }, {
      cacheKey: `${CACHE_KEYS.WEEKS}_weeks_with_stages_${cropId}`,
      language,
      forceRefresh,
      onSuccess: (data, source) => {
        console.log(`[CROP SERVICE] Weeks with stages for crop ${cropId} loaded from ${source}:`, data.length);
      },
      onError: (error) => {
        console.error(`[CROP SERVICE] Failed to load weeks with stages for crop ${cropId}:`, error);
      }
    });
  }

  // Get crop stage diseases with enhanced state management and caching
  async getCropStageDiseases(params: {
      cropId: number,
      stageNumber: number,
      language?: string
    }, forceRefresh: boolean = false): Promise<Disease[]> {
    const language = params.language || await this.getLanguage() || 'en';
    
    return stateManager.fetchData(`diseases_stage_${params.cropId}_${params.stageNumber}`, async () => {
      const headers = await this.getAuthHeaders();
      console.log(`[API DISEASES DEBUG] Making API request for stage ${params.stageNumber} with language:`, language);
      console.log(`[API DISEASES DEBUG] URL:`, `${this.baseUrl}/${params.cropId}/stages/${params.stageNumber}/diseases`);
      
      const queryParams = { lang: language };
      const response = await axios.get(`${this.baseUrl}/${params.cropId}/stages/${params.stageNumber}/diseases`,
        { headers, params: queryParams }
      );
      
      if (!response.data || !Array.isArray(response.data)) {
        throw new Error('Invalid diseases response format from server');
      }
      
      return response.data;
    }, {
      cacheKey: `${CACHE_KEYS.WEEKS}_diseases_stage_${params.cropId}_${params.stageNumber}`,
      language,
      forceRefresh,
      onSuccess: (data, source) => {
        console.log(`[CROP SERVICE] Diseases for stage ${params.stageNumber} of crop ${params.cropId} loaded from ${source}:`, data.length);
      },
      onError: (error) => {
        console.error(`[CROP SERVICE] Failed to load diseases for stage ${params.stageNumber} of crop ${params.cropId}:`, error);
      }
    });
  }

  // Get crop week diseases with enhanced state management and caching
  async getCropWeekDiseases(params: {
      cropId: number,
      weeknumber: number,
      language?: string
    }, forceRefresh: boolean = false): Promise<Disease[]> {
    const language = params.language || await this.getLanguage() || 'en';
    
    return stateManager.fetchData(`diseases_week_${params.cropId}_${params.weeknumber}`, async () => {
      const headers = await this.getAuthHeaders();
      console.log(`[API DISEASES DEBUG] Making API request for week ${params.weeknumber} with language:`, language);
      console.log(`[API DISEASES DEBUG] URL:`, `${this.baseUrl}/${params.cropId}/weeks/${params.weeknumber}/diseases`);
      
      const queryParams = { lang: language };
      const response = await axios.get(`${this.baseUrl}/${params.cropId}/weeks/${params.weeknumber}/diseases`,
        { headers, params: queryParams }
      );
      
      if (!response.data || !Array.isArray(response.data)) {
        throw new Error('Invalid diseases response format from server');
      }
      
      return response.data;
    }, {
      cacheKey: `${CACHE_KEYS.WEEKS}_diseases_week_${params.cropId}_${params.weeknumber}`,
      language,
      forceRefresh,
      onSuccess: (data, source) => {
        console.log(`[CROP SERVICE] Diseases for week ${params.weeknumber} of crop ${params.cropId} loaded from ${source}:`, data.length);
      },
      onError: (error) => {
        console.error(`[CROP SERVICE] Failed to load diseases for week ${params.weeknumber} of crop ${params.cropId}:`, error);
      }
    });
  }

  // Clear cache for specific crop
  async clearCropCache(cropId?: number, language?: string): Promise<void> {
    const lang = language || await this.getLanguage();
    const keys = [CACHE_KEYS.CROPS];
    
    if (cropId) {
      keys.push(
        `${CACHE_KEYS.CROPS}_${cropId}`,
        `${CACHE_KEYS.WEEKS}_${cropId}`,
        `${CACHE_KEYS.WEEKS}_stages_${cropId}`,
        `${CACHE_KEYS.WEEKS}_stages_with_weeks_${cropId}`,
        `${CACHE_KEYS.WEEKS}_weeks_with_stages_${cropId}`
      );
    }
    
    await cacheManager.invalidateCache(keys, lang);
  }

  // Clear all crop-related cache
  async clearAllCache(language?: string): Promise<void> {
    const lang = language || await this.getLanguage();
    await cacheManager.clearAllCache(lang);
  }

  // Clear stuck operations and cache
  async clearStuckOperations(): Promise<void> {
    try {
      // Clear stuck operations in cache manager
      cacheManager.clearStuckOperations();
      
      // Clear state manager data states
      stateManager.clearAllDataStates();
      
      console.log('[CROP SERVICE] Cleared stuck operations and cache');
    } catch (error) {
      console.error('[CROP SERVICE] Error clearing stuck operations:', error);
    }
  }

  // Get service status for debugging
  async getServiceStatus(): Promise<{
    cacheStatus: { activeOperations: number; operationKeys: string[] };
    stateManagerStatus: { dataStates: number };
  }> {
    return {
      cacheStatus: cacheManager.getOperationStatus(),
      stateManagerStatus: {
        dataStates: stateManager.getAllDataStates().size
      }
    };
  }

  // Get crops with offline support
  async getCropsWithOfflineSupport(forceRefresh: boolean = false): Promise<Crop[]> {
    try {
      // Try to get fresh data first
      return await this.getAllCrops(forceRefresh);
    } catch (error) {
      console.log('[CROP SERVICE] Network request failed, trying cache...');
      
      // If network fails, try to get from cache
      const language = await this.getLanguage();
      const cachedCrops = await cacheManager.loadFromCache<Crop[]>(CACHE_KEYS.CROPS, language);
      if (cachedCrops) {
        console.log('[CROP SERVICE] Using cached crops data');
        return cachedCrops;
      }
      
      // If no cache available, throw the original error
      throw error;
    }
  }

  // Refresh all crop data
  async refreshAllCropData(language?: string): Promise<void> {
    const lang = language || await this.getLanguage();
    
    await stateManager.refreshMultipleData([
      {
        key: 'crops',
        apiCall: () => this.getAllCrops(true),
        options: { cacheKey: CACHE_KEYS.CROPS, language: lang }
      }
    ]);
  }

  // Get cache statistics
  async getCacheStats(): Promise<any> {
    return cacheManager.getCacheStats();
  }

  // Check if data is stale
  isDataStale(key: string, maxAge: number = 60 * 60 * 1000): boolean {
    return stateManager.isDataStale(key, maxAge);
  }
}

export const cropService = new CropService();