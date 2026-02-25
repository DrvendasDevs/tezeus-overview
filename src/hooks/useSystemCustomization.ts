import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCache } from './useCache';
import { useRetry } from './useRetry';

interface SystemCustomization {
  id?: string;
  logo_url?: string;
  favicon_url?: string;
  background_color: string;
  primary_color: string;
  header_color: string;
  sidebar_color: string;
  created_at?: string;
  updated_at?: string;
}

const defaultCustomization: SystemCustomization = {
  logo_url: '',
  favicon_url: '',
  background_color: '#f5f5f5',
  primary_color: '#eab308',
  header_color: '#ffffff',
  sidebar_color: '#fafafa'
};

export function useSystemCustomization() {
  const [customization, setCustomization] = useState<SystemCustomization>(defaultCustomization);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { getCache, setCache, isExpired } = useCache<SystemCustomization>(10); // 10 min cache
  const { retry } = useRetry();
  const hasFetched = useRef(false);

  // Convert hex to HSL for CSS variables with validation
  const hexToHsl = (hex: string): string => {
    try {
      // Ensure hex is valid format
      if (!hex || !hex.startsWith('#') || hex.length !== 7) {
        console.warn('⚠️ Invalid hex color format:', hex);
        return '0 0% 50%'; // Return neutral gray as fallback
      }

      const r = parseInt(hex.slice(1, 3), 16) / 255;
      const g = parseInt(hex.slice(3, 5), 16) / 255;
      const b = parseInt(hex.slice(5, 7), 16) / 255;
      
      // Validate RGB values
      if (isNaN(r) || isNaN(g) || isNaN(b)) {
        console.warn('⚠️ Invalid RGB values from hex:', hex);
        return '0 0% 50%';
      }
      
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      let h, s, l = (max + min) / 2;
      
      if (max === min) {
        h = s = 0; // achromatic (gray)
      } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
          case r: h = (g - b) / d + (g < b ? 6 : 0); break;
          case g: h = (b - r) / d + 2; break;
          case b: h = (r - g) / d + 4; break;
          default: h = 0;
        }
        h /= 6;
      }
      
      // Ensure no NaN values
      const hue = isNaN(h) ? 0 : Math.round(h * 360);
      const saturation = isNaN(s) ? 0 : Math.round(s * 100);
      const lightness = isNaN(l) ? 50 : Math.round(l * 100);
      
      return `${hue} ${saturation}% ${lightness}%`;
    } catch (error) {
      console.error('❌ Error converting hex to HSL:', error);
      return '0 0% 50%'; // Safe fallback
    }
  };

  // Apply customization to CSS variables
  const applyCustomization = (config: SystemCustomization) => {
    const root = document.documentElement;
    
    // Function to process color values - handle both hex and HSL formats
    const processColor = (colorValue: string): string => {
      if (!colorValue) return '0 0% 50%';
      
      // If already in HSL format like "hsl(240, 10%, 3.9%)", extract the values
      const hslMatch = colorValue.match(/hsl\(([^)]+)\)/);
      if (hslMatch) {
        const values = hslMatch[1].split(',').map(v => v.trim());
        if (values.length === 3) {
          return `${values[0]} ${values[1]} ${values[2]}`;
        }
      }
      
      // If hex format, convert to HSL
      if (colorValue.startsWith('#')) {
        return hexToHsl(colorValue);
      }
      
      // Return as-is for other formats
      return colorValue;
    };
    
    // Process and apply colors
    const backgroundHsl = processColor(config.background_color);
    const primaryHsl = processColor(config.primary_color);
    const headerHsl = processColor(config.header_color);
    const sidebarHsl = processColor(config.sidebar_color);
    
    // Apply colors as CSS custom properties in correct HSL format
    root.style.setProperty('--background', backgroundHsl);
    root.style.setProperty('--primary', primaryHsl);
    root.style.setProperty('--card', headerHsl);
    root.style.setProperty('--popover', headerHsl);
    root.style.setProperty('--sidebar-background', sidebarHsl);
    root.style.setProperty('--sidebar', sidebarHsl);
  };

  // Load customization settings
  const loadCustomization = async () => {
    // Check cache first
    const cached = getCache();
    if (cached && !isExpired()) {
      console.log('✅ Usando customização em cache');
      setCustomization(cached);
      applyCustomization(cached);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Apply defaults first to avoid black colors during loading
      setCustomization(defaultCustomization);
      applyCustomization(defaultCustomization);

      const data = await retry(async () => {
        const { data, error } = await supabase.functions.invoke('get-system-customization');
        if (error) throw error;
        return data;
      });

      if (data) {
        const config = { ...defaultCustomization, ...data };
        setCustomization(config);
        setCache(config);
        applyCustomization(config);
      } else {
        setCache(defaultCustomization);
      }
    } catch (err: any) {
      console.error('❌ Error in loadCustomization:', err);
      setError(err.message);
      
      // Use expired cache if available
      const cached = getCache();
      if (cached) {
        console.log('⚠️ Usando cache expirado devido ao erro');
        setCustomization(cached);
        applyCustomization(cached);
      } else {
        setCustomization(defaultCustomization);
        applyCustomization(defaultCustomization);
      }
    } finally {
      setLoading(false);
    }
  };

  // Update customization (master only)
  const updateCustomization = async (updates: Partial<SystemCustomization>) => {
    try {
      setLoading(true);
      setError(null);

      // Get user context
      const userData = localStorage.getItem('currentUser');
      const currentUserData = userData ? JSON.parse(userData) : null;

      if (!currentUserData?.id) {
        throw new Error('User not authenticated');
      }

      const headers = {
        'x-system-user-id': currentUserData.id,
        'x-system-user-email': currentUserData.email || ''
      };

      const newConfig = { ...customization, ...updates };

      const { data, error } = await supabase.functions.invoke('update-system-customization', {
        body: newConfig,
        headers
      });

      if (error) {
        console.error('❌ Error updating system customization:', error);
        throw error;
      }

      if (data) {
        setCustomization(data);
        applyCustomization(data);
      }

      return data;
    } catch (err: any) {
      console.error('❌ Error in updateCustomization:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Reset to defaults
  const resetToDefaults = async () => {
    try {
      await updateCustomization({
        logo_url: '',
        favicon_url: '',
        background_color: defaultCustomization.background_color,
        primary_color: defaultCustomization.primary_color,
        header_color: defaultCustomization.header_color,
        sidebar_color: defaultCustomization.sidebar_color
      });
    } catch (err) {
      console.error('❌ Error resetting to defaults:', err);
      throw err;
    }
  };

  // Load on mount
  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    loadCustomization();
  }, []);

  return {
    customization,
    loading,
    error,
    updateCustomization,
    resetToDefaults,
    loadCustomization
  };
}