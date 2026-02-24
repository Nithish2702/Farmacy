# Network Connectivity Guide

This guide explains how to use the network connectivity features implemented in Farmacy.

## Features Implemented

### 1. Global Network Monitoring
- **NetworkContext**: Monitors internet connectivity across the entire app
- **NetworkStatus Component**: Shows a banner when offline
- **Single Comprehensive Popup**: Displays combined internet connectivity and cached data information

### 2. Cached Data Management
- **Local Storage**: Automatically caches API responses
- **Offline Support**: Shows cached data when offline
- **Cache Expiration**: 24-hour cache validity

### 3. Smart API Calls
- **Network Checks**: Validates connectivity before API calls
- **Fallback Strategy**: Uses cached data when API fails
- **User Feedback**: Clear messages about offline mode

## How to Use

### 1. Basic Network Status Check

```typescript
import { useNetwork } from '@/context/NetworkContext';

function MyComponent() {
  const { isConnected, isInternetReachable, showNoInternetAlert } = useNetwork();

  const handleApiCall = async () => {
    if (!isConnected || !isInternetReachable) {
      showNoInternetAlert();
      return;
    }
    
    // Proceed with API call
    try {
      const data = await apiCall();
      // Handle success
    } catch (error) {
      // Handle error
    }
  };

  return (
    <View>
      {!isConnected && <Text>You are offline</Text>}
      {/* Your component content */}
    </View>
  );
}
```

### 2. Using Network Check Hook

```typescript
import { useNetworkCheck } from '@/hooks/useNetworkCheck';

function MyComponent() {
  const { isOnline, checkConnectionBeforeApiCall } = useNetworkCheck();

  const fetchData = async () => {
    const result = await checkConnectionBeforeApiCall(
      () => apiService.getData(),
      false // Don't show separate cached message (now combined)
    );
    
    if (result) {
      // Handle successful API call
      setData(result);
    } else {
      // No internet connection
      console.log('No internet connection');
    }
  };

  return (
    <View>
      <Text>Online: {isOnline ? 'Yes' : 'No'}</Text>
      <Button title="Fetch Data" onPress={fetchData} />
    </View>
  );
}
```

### 3. Using Enhanced Crop Service

```typescript
import { useCropServiceWithNetwork } from '@/api/cropServiceWithNetwork';

function CropsScreen() {
  const { 
    isOnline, 
    getAllCrops, 
    getCropWeeks, 
    clearCache 
  } = useCropServiceWithNetwork();

  const [crops, setCrops] = useState([]);

  const loadCrops = async () => {
    try {
      const cropsData = await getAllCrops();
      if (cropsData) {
        setCrops(cropsData);
      }
    } catch (error) {
      console.log('Error loading crops:', error);
    }
  };

  return (
    <View>
      <Text>Network Status: {isOnline ? 'Online' : 'Offline'}</Text>
      <Button title="Load Crops" onPress={loadCrops} />
      <Button title="Clear Cache" onPress={clearCache} />
      {/* Display crops */}
    </View>
  );
}
```

## Network Status Banner

The app automatically shows a network status banner at the top of the screen when:
- No internet connection is detected
- Limited connectivity is detected
- App is in offline mode

The banner displays different messages:
- "📱 Offline Mode - Showing Cached Data"
- "📡 Limited Connectivity - Using Cached Data"

## Single Comprehensive Popup

### No Internet Alert
Shows when trying to make API calls without internet:
- **Title**: "No Internet Connection"
- **Message**: "You are currently offline. The app will show cached data from your previous sessions. Please connect to the internet for the latest information."
- **Options**: 
  - "Retry" - Checks connection again
  - "Continue Offline" - Proceeds with cached data

This single popup combines both the internet connectivity information and cached data explanation, eliminating the need for multiple popups.

## Cache Management

### Automatic Caching
- All API responses are automatically cached
- Cache expires after 24 hours
- Cache is used when offline or when API calls fail

### Manual Cache Control
```typescript
import { cropServiceWithNetwork } from '@/api/cropServiceWithNetwork';

// Clear all cached crop data
await cropServiceWithNetwork.clearCache();
```

## Testing Network Features

### 1. Turn Off Internet
- Disable WiFi and mobile data
- Launch the app
- Try to make API calls
- Observe single comprehensive popup and cached data banner

### 2. Test Network Recovery
- Start with no internet
- Make API calls (should show cached data)
- Turn on internet
- Make API calls again (should fetch fresh data)

### 3. Test Cache Expiration
- Use the app normally to cache data
- Wait 24+ hours or manually clear cache
- Turn off internet and try to access data
- Should show "no cached data available" message

## Console Logs

The system provides detailed console logs for debugging:

- 🔍 Checking internet connection...
- 📡 Network state: { isConnected: true/false, isInternetReachable: true/false, type: "wifi"/"cellular" }
- ✅ Internet connection confirmed
- ❌ No internet connection detected
- 🔄 Retrying internet connection check...
- 📱 Continuing in offline mode
- 📦 Using cached data for: [cache_key]
- 💾 Cached data for: [cache_key]
- 🗑️ Cleared all cached crop data

## Best Practices

1. **Always check network status** before making API calls
2. **Provide fallback UI** for offline scenarios
3. **Use the enhanced services** for automatic caching
4. **Handle cache misses** gracefully
5. **Test offline functionality** regularly

## Integration with Existing Code

To integrate with existing API calls:

1. Replace direct API calls with network-checked versions
2. Use the `useNetworkCheck` hook for custom API calls
3. Import enhanced services instead of basic ones
4. Add offline state handling in components

Example migration:
```typescript
// Before
import { cropService } from '@/api/cropService';
const crops = await cropService.getAllCrops();

// After
import { useCropServiceWithNetwork } from '@/api/cropServiceWithNetwork';
const { getAllCrops } = useCropServiceWithNetwork();
const crops = await getAllCrops();
```

## User Experience Improvements

### Before (Two Popups)
1. "No Internet Connection" popup
2. "Offline Mode - Showing cached data" popup (separate)

### After (Single Popup)
1. "No Internet Connection" popup with combined message explaining both connectivity and cached data
2. Retry button for easy connection testing
3. Continue Offline option for seamless experience

This provides a cleaner, less intrusive user experience while still providing all necessary information. 