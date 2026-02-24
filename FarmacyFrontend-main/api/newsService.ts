import axios from 'axios';
import { API_BASE_URL } from '../config';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface NewsArticle {
  id: number;
  author: string | null;
  title: string;
  description: string | null;
  url: string;
  source: string | null;
  image_urls: string[] | null;
  category: string | null;
  language: string | null;
  country: string | null;
  published_at: string;
  created_at: string;
  updated_at: string;
}

class NewsService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = `${API_BASE_URL}/news`;
  }

  private async getAuthHeader() {
    const token = await AsyncStorage.getItem('access_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  /**
   * Fetch all news articles
   * @returns Promise<NewsArticle[]>
   */
  async getAllNews(): Promise<NewsArticle[]> {
    try {
      const headers = await this.getAuthHeader();
      const response = await axios.get<NewsArticle[]>(this.baseUrl + "/get_news", { headers });
      return response.data;
    } catch (error) {
      console.error('Error fetching news:', error);
      throw error;
    }
  }

  /**
   * Sync news from external API
   * @param language Language code (e.g., en, te, hi)
   * @param country Optional country code (e.g., us, in)
   * @param maxArticles Optional number of articles to fetch (1-100)
   * @returns Promise<{ message: string }>
   */
  async syncNews(language: string, country?: string, maxArticles: number = 10): Promise<{ message: string }> {
    try {
      const headers = await this.getAuthHeader();
      const response = await axios.post<{ message: string }>(
        `${this.baseUrl}/sync`,
        {},
        {
          headers,
          params: {
            language,
            country,
            max_articles: maxArticles
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error syncing news:', error);
      throw error;
    }
  }

  /**
   * Get news articles with pagination
   * @param page Page number
   * @param limit Number of items per page
   * @param newsType Optional news category/type
   * @param language Optional language code
   * @param region Optional country/region
   * @returns Promise<{ data: NewsArticle[], total: number }>
   */
  async getNewsWithPagination(
    page: number = 1,
    limit: number = 10,
    newsType?: string,
    language?: string,
    region?: string
  ): Promise<{ data: NewsArticle[], total: number }> {
    try {
      const headers = await this.getAuthHeader();
      const response = await axios.get<NewsArticle[]>(this.baseUrl + "/get_news", {
        headers,
        params: {
          skip: (page - 1) * limit,
          limit,
          news_type: newsType,
          language,
          region
        }
      });
      return {
        data: response.data,
        total: parseInt(response.headers['x-total-count'] || '0', 10)
      };
    } catch (error) {
      console.error('Error fetching paginated news:', error);
      throw error;
    }
  }

  /**
   * Get news articles by type/category
   * @param newsType Category/type to filter by
   * @returns Promise<NewsArticle[]>
   */
  async getNewsByType(newsType: string): Promise<NewsArticle[]> {
    try {
      const headers = await this.getAuthHeader();
      const response = await axios.get<NewsArticle[]>(this.baseUrl + "/get_news", {
        headers,
        params: { news_type: newsType }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching news by type:', error);
      throw error;
    }
  }

  /**
   * Get news articles by category
   * @param category Category to filter by
   * @returns Promise<NewsArticle[]>
   */
  async getNewsByCategory(category: string): Promise<NewsArticle[]> {
    try {
      const headers = await this.getAuthHeader();
      const response = await axios.get<NewsArticle[]>(this.baseUrl + "/get_news", {
        headers,
        params: { category }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching news by category:', error);
      throw error;
    }
  }

  /**
   * Get a single news article by ID
   * @param id News article ID
   * @returns Promise<NewsArticle>
   */
  async getNewsById(id: number): Promise<NewsArticle> {
    try {
      const headers = await this.getAuthHeader();
      const response = await axios.get<NewsArticle>(`${this.baseUrl}/get_news/${id}`, { headers });
      return response.data;
    } catch (error) {
      console.error('Error fetching news by ID:', error);
      throw error;
    }
  }
}

export const newsService = new NewsService();