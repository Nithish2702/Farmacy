# Enhanced State Management System

## Overview

The enhanced state management system provides robust caching, offline support, and improved error handling for the Farmacy React Native app. It maintains backward compatibility with existing UI components while adding powerful new features.

## Key Features

### 1. **Smart Caching with Offline Support**
- Automatic cache fallback when network is unavailable
- Language-specific caching
- Configurable cache duration
- Cache validation and corruption handling

### 2. **Enhanced Error Handling**
- Network error classification (network, auth, server, unknown)
- Automatic retry logic with exponential backoff
- Graceful degradation to cached data
- User-friendly error messages

### 3. **State Management**
- Centralized data state tracking
- Loading states, error states, and offline indicators
- Background sync when network is restored
- Operation locks to prevent race conditions

### 4. **Token Session Management**
- Automatic token refresh on 401 errors
- Session expiry handling
- Proper cleanup on logout
- Prevention of session expiry after logout

## Architecture

### Core Components

1. **`apiUtils.ts`** - Enhanced API utilities with error classification and retry logic
2. **`cacheManager.ts`** - Advanced caching with metadata and validation
3. **`stateManager.ts`** - Centralized state management with callbacks
4. **`AuthContext.tsx`** - Enhanced authentication with state management integration

### Data Flow

```
UI Component → State Manager → API Utils → Cache Manager → AsyncStorage
     ↑              ↓              ↓           ↓
   State ←── Callbacks ←── Network ←── Cache ←── Storage
```

## Usage Examples

### Basic Data Fetching

```typescript
// Using the enhanced crop service
const crops = await cropService.getAllCrops();
```

### With Offline Support

```typescript
// Automatically falls back to cache if network fails
const crops = await cropService.getCropsWithOfflineSupport();
```

### Manual Cache Management

```typescript
// Clear specific cache
await cropService.clearCropCache(cropId, language);

// Clear all cache
await cropService.clearAllCache();

// Check if data is stale
const isStale = cropService.isDataStale('crops', 60 * 60 * 1000);
```

### State Management in Components

```typescript
import { useAuth } from '@/context/AuthContext';

const MyComponent = () => {
  const { userDataState, isOnline, refreshUserData } = useAuth();
  
  // Access state information
  const { data, isLoading, error, isOffline, source } = userDataState;
  
  // Refresh data
  const handleRefresh = () => {
    refreshUserData();
  };
  
  return (
    <View>
      {isLoading && <LoadingSpinner />}
      {error && <ErrorMessage message={error} />}
      {isOffline && <OfflineIndicator />}
      {data && <DataDisplay data={data} source={source} />}
    </View>
  );
};
```

## API Service Integration

### Existing Services (Backward Compatible)

All existing services maintain their original function signatures:

```typescript
// Original function signatures preserved
const crops = await cropService.getAllCrops();
const weeks = await cropService.getCropWeeks(cropId);
const stages = await cropService.getCropStages(cropId);
```

### Enhanced Features Added

- **Automatic caching** - All API calls are automatically cached
- **Offline support** - Falls back to cache when network is unavailable
- **Error handling** - Better error classification and user feedback
- **State tracking** - Loading states and data source tracking

## Cache Configuration

### Cache Keys

```typescript
const CACHE_KEYS = {
  CROPS: 'api_cached_crops',
  TRACKINGS: 'api_cached_trackings',
  CURRENT_TRACKING: 'api_cached_current_tracking',
  WEEKS: 'api_cached_weeks',
  DAILY_UPDATE: 'api_cached_daily_update',
  LAST_SYNC: 'api_last_sync',
  HANDHOLD_CROPS: 'api_cached_handhold_crops',
  WEATHER: 'api_cached_weather',
  USER_DATA: 'api_cached_user_data',
  NOTIFICATIONS: 'api_cached_notifications'
};
```

### Cache Duration

- **Default**: 1 hour (60 * 60 * 1000 ms)
- **Configurable**: Per API call or globally
- **Language-specific**: Separate cache for each language

## Error Handling

### Error Classification

```typescript
type ErrorType = 'network' | 'auth' | 'server' | 'unknown';

// Automatic classification based on:
// - Network errors: connection issues, timeouts
// - Auth errors: 401, 403 responses
// - Server errors: 5xx responses
// - Unknown: other errors
```

