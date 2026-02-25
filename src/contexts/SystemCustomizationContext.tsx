import React, { createContext, useContext, useEffect } from 'react';
import { useSystemCustomization } from '@/hooks/useSystemCustomization';
// import { useFavicon } from '@/hooks/useFavicon';

interface SystemCustomizationContextType {
  customization: any;
  loading: boolean;
  error: string | null;
  updateCustomization: (updates: any) => Promise<any>;
  resetToDefaults: () => Promise<void>; 
  loadCustomization: () => Promise<void>;
}

const SystemCustomizationContext = createContext<SystemCustomizationContextType | undefined>(undefined);

export function SystemCustomizationProvider({ children }: { children: React.ReactNode }) {
  const customizationHook = useSystemCustomization();
  
  // Apply favicon from customization
  // useFavicon(customizationHook.customization.favicon_url);

  // Load customization on app start
  useEffect(() => {
    customizationHook.loadCustomization();
  }, []);

  return (
    <SystemCustomizationContext.Provider value={customizationHook}>
      {children}
    </SystemCustomizationContext.Provider>
  );
}

export function useSystemCustomizationContext() {
  const context = useContext(SystemCustomizationContext);
  if (context === undefined) {
    throw new Error('useSystemCustomizationContext must be used within a SystemCustomizationProvider');
  }
  return context;
}