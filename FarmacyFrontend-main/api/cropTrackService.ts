import axios from 'axios';
import { API_BASE_URL } from '@/config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { cacheManager, CACHE_KEYS } from './cacheManager';

export interface CropTrackResponse {
    id: number;
    cropId: number;
    startDate: string;
    currentWeek?: number;
    last_notification_date?: string;
    notificationPreferences?: {
        [key: string]: {
            dailyReminders?: boolean;
            diseaseAlerts?: boolean;
            weatherAlerts?: boolean;
        }
    };
    createdAt: string;
    updatedAt: string;
}

export interface CropTrackInput {
    cropId: number;
    startDate: string;
    notificationPreferences?: NotificationPreference;
}

export interface CropTrackInputWithPreferences {
    crop_id: number;
    start_date: string;
    notification_preferences?: {
        [key: string]: {
            daily_updates?: boolean;
            disease_alerts?: boolean;
            weather_alerts?: boolean;
        }
    };
}

export interface DayData {
    tasks: string[];
    notes: string[];
    recommendations: string[];
}

export interface DailyCropUpdate {
    tracking_id: number;
    lang: string;
    week_number: number;
    days: { [key: string]: DayData };
    title: string;
    alerts: string[];
    weather_info: {
        [key: string]: any;
    }
}

// CropTrackingService for API calls

export interface NotificationPreference {
    dailyReminders?: boolean;
    diseaseAlerts?: boolean;
    weatherAlerts?: boolean;
}

export class CropTrackingService {
    private baseUrl: string;
    private currentLanguage: string;

    constructor() {
        this.baseUrl = `${API_BASE_URL}/user`;
        this.currentLanguage = 'en'; // Default language
    }

    private async getAuthHeader() {
        const token = await AsyncStorage.getItem('access_token');
        return token ? { Authorization: `Bearer ${token}` } : {};
    }

    private async getLanguage(): Promise<string> {
        try {
            const lang = await AsyncStorage.getItem('language');
            console.log('[API TRACK DEBUG] Retrieved language from AsyncStorage:', lang);
            if (!lang) {
                throw new Error('Language not set in AsyncStorage');
            }
            return lang;
        } catch (error) {
            console.error('[API TRACK DEBUG] Error getting language:', error);
            throw error;
        }
    }

    // Start crop tracking (no caching needed as it's a write operation)
    async startCropTracking(tracking: CropTrackInput): Promise<CropTrackResponse> {
        const startDate = new Date(tracking.startDate).toISOString().split('T')[0];
        const lang = await this.getLanguage();

        const payload = {
            crop_id: tracking.cropId,
            start_date: startDate,
            notification_preferences: tracking.notificationPreferences
        };

        console.log("payload", JSON.stringify(payload, null, 2));
        console.log(`[API TRACK DEBUG] Starting crop tracking with language: ${lang}`);

        const res = await axios.post(
            `${this.baseUrl}/crop-tracking`,
            payload,
            { 
                headers: await this.getAuthHeader(),
                params: { lang }
            }
        );

        // Invalidate only necessary caches after creating new tracking
        await this.clearTrackingsListCache(lang);
        
        return this.mapCropTrackResponse(res.data);
    }

    // Get all crop trackings with caching
    async getCropTracking(forceRefresh: boolean = false): Promise<CropTrackResponse[]> {
        const lang = await this.getLanguage();
        
        return cacheManager.getWithCache(
            CACHE_KEYS.TRACKINGS,
            async () => {
                console.log(`[API TRACK DEBUG] Getting all crop trackings with language: ${lang}`);
                const res = await axios.get(
                    `${this.baseUrl}/crop-tracking`,
                    { 
                        headers: await this.getAuthHeader(),
                        params: { lang }
                    }
                );
                if (!res.data || !Array.isArray(res.data)) {
                    return [];
                }
                return res.data.map((item: any) => this.mapCropTrackResponse(item));
            },
            { 
                language: lang, 
                forceRefresh,
                offlineFallback: true,
                timeout: 30000
            }
        );
    }

    // Get current crop tracking with caching
    async getCurrentCropTracking(forceRefresh: boolean = false): Promise<CropTrackResponse | null> {
        const lang = await this.getLanguage();
        
        return cacheManager.getWithCache(
            CACHE_KEYS.CURRENT_TRACKING,
            async () => {
                console.log(`[API TRACK DEBUG] Getting current crop tracking with language: ${lang}`);
                const res = await axios.get(
                    `${this.baseUrl}/current-crop-tracking`,
                    { 
                        headers: await this.getAuthHeader(),
                        params: { lang }
                    }
                );
                if (!res.data || Object.keys(res.data).length === 0) {
                    return null; // No current tracking found
                }
                return this.mapCropTrackResponse(res.data);
            },
            { 
                language: lang, 
                forceRefresh,
                offlineFallback: true,
                timeout: 30000
            }
        );
    }

    // Set current crop tracking (no caching needed as it's a write operation)
    async setCurrentCropTracking(cropId: number): Promise<CropTrackResponse | null> {
        const lang = await this.getLanguage();
        console.log(`[API TRACK DEBUG] Setting current crop tracking to ID ${cropId} with language: ${lang}`);
       
        const res = await axios.put(
            `${this.baseUrl}/current-crop-tracking`,
            {},
            { 
                headers: await this.getAuthHeader(),
                params: { crop_id: cropId, lang }
            }
        );

        // Invalidate only current tracking cache
        await this.clearCurrentTrackingCache(lang);

        if (!res.data || Object.keys(res.data).length === 0) {
            return null; // No current tracking found
        }
        return this.mapCropTrackResponse(res.data);
    }