### Retry Logic

- **Network errors**: Retry with exponential backoff (1s, 2s, 4s)
- **Server errors**: Retry with longer delays (2s, 4s, 8s)
- **Auth errors**: No retry, trigger session expiry
- **Max retries**: Configurable (default: 2)

## Network Status Monitoring

### Automatic Detection

```typescript
// Network status is automatically monitored
const { isOnline } = useAuth();

// Listen for network changes
useEffect(() => {
  const unsubscribe = addNetworkListener((isOnline) => {
    console.log('Network status changed:', isOnline);
  });
  
  return unsubscribe;
}, []);
```

### Background Sync

When network is restored:
1. Automatic background sync of critical data
2. User notification of sync completion
3. Cache invalidation for stale data

## Token Session Management

### Automatic Refresh

```typescript
// Tokens are automatically refreshed on 401 errors
// No manual intervention required
```

### Session Expiry

```typescript
// Automatic session expiry handling
// User is logged out and redirected to login
```

### Logout Cleanup

```typescript
// Complete cleanup on logout:
// - Clear all tokens
// - Clear all cache
// - Cancel ongoing requests
// - Reset state
```

## Best Practices

### 1. **Use Existing Function Signatures**
```typescript
// ✅ Correct - Use existing signatures
const crops = await cropService.getAllCrops();
const weeks = await cropService.getCropWeeks(cropId);

// ❌ Avoid - Don't change existing function calls
const crops = await cropService.getAllCrops('en'); // Wrong signature
```

### 2. **Handle Loading States**
```typescript
const { userDataState } = useAuth();
const { isLoading, error, data } = userDataState;

if (isLoading) return <LoadingSpinner />;
if (error) return <ErrorMessage error={error} />;
if (!data) return <EmptyState />;
```

### 3. **Check Network Status**
```typescript
const { isOnline } = useAuth();

if (!isOnline) {
  return <OfflineMessage />;
}
```

### 4. **Refresh Data When Needed**
```typescript
const { refreshUserData } = useAuth();

const handleRefresh = () => {
  refreshUserData();
};
```

### 5. **Clear Cache Appropriately**
```typescript
// Clear cache when language changes
await cropService.clearAllCache(oldLanguage);

// Clear specific cache when data changes
await cropService.clearCropCache(cropId);
```

## Migration Guide

### For Existing Components

1. **No changes required** - All existing function calls work as before
2. **Enhanced features** - Automatically get caching and offline support
3. **Optional improvements** - Can add state management features gradually

### For New Components

1. **Use state management** - Access loading states and error handling
2. **Handle offline mode** - Check network status and show appropriate UI
3. **Implement refresh** - Provide manual refresh capabilities

## Troubleshooting

### Common Issues

1. **Cache not updating**
   - Check if `forceRefresh` parameter is set to `true`
   - Verify cache keys are correct
   - Clear cache manually if needed

2. **Network errors persist**
   - Check network connectivity
   - Verify API endpoints are correct
   - Check authentication tokens

3. **Session expiry loops**
   - Ensure logout cleanup is complete
   - Check token refresh logic
   - Verify session expiry handlers

### Debug Information

```typescript
// Enable debug logging
console.log('[STATE MANAGER] Debug info:', stateManager.getCacheStats());

// Check cache status
const stats = await cacheManager.getCacheStats();
console.log('Cache stats:', stats);
```

## Performance Considerations

### Cache Size Management

- Cache is automatically cleaned on app restart
- Language-specific caching reduces memory usage
- Configurable cache duration prevents excessive storage

### Network Optimization

- Automatic retry with exponential backoff
- Request cancellation on logout
- Background sync only when necessary

### Memory Management

- Automatic cleanup of expired cache entries
- Operation locks prevent memory leaks
- Proper cleanup on component unmount

## Future Enhancements

1. **Background Sync** - Periodic data refresh in background
2. **Delta Updates** - Only sync changed data
3. **Compression** - Compress cached data to save storage
4. **Analytics** - Track cache hit rates and performance metrics
5. **Advanced Offline** - Queue operations for when network returns

## Support

For issues or questions about the enhanced state management system:

1. Check this documentation
2. Review the console logs for debug information
3. Verify network connectivity and API endpoints
4. Test with different network conditions
5. Check cache statistics and state information 