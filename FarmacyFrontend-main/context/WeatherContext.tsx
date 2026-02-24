import React, { createContext, useContext, ReactNode } from 'react';
import { useWeather } from '@/hooks/useWeather';

// Create the context
const WeatherContext = createContext<ReturnType<typeof useWeather> | undefined>(undefined);

// Provider component
interface WeatherProviderProps {
  children: ReactNode;
}

export const WeatherProvider: React.FC<WeatherProviderProps> = ({ children }) => {
  const weatherData = useWeather();

  return (
    <WeatherContext.Provider value={weatherData}>
      {children}
    </WeatherContext.Provider>
  );
};

// Hook to use the context
export const useWeatherContext = () => {
  const context = useContext(WeatherContext);
  if (context === undefined) {
    throw new Error('useWeatherContext must be used within a WeatherProvider');
  }
  return context;
}; 