import axios from 'axios';
import { API_BASE_URL } from '@/config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '@/i18n.config';

export interface ChatMessage {
  id: number;
  type: 'user' | 'assistant';
  message: string;
  timestamp?: string;
}

export interface ChatResponse {
  status: 'success' | 'error';
  response: string;
  language: string;
}

class ChatbotService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = `${API_BASE_URL}/user`;
  }

  private async getLanguage(): Promise<string> {
    try {
      // Get from multiple sources to ensure consistency
      const storedLang = await AsyncStorage.getItem('language');
      const i18nLang = i18n.language;
      
      console.log('🌐 ChatbotService: Language sources - AsyncStorage:', storedLang, 'i18n:', i18nLang);
      
      // Force validation and fallback for language
      let finalLang = storedLang || i18nLang || 'en';
      
      if (!['en', 'hi', 'te'].includes(finalLang)) {
        console.warn('🌐 ChatbotService: Invalid language detected:', finalLang, 'defaulting to English');
        finalLang = 'en';
        
        // Store the corrected language
        await AsyncStorage.setItem('language', finalLang);
        await i18n.changeLanguage(finalLang);
      }
      
      // If there's a mismatch between sources, synchronize them
      if (storedLang !== i18nLang && storedLang && i18nLang) {
        console.warn('🌐 ChatbotService: Language mismatch detected - AsyncStorage:', storedLang, 'i18n:', i18nLang);
        // Prefer AsyncStorage value and update i18n
        await i18n.changeLanguage(finalLang);
      }
      
      console.log('🌐 ChatbotService: Final language chosen:', finalLang);
      return finalLang;
    } catch (error) {
      console.error('Error getting language:', error);
      return 'en';
    }
  }

  async sendMessage(message: string, explicitLanguage?: string): Promise<ChatResponse> {
    try {
      // Use the explicit language if provided, otherwise get from storage
      const language = explicitLanguage || await this.getLanguage();
      console.log('🌐 ChatbotService: Sending message with language:', language);
      
      // Double check language validity one more time
      if (!['en', 'hi', 'te'].includes(language)) {
        console.warn('🌐 ChatbotService: Invalid language detected in sendMessage:', language);
        
        // Force update the language storage and i18n
        const correctLang = 'en'; // Default to English if invalid
        await AsyncStorage.setItem('language', correctLang);
        await i18n.changeLanguage(correctLang);
        
        // Use the corrected language
        console.log('🌐 ChatbotService: Corrected language to:', correctLang);
      }
      
      const formData = new FormData();
      formData.append('message', message);
      formData.append('language', language);

      console.log('🌐 ChatbotService: Form data language:', formData.get('language'));

      // Store the current language value to ensure consistency
      if (!explicitLanguage) {
        await AsyncStorage.setItem('language', language);
        await i18n.changeLanguage(language);
      }

      const response = await axios.post(`${this.baseUrl}/chatbot`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      console.log('🌐 ChatbotService: Response received, language in response:', response.data.language);
      return response.data;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }
}

const chatbotService = new ChatbotService();
export default chatbotService; 