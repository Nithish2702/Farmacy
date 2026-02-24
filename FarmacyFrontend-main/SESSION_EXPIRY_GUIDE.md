# Session Expiry Handling Implementation

This document explains how session expiry is handled in the Farmacy frontend application.

## Overview

When API requests fail with unauthorized status (401), the system:

1. **First attempts to refresh the access token** using the stored refresh token
2. **If refresh token also fails** (expired/invalid), it triggers session expiry handling
3. **Shows "Session Expired" alert** to inform the user
4. **Clears all user data** from local storage
5. **Navigates to welcome page** for re-authentication

## Implementation Details

### 1. AuthService (`api/authService.ts`)

- **Axios Interceptor**: Automatically intercepts 401 responses
- **Token Refresh Logic**: Attempts to refresh expired access tokens
- **Session Expiry Callback**: Triggers when refresh fails

```typescript
// When 401 error occurs:
if (error.response?.status === 401) {
  try {
    // Try to refresh token
    const newTokens = await this.refreshAccessToken();
    // Retry original request with new token
    return axios(originalRequest);
  } catch (refreshError) {
    // If refresh fails, trigger session expiry
    this.onSessionExpired();
  }
}
```

### 2. AuthContext (`context/AuthContext.tsx`)

- **Session Expiry Handler**: Shows alert and handles cleanup
- **User State Management**: Clears authentication state
- **Navigation**: Redirects to welcome page

```typescript
const handleSessionExpiry = async () => {
  // Clear auth data
  await clearCache();
  await unregisterDevice();
  
  // Update state
  setIsAuthenticated(false);
  setUser(null);
  
  // Show alert and navigate
  Alert.alert('Session Expired', 'Your session has expired. Please log in again.');
};
```

### 3. Global API Utils (`api/apiUtils.ts`)

- **Global Handler**: Centralizes session expiry for all API services
- **Common Functions**: Provides shared auth headers and error handling
- **Axios Interceptor**: Global interceptor for non-auth endpoints

## Usage in Other API Services

Other API services can use the utilities for consistent error handling:

```typescript
import { handleApiError, getAuthHeaders } from './apiUtils';

class MyApiService {
  async someMethod() {
    try {
      const headers = await getAuthHeaders();
      const response = await axios.get('/api/endpoint', { headers });
      return response.data;
    } catch (error) {
      throw handleApiError(error); // Automatically handles 401 errors
    }
  }
}
```

## Flow Diagram

```
API Request (401) → Try Refresh Token → Success? → Retry Original Request
                                   ↓
                                  Fail
                                   ↓
                            Session Expiry Handler
                                   ↓
                          Clear User Data & State
                                   ↓
                          Show "Session Expired" Alert
                                   ↓
                           Navigate to Welcome Page
```

## Key Features

- **Automatic Token Refresh**: Seamless for users when tokens can be refreshed
- **Graceful Degradation**: Clear messaging when session truly expires
- **Data Cleanup**: Ensures no stale authentication data remains
- **Consistent UX**: Same behavior across all API endpoints
- **Prevention of Infinite Loops**: Proper handling of refresh endpoint failures
- **Single Session Expiry**: Prevents multiple simultaneous session expiry calls
- **Thread-Safe**: Uses flags to prevent race conditions in session handling

## Testing

To test session expiry:

1. **Simulate token expiry**: Manually expire tokens in AsyncStorage
2. **Make authenticated API call**: Any protected endpoint
3. **Verify behavior**: Should show session expired alert and redirect

## Error Scenarios Handled

- **Access token expired**: Attempts refresh, continues or expires session
- **Refresh token expired**: Immediately triggers session expiry
- **Network errors during refresh**: Triggers session expiry
- **Invalid tokens**: Clears tokens and triggers session expiry
- **Missing tokens**: Prompts for re-authentication 