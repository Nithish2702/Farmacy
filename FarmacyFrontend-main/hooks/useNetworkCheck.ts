import { useNetwork } from '@/context/NetworkContext';
import { useCallback } from 'react';

export const useNetworkCheck = () => {
  const { isConnected, isInternetReachable, showNoInternetAlert } = useNetwork();

  const checkConnectionBeforeApiCall = useCallback(async (
    apiCall: () => Promise<any>,
    showCachedMessage: boolean = false // Changed default to false since we have combined popup
  ) => {
    if (!isConnected || !isInternetReachable) {
      showNoInternetAlert();
      // Don't show separate cached message since it's now combined in the main popup
      return null;
    }

    try {
      return await apiCall();
    } catch (error) {
      // If API call fails, it might be due to network issues
      if (showCachedMessage) {
        showNoInternetAlert(); // Use the combined popup instead
      }
      throw error;
    }
  }, [isConnected, isInternetReachable, showNoInternetAlert]);

  const isOnline = isConnected && isInternetReachable;

  return {
    isOnline,
    checkConnectionBeforeApiCall,
    showNoInternetAlert,
  };
}; 