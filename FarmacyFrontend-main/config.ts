// API Configuration
// export const API_BASE_URL = 'http://192.168.1.36:5000';  // Updated to match running backend server
 export const API_BASE_URL = 'https://farmacycare.com';  // Updated to match running backend server

export const API_CONFIG = {
  baseURL: API_BASE_URL,
  timeout: 10000, 
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  maxContentLength: Infinity,
  maxBodyLength: Infinity,
};

export const KEYS = {
  fcmToken: "fcmToken",
}; 
