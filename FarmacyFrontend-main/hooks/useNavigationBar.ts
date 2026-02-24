import { Platform } from 'react-native';

// Safe import with fallback
let NavigationBar: any = null;

try {
  NavigationBar = require('expo-navigation-bar');
  console.log('NavigationBar: expo-navigation-bar module loaded successfully');
} catch (error) {
  console.error('NavigationBar: expo-navigation-bar not available:', error);
}

export const useNavigationBar = () => {
  console.log('NavigationBar: Hook initialized - Platform:', Platform.OS, 'NavigationBar available:', !!NavigationBar);

  const setTransparentBar = async () => {
    if (Platform.OS !== 'android' || !NavigationBar) {
      console.log('NavigationBar: setTransparentBar - Not Android platform or NavigationBar not available');
      return;
    }

    try {
      console.log('NavigationBar: Setting navigation bar to near-transparent');
      
      // Use rgba(0,0,0,0.1) which works on most devices that block full transparency
      await NavigationBar.setBackgroundColorAsync('rgba(0,0,0,0.1)');
      await NavigationBar.setPositionAsync('absolute');
      
      console.log('NavigationBar: Near-transparent navigation bar set successfully');
      
    } catch (error) {
      console.error('NavigationBar: Failed to set transparent navigation bar:', error);
    }
  };

  const updateTheme = async (isDark: boolean) => {
    if (!NavigationBar || Platform.OS !== 'android') {
      console.log('NavigationBar: updateTheme - Not available or not Android platform');
      return;
    }

    try {
      console.log('NavigationBar: Updating theme with isDark:', isDark);
      const buttonStyle = isDark ? 'light' : 'dark';
      
      await Promise.all([
        NavigationBar.setBackgroundColorAsync('rgba(0,0,0,0.1)'), // Near-transparent
        NavigationBar.setButtonStyleAsync(buttonStyle),
        NavigationBar.setPositionAsync('absolute'),
        NavigationBar.setVisibilityAsync('visible'),
      ]);
      
      console.log('NavigationBar: Theme updated successfully');
    } catch (error) {
      console.error('NavigationBar: Failed to update theme:', error);
    }
  };

  const detectAndApplyBestMethod = async () => {
    if (Platform.OS !== 'android' || !NavigationBar) {
      console.log('NavigationBar: detectAndApplyBestMethod - Not Android platform or NavigationBar not available');
      return 'failed';
    }

    try {
      console.log('NavigationBar: Applying near-transparent method');
      await NavigationBar.setBackgroundColorAsync('rgba(0,0,0,0.1)');
      await NavigationBar.setPositionAsync('absolute');
      console.log('NavigationBar: Near-transparent method successful');
      return 'success';
    } catch (error) {
      console.error('NavigationBar: Near-transparent method failed:', error);
      return 'failed';
    }
  };

  const detectNavigationType = async () => {
    if (!NavigationBar || Platform.OS !== 'android') {
      console.log('NavigationBar: detectNavigationType - Not available or not Android platform');
      return 'unknown';
    }

    try {
      console.log('NavigationBar: Detecting navigation type');
      
      if (NavigationBar.getVisibilityAsync) {
        const visibility = await NavigationBar.getVisibilityAsync();
        console.log('NavigationBar: Current visibility:', visibility);
        return visibility === 'hidden' ? 'gesture' : 'button';
      }
      
      return 'unknown';
    } catch (error) {
      console.log('NavigationBar: Could not detect navigation type:', error);
      return 'unknown';
    }
  };

  return {
    setTransparentBar,
    updateTheme,
    detectAndApplyBestMethod,
    detectNavigationType,
    isAvailable: !!NavigationBar,
  };
}; 
