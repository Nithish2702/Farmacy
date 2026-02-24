import React, { createContext, useContext, ReactNode } from 'react';
import { useCrops } from '@/hooks/useCrops';

// Create the context
const CropsContext = createContext<ReturnType<typeof useCrops> | undefined>(undefined);

// Provider component
interface CropsProviderProps {
  children: ReactNode;
}

export const CropsProvider: React.FC<CropsProviderProps> = ({ children }) => {
  const cropsData = useCrops();

  return (
    <CropsContext.Provider value={cropsData}>
      {children}
    </CropsContext.Provider>
  );
};

// Hook to use the context
export const useCropsContext = () => {
  const context = useContext(CropsContext);
  if (context === undefined) {
    throw new Error('useCropsContext must be used within a CropsProvider');
  }
  return context;
};