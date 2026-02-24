import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';

interface NetworkContextType {
  isConnected: boolean;
  isInternetReachable: boolean;
  showNoInternetAlert: () => void;
  showCachedDataMessage: () => void;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

export const useNetwork = () => {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error('useNetwork must be used within a NetworkProvider');
  }
  return context;
};

interface NetworkProviderProps {
  children: ReactNode;
}

export const NetworkProvider: React.FC<NetworkProviderProps> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(true);
  const [isInternetReachable, setIsInternetReachable] = useState(true);
  const { t } = useTranslation();

  const showNoInternetAlert = () => {
    Alert.alert(
      t('common.noInternetConnection'),
      t('common.noInternetMessage'),
      [
        {
          text: t('common.retry'),
          onPress: () => {
            // Check connection again
            NetInfo.fetch().then(state => {
              if (!state.isConnected || !state.isInternetReachable) {
                showNoInternetAlert();
              }
            });
          },
        },
        {
          text: t('common.ok'),
          style: 'cancel',
        },
      ],
      { cancelable: false }
    );
  };

  const showCachedDataMessage = () => {
    // This function is now deprecated - using combined message in showNoInternetAlert
    showNoInternetAlert();
  };

  useEffect(() => {
    // Initial check
    const checkConnection = async () => {
      const state = await NetInfo.fetch();
      setIsConnected(!!state.isConnected);
      setIsInternetReachable(!!state.isInternetReachable);
    };

    checkConnection();

    // Listen for network changes
    const unsubscribe = NetInfo.addEventListener(state => {
      const wasConnected = isConnected && isInternetReachable;
      const isNowConnected = !!(state.isConnected && state.isInternetReachable);
      
      setIsConnected(!!state.isConnected);
      setIsInternetReachable(!!state.isInternetReachable);

      // Show alert when connection is lost (only once)
      if (wasConnected && !isNowConnected) {
        showNoInternetAlert();
      }
    });

    return () => unsubscribe();
  }, [isConnected, isInternetReachable, t]);

  const value: NetworkContextType = {
    isConnected,
    isInternetReachable,
    showNoInternetAlert,
    showCachedDataMessage,
  };

  return (
    <NetworkContext.Provider value={value}>
      {children}
    </NetworkContext.Provider>
  );
}; 