import { cropService, Crop, Week, Stage, Disease } from './cropService';
import { useNetworkCheck } from '@/hooks/useNetworkCheck';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Cache keys for storing data locally
const CACHE_KEYS = {
  CROPS: 'cached_crops',
  CROP_WEEKS: 'cached_crop_weeks_',
  CROP_STAGES: 'cached_crop_stages_',
  CROP_STAGE: 'cached_crop_stage_',
  CROP_WEEK: 'cached_crop_week_',
};

// Cache expiration time (24 hours)
const CACHE_EXPIRY = 24 * 60 * 60 * 1000;

class CropServiceWithNetwork {
  private async getCachedData<T>(key: string): Promise<T | null> {
    try {
      const cached = await AsyncStorage.getItem(key);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        // Check if cache is still valid
        if (Date.now() - timestamp < CACHE_EXPIRY) {
          console.log(`📦 Using cached data for: ${key}`);
          return data;
        }
      }
      return null;
    } catch (error) {
      console.log(`❌ Error reading cache for ${key}:`, error);
      return null;
    }
  }

  private async setCachedData<T>(key: string, data: T): Promise<void> {
    try {
      const cacheData = {
        data,
        timestamp: Date.now(),
      };
      await AsyncStorage.setItem(key, JSON.stringify(cacheData));
      console.log(`💾 Cached data for: ${key}`);
    } catch (error) {
      console.log(`❌ Error caching data for ${key}:`, error);
    }
  }

  async getAllCrops(): Promise<Crop[]> {
    try {
      // Try to get cached data first
      const cachedCrops = await this.getCachedData<Crop[]>(CACHE_KEYS.CROPS);
      
      // If we have cached data, return it immediately
      if (cachedCrops) {
        return cachedCrops;
      }

      // If no cache, try to fetch from API
      const crops = await cropService.getAllCrops();
      
      // Cache the fresh data
      await this.setCachedData(CACHE_KEYS.CROPS, crops);
      
      return crops;
    } catch (error) {
      console.log('❌ Error fetching crops:', error);
      
      // If API fails, try to return cached data even if expired
      const cachedCrops = await this.getCachedData<Crop[]>(CACHE_KEYS.CROPS);
      if (cachedCrops) {
        console.log('📦 Returning expired cached crops');
        return cachedCrops;
      }
      
      throw error;
    }
  }

  async getCropWeeks(cropId: number): Promise<Week[]> {
    try {
      const cacheKey = `${CACHE_KEYS.CROP_WEEKS}${cropId}`;
      const cachedWeeks = await this.getCachedData<Week[]>(cacheKey);
      
      if (cachedWeeks) {
        return cachedWeeks;
      }

      const weeks = await cropService.getCropWeeks(cropId);
      await this.setCachedData(cacheKey, weeks);
      
      return weeks;
    } catch (error) {
      console.log(`❌ Error fetching weeks for crop ${cropId}:`, error);
      
      const cacheKey = `${CACHE_KEYS.CROP_WEEKS}${cropId}`;
      const cachedWeeks = await this.getCachedData<Week[]>(cacheKey);
      if (cachedWeeks) {
        console.log(`📦 Returning expired cached weeks for crop ${cropId}`);
        return cachedWeeks;
      }
      
      throw error;
    }
  }

  async getCropStages(cropId: number): Promise<Stage[]> {
    try {
      const cacheKey = `${CACHE_KEYS.CROP_STAGES}${cropId}`;
      const cachedStages = await this.getCachedData<Stage[]>(cacheKey);
      
      if (cachedStages) {
        return cachedStages;
      }

      const stages = await cropService.getCropStages(cropId);
      await this.setCachedData(cacheKey, stages);
      
      return stages;
    } catch (error) {
      console.log(`❌ Error fetching stages for crop ${cropId}:`, error);
      
      const cacheKey = `${CACHE_KEYS.CROP_STAGES}${cropId}`;
      const cachedStages = await this.getCachedData<Stage[]>(cacheKey);
      if (cachedStages) {
        console.log(`📦 Returning expired cached stages for crop ${cropId}`);
        return cachedStages;
      }
      
      throw error;
    }
  }

  async getCropWeek(params: { cropId: number; weeknumber: number; language?: string }): Promise<Week> {
    try {
      const cacheKey = `${CACHE_KEYS.CROP_WEEK}${params.cropId}_${params.weeknumber}_${params.language || 'en'}`;
      const cachedWeek = await this.getCachedData<Week>(cacheKey);
      
      if (cachedWeek) {
        return cachedWeek;
      }

      const week = await cropService.getCropWeek(params);
      await this.setCachedData(cacheKey, week);
      
      return week;
    } catch (error) {
      console.log(`❌ Error fetching week ${params.weeknumber} for crop ${params.cropId}:`, error);
      
      const cacheKey = `${CACHE_KEYS.CROP_WEEK}${params.cropId}_${params.weeknumber}_${params.language || 'en'}`;
      const cachedWeek = await this.getCachedData<Week>(cacheKey);
      if (cachedWeek) {
        console.log(`📦 Returning expired cached week ${params.weeknumber} for crop ${params.cropId}`);
        return cachedWeek;
      }
      
      throw error;
    }
  }

  async getCropStage(params: { cropId: number; stageNumber: number; language?: string }): Promise<Stage> {
    try {
      const cacheKey = `${CACHE_KEYS.CROP_STAGE}${params.cropId}_${params.stageNumber}_${params.language || 'en'}`;
      const cachedStage = await this.getCachedData<Stage>(cacheKey);
      
      if (cachedStage) {
        return cachedStage;
      }

      const stage = await cropService.getCropStage(params);
      await this.setCachedData(cacheKey, stage);
      
      return stage;
    } catch (error) {
      console.log(`❌ Error fetching stage ${params.stageNumber} for crop ${params.cropId}:`, error);
      
      const cacheKey = `${CACHE_KEYS.CROP_STAGE}${params.cropId}_${params.stageNumber}_${params.language || 'en'}`;
      const cachedStage = await this.getCachedData<Stage>(cacheKey);
      if (cachedStage) {
        console.log(`📦 Returning expired cached stage ${params.stageNumber} for crop ${params.cropId}`);
        return cachedStage;
      }
      
      throw error;
    }
  }

  // Clear all cached data
  async clearCache(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => 
        Object.values(CACHE_KEYS).some(cacheKey => key.startsWith(cacheKey))
      );
      await AsyncStorage.multiRemove(cacheKeys);
      console.log('🗑️ Cleared all cached crop data');
    } catch (error) {
      console.log('❌ Error clearing cache:', error);
    }
  }
}