    // Get daily update with enhanced caching and fallback
    async getDailyUpdate(trackingId: number, forceRefresh: boolean = false): Promise<DailyCropUpdate> {
        const lang = await this.getLanguage();
        const cacheKey = `${CACHE_KEYS.DAILY_UPDATE}_${trackingId}`;
        
        return cacheManager.getWithCache(
            cacheKey,
            async () => {
                console.log(`[API TRACK DEBUG] Getting daily update for tracking ${trackingId} with language: ${lang}`);
                const res = await axios.get(
                    `${this.baseUrl}/daily-update?tracking_id=${trackingId}`,
                    { 
                        headers: await this.getAuthHeader(),
                        params: { lang }
                    }
                );
                if (!res.data) {
                    throw new Error('No daily update data received');
                }
                return res.data;
            },
            { 
                language: lang, 
                forceRefresh,
                offlineFallback: true,
                timeout: 30000
            }
        );
    }

    // Refresh daily update when language changes
    async refreshDailyUpdate(trackingId: number, newLanguage: string): Promise<DailyCropUpdate> {
        console.log(`[API TRACK DEBUG] Refreshing daily update for tracking ID ${trackingId} with new language: ${newLanguage}`);
        
        // Update current language
        this.currentLanguage = newLanguage;
        
        const res = await axios.get(
            `${this.baseUrl}/daily-update`,
            {
                headers: await this.getAuthHeader(),
                params: { tracking_id: trackingId, lang: newLanguage }
            }
        );

        // Cache the new language data
        await cacheManager.saveToCache(`${CACHE_KEYS.DAILY_UPDATE}_${trackingId}`, res.data, newLanguage);
        
        return res.data;
    }

    // Get handhold crops with caching - uses existing crop-tracking route
    async getHandholdCrops(forceRefresh: boolean = false): Promise<any[]> {
        const lang = await this.getLanguage();
        
        return cacheManager.getWithCache(
            CACHE_KEYS.HANDHOLD_CROPS,
            async () => {
                console.log(`[API TRACK DEBUG] Getting handhold crops (using crop-tracking route) with language: ${lang}`);
                // Use the existing crop-tracking route instead of non-existent handhold-crops
                const res = await axios.get(
                    `${this.baseUrl}/crop-tracking`,
                    { 
                        headers: await this.getAuthHeader(),
                        params: { lang }
                    }
                );
                if (!res.data || !Array.isArray(res.data)) {
                    return [];
                }
                // Return the same data as getCropTracking but with different cache key
                return res.data.map((item: any) => this.mapCropTrackResponse(item));
            },
            { 
                language: lang, 
                forceRefresh,
                offlineFallback: true,
                timeout: 30000
            }
        );
    }

    // Invalidate tracking-related cache
    private async invalidateTrackingCache(language: string): Promise<void> {
        const keys = [
            CACHE_KEYS.TRACKINGS,
            CACHE_KEYS.CURRENT_TRACKING
        ];
        await cacheManager.invalidateCache(keys, language);
    }

    // Clear all tracking cache
    async clearAllCache(language?: string): Promise<void> {
        const lang = language || await this.getLanguage();
        const keys = [
            CACHE_KEYS.TRACKINGS,
            CACHE_KEYS.CURRENT_TRACKING,
            CACHE_KEYS.DAILY_UPDATE,
            CACHE_KEYS.HANDHOLD_CROPS
        ];
        await cacheManager.invalidateCache(keys, lang);
    }

    // Clear specific tracking cache - more targeted invalidation
    async clearTrackingCache(trackingId?: number, language?: string): Promise<void> {
        const lang = language || await this.getLanguage();
        const keys = [CACHE_KEYS.TRACKINGS, CACHE_KEYS.CURRENT_TRACKING];
        
        if (trackingId) {
            keys.push(`${CACHE_KEYS.DAILY_UPDATE}_${trackingId}`);
        }
        
        await cacheManager.invalidateCache(keys, lang);
    }

    // Clear only daily update cache for specific tracking
    async clearDailyUpdateCache(trackingId: number, language?: string): Promise<void> {
        const lang = language || await this.getLanguage();
        const keys = [`${CACHE_KEYS.DAILY_UPDATE}_${trackingId}`];
        await cacheManager.invalidateCache(keys, lang);
    }

    // Clear only current tracking cache
    async clearCurrentTrackingCache(language?: string): Promise<void> {
        const lang = language || await this.getLanguage();
        const keys = [CACHE_KEYS.CURRENT_TRACKING];
        await cacheManager.invalidateCache(keys, lang);
    }

    // Clear only trackings list cache
    async clearTrackingsListCache(language?: string): Promise<void> {
        const lang = language || await this.getLanguage();
        const keys = [CACHE_KEYS.TRACKINGS];
        await cacheManager.invalidateCache(keys, lang);
    }

    private mapCropTrackResponse(apiData: any): CropTrackResponse {
        return {
            id: apiData.id,
            cropId: apiData.crop_id,
            startDate: apiData.start_date,
            currentWeek: apiData.current_week,
            last_notification_date: apiData.last_notification_date,
            notificationPreferences: apiData.notification_preferences,
            createdAt: apiData.created_at,
            updatedAt: apiData.updated_at
        };
    }
}

export const cropTrackingService = new CropTrackingService();