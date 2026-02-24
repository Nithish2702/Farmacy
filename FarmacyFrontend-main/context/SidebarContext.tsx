import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';

interface SidebarContextType {
  isSidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
};

interface SidebarProviderProps {
  children: ReactNode;
}

export const SidebarProvider: React.FC<SidebarProviderProps> = ({ children }) => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  const setSidebarOpenWithLogging = (open: boolean) => {
    setSidebarOpen(open);
  };

  return (
    <SidebarContext.Provider value={{ isSidebarOpen, setSidebarOpen: setSidebarOpenWithLogging }}>
      {children}
    </SidebarContext.Provider>
  );
}; 