// Export a singleton instance
export const cropServiceWithNetwork = new CropServiceWithNetwork();

// Hook for using the service with network checks
export const useCropServiceWithNetwork = () => {
  const { isOnline, checkConnectionBeforeApiCall } = useNetworkCheck();

  const getAllCrops = async () => {
    return checkConnectionBeforeApiCall(
      () => cropServiceWithNetwork.getAllCrops(),
      false // Don't show separate cached message since it's combined
    );
  };

  const getCropWeeks = async (cropId: number) => {
    return checkConnectionBeforeApiCall(
      () => cropServiceWithNetwork.getCropWeeks(cropId),
      false
    );
  };

  const getCropStages = async (cropId: number) => {
    return checkConnectionBeforeApiCall(
      () => cropServiceWithNetwork.getCropStages(cropId),
      false
    );
  };

  const getCropWeek = async (params: { cropId: number; weeknumber: number; language?: string }) => {
    return checkConnectionBeforeApiCall(
      () => cropServiceWithNetwork.getCropWeek(params),
      false
    );
  };

  const getCropStage = async (params: { cropId: number; stageNumber: number; language?: string }) => {
    return checkConnectionBeforeApiCall(
      () => cropServiceWithNetwork.getCropStage(params),
      false
    );
  };

  const clearCache = () => {
    return cropServiceWithNetwork.clearCache();
  };

  return {
    isOnline,
    getAllCrops,
    getCropWeeks,
    getCropStages,
    getCropWeek,
    getCropStage,
    clearCache,
  };
}; 