import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG } from '../config';

export interface NotificationSettings {
  email_notifications: boolean;
  sms_notifications: boolean;
  push_notifications: boolean;
  notification_types: {
    daily_updates: boolean;
    disease_alerts: boolean;
    weather_alerts: boolean;
    market_updates: boolean;
    news_alerts: boolean;
  };
  notification_times: {
    daily_update_time: string;
    alert_time: string;
  };
  topics: {
    weather: boolean;
    market: boolean;
    disease: boolean;
    news: boolean;
  };
}

export interface NotificationSettingsUpdate {
  email_notifications?: boolean;
  sms_notifications?: boolean;
  push_notifications?: boolean;
  notification_types?: Partial<NotificationSettings['notification_types']>;
  notification_times?: Partial<NotificationSettings['notification_times']>;
  topics?: Partial<NotificationSettings['topics']>;
}

class NotificationService {
  private readonly baseUrl = `${API_CONFIG.baseURL}/notifications`;

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

  // Get user's notification settings
  async getNotificationSettings(): Promise<NotificationSettings> {
    try {
      const headers = await this.getAuthHeaders();
      console.log('[NOTIFICATION SERVICE] Fetching notification settings');
      
      const response = await axios.get(`${this.baseUrl}/settings`, { headers });
      console.log('[NOTIFICATION SERVICE] Settings fetched successfully');
      
      return response.data;
    } catch (error: any) {
      console.error('[NOTIFICATION SERVICE] Failed to fetch notification settings:', error);
      throw new Error(error.response?.data?.detail || 'Failed to fetch notification settings');
    }
  }

  // Update user's notification settings
  async updateNotificationSettings(settings: NotificationSettingsUpdate): Promise<void> {
    try {
      const headers = await this.getAuthHeaders();
      console.log('[NOTIFICATION SERVICE] Updating notification settings:', settings);
      
      const response = await axios.put(`${this.baseUrl}/settings`, settings, { headers });
      console.log('[NOTIFICATION SERVICE] Settings updated successfully');
      
      return response.data;
    } catch (error: any) {
      console.error('[NOTIFICATION SERVICE] Failed to update notification settings:', error);
      throw new Error(error.response?.data?.detail || 'Failed to update notification settings');
    }
  }

  // Get all notifications
  async getNotifications(page: number = 1, limit: number = 20): Promise<any[]> {
    try {
      const headers = await this.getAuthHeaders();
      const params = { page, limit };
      
      const response = await axios.get(`${this.baseUrl}/`, { headers, params });
      return response.data;
    } catch (error: any) {
      console.error('[NOTIFICATION SERVICE] Failed to fetch notifications:', error);
      throw new Error(error.response?.data?.detail || 'Failed to fetch notifications');
    }
  }

  // Mark notification as read
  async markNotificationAsRead(notificationId: number): Promise<void> {
    try {
      const headers = await this.getAuthHeaders();
      
      await axios.put(`${this.baseUrl}/${notificationId}/read`, {}, { headers });
      console.log(`[NOTIFICATION SERVICE] Notification ${notificationId} marked as read`);
    } catch (error: any) {
      console.error('[NOTIFICATION SERVICE] Failed to mark notification as read:', error);
      throw new Error(error.response?.data?.detail || 'Failed to mark notification as read');
    }
  }

  // Mark all notifications as read
  async markAllNotificationsAsRead(): Promise<void> {
    try {
      const headers = await this.getAuthHeaders();
      
      await axios.put(`${this.baseUrl}/read-all`, {}, { headers });
      console.log('[NOTIFICATION SERVICE] All notifications marked as read');
    } catch (error: any) {
      console.error('[NOTIFICATION SERVICE] Failed to mark all notifications as read:', error);
      throw new Error(error.response?.data?.detail || 'Failed to mark all notifications as read');
    }
  }

  // Delete notification
  async deleteNotification(notificationId: number): Promise<void> {
    try {
      const headers = await this.getAuthHeaders();
      
      await axios.delete(`${this.baseUrl}/${notificationId}`, { headers });
      console.log(`[NOTIFICATION SERVICE] Notification ${notificationId} deleted`);
    } catch (error: any) {
      console.error('[NOTIFICATION SERVICE] Failed to delete notification:', error);
      throw new Error(error.response?.data?.detail || 'Failed to delete notification');
    }
  }

  // Get notification count
  async getNotificationCount(): Promise<{ unread: number; total: number }> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await axios.get(`${this.baseUrl}/count`, { headers });
      return response.data;
    } catch (error: any) {
      console.error('[NOTIFICATION SERVICE] Failed to get notification count:', error);
      throw new Error(error.response?.data?.detail || 'Failed to get notification count');
    }
  }
}

export const notificationService = new NotificationService(); 