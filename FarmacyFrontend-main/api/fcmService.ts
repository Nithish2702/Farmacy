import axios from 'axios';
import { API_BASE_URL } from '../config';
import AsyncStorage from '@react-native-async-storage/async-storage';

export enum NotificationType {
  SYSTEM_ALERT = 'system_alert',
  CROP_ALERT = 'crop_alert',
  WEATHER_ALERT = 'weather_alert',
  DISEASE_ALERT = 'disease_alert',
  MARKET_ALERT = 'market_alert',
  NEWS_ALERT = 'news_alert'
}

export enum NotificationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high'
}

export enum NotificationFrequency {
  INSTANT = 'instant',
  HOURLY = 'hourly',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  NEVER = 'never'
}

export interface NotificationResponse {
  id: number;
  type: NotificationType;
  title: string;
  message: string;
  priority: NotificationPriority;
  data?: Record<string, any>;
  is_read: boolean;
  read_at?: string;
  created_at: string;
  updated_at?: string;
  sent_at?: string;
  delivery_status?: string;
  retry_count: number;
  error_message?: string;
  user_id: number;
  language?: string;
  expires_at?: string;
  scheduled_at?: string;
}

export interface NotificationCreate {
  type: NotificationType;
  title: string;
  message: string;
  priority?: NotificationPriority;
  data?: Record<string, any>;
  language?: string;
  expires_at?: string;
  scheduled_at?: string;
  user_ids?: number[];
  topic_ids?: number[];
}

export interface NotificationSettings {
  email_notifications: boolean;
  sms_notifications: boolean;
  push_notifications: boolean;
  notification_types: Record<string, boolean>;
  notification_frequency: NotificationFrequency;
  quiet_hours_start?: string;
  quiet_hours_end?: string;
  timezone?: string;
}

export interface TopicResponse {
  id: number;
  name: string;
  description: string;
  type: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  subscriber_count: number;
}

export interface TopicCreate {
  name: string;
  description: string;
  type: string;
  is_active?: boolean;
}

export interface TopicBroadcastMessage {
  topic_name: string;
  title: string;
  message: string;
  data?: Record<string, any>;
}

export interface TestJobResponse {
  active: boolean;
  jobs: Array<{
    id: string;
    next_run_time?: string;
    [key: string]: any;
  }>;
}

export interface ApiResponse<T = any> {
  message?: string;
  data?: T;
  [key: string]: any;
}

class FCMService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = `${API_BASE_URL}/notifications`;
  }

  private async getAuthHeader() {
    const token = await AsyncStorage.getItem('access_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  private handleError(error: any, context: string) {
    const errorMessage = error.response?.data?.detail || error.message || 'Unknown error';
    console.error(`${context}:`, errorMessage);
    throw new Error(`${context}: ${errorMessage}`);
  }
  /**
   * Get user's notifications
   * @param skip Number of notifications to skip
   * @param limit Maximum number of notifications to return
   * @param type Optional notification type filter
   * @param unreadOnly Whether to return only unread notifications
   * @returns Promise<NotificationResponse[]>
   */
  async getNotifications(
    skip: number = 0,
    limit: number = 100,
    type?: NotificationType,
    unreadOnly: boolean = false
  ): Promise<NotificationResponse[]> {
    try {
      const headers = await this.getAuthHeader();
      const response = await axios.get(`${this.baseUrl}/`, {
        params: { skip, limit, type, unread_only: unreadOnly },
        headers
      });
      return response.data;
    } catch (error) {
      this.handleError(error, 'Failed to get notifications');
      throw error;
    }
  }

  /**
   * Mark a notification as read
   * @param notificationId ID of the notification to mark as read
   * @returns Promise<ApiResponse>
   */
  async markNotificationAsRead(notificationId: number): Promise<ApiResponse> {
    try {
      const headers = await this.getAuthHeader();
      const response = await axios.patch(
        `${this.baseUrl}/${notificationId}/read`,
        {},
        { headers }
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'Failed to mark notification as read');
      throw error;
    }
  }

  /**
   * Mark all notifications as read
   * @returns Promise<ApiResponse>
   */
  async markAllNotificationsAsRead(): Promise<ApiResponse> {
    try {
      const headers = await this.getAuthHeader();
      const response = await axios.patch(`${this.baseUrl}/read-all`, {}, { headers });
      return response.data;
    } catch (error) {
      this.handleError(error, 'Failed to mark all notifications as read');
      throw error;
    }
  }

  // === TOPIC MANAGEMENT ===

  /**
   * Create a new notification topic
   * @param topic Topic data
   * @returns Promise<TopicResponse>
   */
  async createTopic(topic: TopicCreate): Promise<TopicResponse> {
    try {
      const headers = await this.getAuthHeader();
      const response = await axios.post(`${this.baseUrl}/topics`, topic, { headers });
      return response.data;
    } catch (error) {
      this.handleError(error, 'Failed to create topic');
      throw error;
    }
  }

  /**
   * Get available notification topics
   * @returns Promise<TopicResponse[]>
   */
  async getTopics(): Promise<TopicResponse[]> {
    try {
      const headers = await this.getAuthHeader();
      const response = await axios.get(`${this.baseUrl}/topics`, { headers });
      return response.data;
    } catch (error) {
      this.handleError(error, 'Failed to get topics');
      throw error;
    }
  }

  /**
   * Subscribe to a notification topic
   * @param topicName Name of the topic to subscribe to
   * @returns Promise<ApiResponse>
   */
  async subscribeToTopic(topicName: string): Promise<ApiResponse> {
    try {
      const headers = await this.getAuthHeader();
      const response = await axios.post(
        `${this.baseUrl}/topics/subscribe`,
        { name: topicName },
        { headers }
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'Failed to subscribe to topic');
      throw error;
    }
  }

  /**
   * Unsubscribe from a notification topic
   * @param topicName Name of the topic to unsubscribe from
   * @returns Promise<ApiResponse>
   */
  async unsubscribeFromTopic(topicName: string): Promise<ApiResponse> {
    try {
      const headers = await this.getAuthHeader();
      const response = await axios.post(
        `${this.baseUrl}/topics/unsubscribe`,
        { name: topicName },
        { headers }
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'Failed to unsubscribe from topic');
      throw error;
    }
  }

  // === FCM TOKEN MANAGEMENT ===

  /**
   * Register FCM token for push notifications
   * @param token FCM token to register
   * @param deviceType Type of device (ios/android/web)
   * @returns Promise<ApiResponse>
   */
  async registerToken(token: string, deviceType: string): Promise<ApiResponse> {
    try {
      const headers = await this.getAuthHeader();
      const response = await axios.post(`${this.baseUrl}/fcm/register`, {
        token,
        device_type: deviceType,
      }, { headers });
      return response.data;
    } catch (error) {
      this.handleError(error, 'Failed to register FCM token');
      throw error;
    }
  }

  /**
   * Unregister FCM token
   * @param token FCM token to unregister
   * @returns Promise<ApiResponse>
   */
  async unregisterToken(token: string): Promise<ApiResponse> {
    try {
      const headers = await this.getAuthHeader();
      const response = await axios.delete(`${this.baseUrl}/fcm/unregister`, {
        headers,
        params: { token }
      });
      return response.data;
    } catch (error) {
      this.handleError(error, 'Failed to unregister FCM token');
      throw error;
    }
  }

  /**
   * Unregister all FCM tokens for the current user (useful for logout)
   * @returns Promise<ApiResponse>
   */
  async unregisterAllTokens(): Promise<ApiResponse> {
    try {
      const headers = await this.getAuthHeader();
      const response = await axios.delete(`${this.baseUrl}/fcm/unregister-all`, {
        headers
      });
      return response.data;
    } catch (error) {
      this.handleError(error, 'Failed to unregister all FCM tokens');
      throw error;
    }
  }

  // === USER SETTINGS ===

  /**
   * Get user's notification settings
   * @returns Promise<NotificationSettings>
   */
  async getNotificationSettings(): Promise<NotificationSettings> {
    try {
      const headers = await this.getAuthHeader();
      const response = await axios.get(`${this.baseUrl}/settings`, { headers });
      return response.data;
    } catch (error) {
      this.handleError(error, 'Failed to get notification settings');
      throw error;
    }
  }

  /**
   * Update user's notification settings
   * @param settings New notification settings
   * @returns Promise<ApiResponse>
   */
  async updateNotificationSettings(settings: Partial<NotificationSettings>): Promise<ApiResponse> {
    try {
      const headers = await this.getAuthHeader();
      const response = await axios.put(`${this.baseUrl}/settings`, settings, { headers });
      return response.data;
    } catch (error) {
      this.handleError(error, 'Failed to update notification settings');
      throw error;
    }
  }

  // === ADMIN ENDPOINTS ===

  /**
   * Send a broadcast notification to a topic
   * @param broadcast Broadcast message data
   * @param type Notification type
   * @param priority Notification priority
   * @returns Promise<ApiResponse>
   */
  async sendTopicBroadcast(
    broadcast: TopicBroadcastMessage,
    type: NotificationType = NotificationType.SYSTEM_ALERT,
    priority: NotificationPriority = NotificationPriority.MEDIUM
  ): Promise<ApiResponse> {
    try {
      const headers = await this.getAuthHeader();
      const response = await axios.post(
        `${this.baseUrl}/admin/topic-broadcast`,
        broadcast,
        { 
          headers,
          params: { type, priority }
        }
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'Failed to send topic broadcast');
      throw error;
    }
  }

  /**
   * Get information about scheduled jobs
   * @returns Promise<{ jobs: any[] }>
   */
  async getSchedulerJobs(): Promise<{ jobs: any[] }> {
    try {
      const headers = await this.getAuthHeader();
      const response = await axios.get(`${this.baseUrl}/admin/scheduler/jobs`, { headers });
      return response.data;
    } catch (error) {
      this.handleError(error, 'Failed to get scheduler jobs');
      throw error;
    }
  }
}

export const fcmService = new FCMService();