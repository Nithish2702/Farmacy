import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar, Dimensions, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
  interpolate,
  Extrapolation,
  withRepeat,
  withSequence
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { RFValue } from 'react-native-responsive-fontsize';
import { useAuth } from '@/context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { heightPercentageToDP as hp, widthPercentageToDP as wp } from 'react-native-responsive-screen';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/context/theme';
import { CACHE_KEYS, cacheManager } from '@/api/cacheManager';

interface MenuItem {
  icon: string;
  label: string;
  route?: string;
  onPress?: () => void;
  color: string;
  disabled?: boolean;
}

interface SidebarProps {
  isSidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  colors: {
    card: string;
    background: string;
    text: string;
    primary: string;
    border: string;
    secondary: string;
  };
  width: number;
}

const SideBar: React.FC<SidebarProps> = ({
  isSidebarOpen,
  setSidebarOpen,
  colors,
  width,
}) => {
  const router = useRouter();
  const { user, isLoading, isAuthenticated} = useAuth();
  const { t } = useTranslation();
  const { mode } = useTheme();

  // Use proper safe area insets
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Platform.OS === 'android' ? 25 : 20);
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'android' ? 20 : 15);
  const leftInset = insets.left;
  const rightInset = insets.right;

  // Add initialization flag to prevent first-load jittering
  const [hasInitialized, setHasInitialized] = useState(false);



  const sidebarWidth = width * 0.75; // Slightly reduced width for better performance

  // Simplified animation values - ensure stable initial state
  const translateX = useSharedValue(-sidebarWidth);
  const backdropOpacity = useSharedValue(0);
  const settingsIconRotation = useSharedValue(0);
  const iconScale = useSharedValue(1);



  const menuItems: MenuItem[] = [
    {
      icon: 'hand-right-outline',
      label: t('dashboard.sidebar.cropHandholding'),
      route: '/sidebar/crophandholdselection',
      color: colors.text
    },
    {
      icon: 'partly-sunny-outline',
      label: t('dashboard.sidebar.weatherAlerts'),
      route: '/(tabs)/weather',
      color: colors.text
    },
    {
      icon: 'book-outline',
      label: t('dashboard.sidebar.cropGuide'),
      route: '/(tabs)/learn',
      color: colors.text
    },
    {
      icon: 'time-outline',
      label: t('dashboard.sidebar.predictionHistory'),
      route: '/history',
      color: colors.text
    },
    {
      icon: 'notifications-outline',
      label: t('dashboard.notifications.title'),
      route: '/sidebar/notifications',
      color: colors.text
    },
    {
      icon: 'newspaper-outline',
      label: t('dashboard.sidebar.agriculturalNews'),
      route: '/(tabs)/news',
      color: colors.text
    },
    {
      icon: 'settings-outline',
      label: t('dashboard.sidebar.settings'),
      route: '/settings',
      color: colors.text
    },
  ];

  // Prevent jittering on first load by ensuring stable initial state
  useEffect(() => {
    // Initialize after a brief delay to ensure layout is stable
    const initTimer = setTimeout(() => {
      setHasInitialized(true);
    }, 50);
    
    return () => clearTimeout(initTimer);
  }, []);

  useEffect(() => {
    // Only animate if we've initialized and state actually changes
    if (!hasInitialized) return;
    

    
    if (isSidebarOpen) {
      // Immediate show with optimized spring animation
      translateX.value = withSpring(0, {
        damping: 30,
        stiffness: 100,
        mass: 1,
        overshootClamping: true,
        restDisplacementThreshold: 0.01,
        restSpeedThreshold: 0.01,
      });
      backdropOpacity.value = withTiming(0.3, { duration: 300 });
      
      // Subtle settings rotation
      settingsIconRotation.value = withRepeat(
        withTiming(360, { duration: 6000 }),
        -1,
        false
      );
    } else {
      // Enhanced close animation
      translateX.value = withSpring(-sidebarWidth, {
        damping: 35,
        stiffness: 120,
        mass: 0.9,
        overshootClamping: true,
        restDisplacementThreshold: 0.01,
        restSpeedThreshold: 0.01,
      });
      backdropOpacity.value = withTiming(0, { duration: 250 });
      settingsIconRotation.value = 0;
    }
  }, [isSidebarOpen, sidebarWidth, hasInitialized]);

  // Close sidebar function
  const closeSidebar = () => {
    setSidebarOpen(false);
  };
    
  // Tap gesture for backdrop close
  const tapGesture = Gesture.Tap()
    .onEnd(() => {
      'worklet';
      runOnJS(closeSidebar)();
    });

  // Optimized pan gesture with better thresholds
  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      'worklet';

      // Calculate the new position based on gesture
      let newTranslateX = event.translationX;

      if (isSidebarOpen) {
        // Sidebar is open, allow dragging left to close
        newTranslateX = Math.max(-sidebarWidth, Math.min(0, newTranslateX));
      } else {
        // Sidebar is closed, allow dragging right to open
        newTranslateX = Math.max(-sidebarWidth, Math.min(0, -sidebarWidth + newTranslateX));
      }

      // Update position with interpolation for smoother movement
      translateX.value = newTranslateX;

      // Smooth backdrop opacity interpolation
      backdropOpacity.value = interpolate(
        newTranslateX,
        [-sidebarWidth, 0],
        [0, 0.3],
        Extrapolation.CLAMP
      );
    })
    .onEnd((event) => {
      'worklet';

        const velocity = event.velocityX;
      const currentPosition = translateX.value;
      const threshold = sidebarWidth * 0.4; // Reduced threshold for better responsiveness

      // Determine if we should open or close
      let shouldOpen = false;

      if (velocity > 800) {
        // Fast swipe right - open
        shouldOpen = true;
      } else if (velocity < -800) {
        // Fast swipe left - close
        shouldOpen = false;
      } else {
        // Based on position
        shouldOpen = currentPosition > -threshold;
      }

      if (shouldOpen) {
        // Open sidebar with optimized spring
        translateX.value = withSpring(0, {
            damping: 30,
          stiffness: 100,
          mass: 1,
            overshootClamping: true,
          restDisplacementThreshold: 0.01,
          restSpeedThreshold: 0.01,
          });
        backdropOpacity.value = withTiming(0.3, { duration: 300 });
        if (!isSidebarOpen) {
          runOnJS(setSidebarOpen)(true);
        }
        } else {
        // Close sidebar with optimized spring
        translateX.value = withSpring(-sidebarWidth, {
          damping: 35,
            stiffness: 120,
            mass: 0.9,
            overshootClamping: true,
          restDisplacementThreshold: 0.01,
          restSpeedThreshold: 0.01,
          });
        backdropOpacity.value = withTiming(0, { duration: 250 });
        if (isSidebarOpen) {
          runOnJS(closeSidebar)();
        }
      }
    });

  // Animated styles
  const sidebarAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value, // Use the interpolated opacity directly
  }));

  const iconAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: iconScale.value }
    ],
  }));

  const settingsIconAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${settingsIconRotation.value}deg` },
      { scale: iconScale.value }
    ],
  }));

  const handleMenuPress = (item: any) => {
    // Animate icon on press
    iconScale.value = withSequence(
      withTiming(0.8, { duration: 100 }),
      withTiming(1, { duration: 150 })
    );
    
    // Close sidebar first for better UX
    closeSidebar();
    
    // Then handle the action after a small delay to allow animation
    setTimeout(() => {
    if (item.onPress) {
      item.onPress();
    } else if (item.route) {
      router.push(item.route);
    }
    }, 150);
  };

  const isDarkMode = mode === 'dark';

  // Simplified render condition - only based on parent state
  if (!isSidebarOpen) {
    return null;
  }

  return (
    <View style={styles.overlayContainer} pointerEvents={isSidebarOpen ? "auto" : "none"}>
      <StatusBar
        translucent={true}
        backgroundColor="transparent"
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        animated={false}
        networkActivityIndicatorVisible={false}
      />

      <View style={styles.container} pointerEvents="box-none">
        {/* Optimized backdrop with gesture */}
        <GestureDetector gesture={tapGesture}>
          <Animated.View style={[styles.backdrop, backdropAnimatedStyle]} pointerEvents="auto" />
        </GestureDetector>

        {/* Sidebar with optimized gesture */}
        <GestureDetector gesture={panGesture}>
          <Animated.View
            style={[
              styles.sidebar,
              {
                backgroundColor: colors.card,
                width: sidebarWidth,
                paddingTop: topInset + hp('1%'),
                paddingBottom: bottomInset + hp('1%'),
                paddingLeft: leftInset + wp('2%'),
                paddingRight: wp('2%'),
              },
              sidebarAnimatedStyle,
            ]}
            pointerEvents="auto"
          >
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity
                style={styles.userProfile}
                onPress={() => handleMenuPress({ route: '/settings' })}
                activeOpacity={0.7}
              >
                <View style={[styles.avatar, { backgroundColor: colors.primary + '20' }]}>
                  <Ionicons name="person" size={RFValue(24)} color={colors.primary} />
                </View>
                <View style={styles.userInfo}>
                  <Text style={[styles.userName, { color: colors.text }]}>
                    {user?.username || t('greetings.welcome')}
                  </Text>
                  {user?.phone_number && (
                    <Text style={[styles.userPhone, { color: colors.text + '80' }]}>
                      {user.phone_number}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            </View>

            {/* Menu Items */}
            <View style={styles.menuContainer}>
              {menuItems.map((item, index) => (
                <TouchableOpacity
                  key={`menu-item-${index}`}
                  style={[
                    styles.menuItem,
                    item.disabled && styles.disabledMenuItem
                  ]}
                  onPress={() => !item.disabled && handleMenuPress(item)}
                  activeOpacity={0.6}
                  disabled={item.disabled}
                >
                  <Animated.View style={[
                    styles.iconContainer, 
                    { backgroundColor: item.color + '15' }, 
                    item.icon === 'settings-outline' ? settingsIconAnimatedStyle : iconAnimatedStyle
                  ]}>
                    <Ionicons
                      name={item.icon as keyof typeof Ionicons.glyphMap}
                      size={RFValue(20)}
                      color={item.color}
                    />
                  </Animated.View>
                  <Text style={[styles.menuLabel, { color: colors.text }]}>
                    {item.label}
                    {item.disabled && '...'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Footer */}
            <View style={styles.footer}>
              <View style={[styles.footerContent, { backgroundColor: colors.background + '30' }]}>
                <Text style={[styles.footerText, { color: colors.text + '70' }]}>
                  Farmacy v1.0.0
                </Text>
                <Text style={[styles.footerSubtext, { color: colors.text + '50' }]}>
                  Smart Farming Solutions
                </Text>
              </View>
            </View>
          </Animated.View>
        </GestureDetector>
      </View>
    </View>
  );
};

// Global gesture overlay for edge swipe detection
export const SideBarGestureOverlay: React.FC<{
  isSidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  width: number;
  colors: {
    card: string;
    background: string;
    text: string;
    primary: string;
    border: string;
    secondary: string;
  };
}> = ({ isSidebarOpen, setSidebarOpen, width, colors }) => {
  const sidebarWidth = width * 0.75;
  const translateX = useSharedValue(-sidebarWidth);
  const backdropOpacity = useSharedValue(0);

  // Create edge gesture for opening sidebar
  const edgePanGesture = Gesture.Pan()
    .onUpdate((event) => {
      'worklet';
      
      // Only respond to right swipes from left edge when sidebar is closed
      if (!isSidebarOpen && event.x < 60 && event.translationX > 0) {
        const progress = Math.min(1, event.translationX / (sidebarWidth * 0.7));
        const newPosition = -sidebarWidth + (sidebarWidth * progress);
        translateX.value = newPosition;
        backdropOpacity.value = progress * 0.5;
      }
    })
    .onEnd((event) => {
      'worklet';
      
      if (!isSidebarOpen && event.x < 60) {
        const velocity = event.velocityX;
        const progress = event.translationX / (sidebarWidth * 0.7);
        
        // Open if swiped more than 35% or fast right swipe
        const shouldOpen = progress > 0.35 || (velocity > 800 && event.translationX > 50);
        
        if (shouldOpen) {
          // Open sidebar smoothly
        translateX.value = withSpring(0, {
          damping: 25,
          stiffness: 120,
          mass: 0.9,
            overshootClamping: true,
        });
          backdropOpacity.value = withTiming(0.5, { duration: 300 });
        runOnJS(setSidebarOpen)(true);
      } else {
          // Snap back to closed position
        translateX.value = withSpring(-sidebarWidth, {
          damping: 30,
          stiffness: 150,
            mass: 0.8,
            overshootClamping: true,
        });
        backdropOpacity.value = withTiming(0, { duration: 200 });
        }
      }
    });

  const overlayStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  // Only render when sidebar is closed
  if (isSidebarOpen) {
    return null;
  }

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50 }} pointerEvents="box-none">
      {/* Backdrop - only visible when gesture is active */}
      <Animated.View 
        style={[
          { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'black' },
          backdropStyle
        ]} 
        pointerEvents="none"
      />
      
      {/* Edge gesture area - only capture touches at the edge */}
      <GestureDetector gesture={edgePanGesture}>
        <View 
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 60, // Increased from 50 for better accessibility
            zIndex: 100,
          }}
          pointerEvents="auto"
        />
      </GestureDetector>
      
      {/* Preview sidebar */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: sidebarWidth,
            backgroundColor: colors.card,
            zIndex: 60,
          },
          overlayStyle
        ]}
        pointerEvents="none"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  overlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 99999,
    elevation: 9999,
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    margin: 0,
    padding: 0,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    zIndex: 100000,
  },
  sidebar: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    shadowColor: '#000',
    shadowOffset: { width: 1, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 10000,
    zIndex: 100001,
  },
  header: {
    paddingHorizontal: wp('2%'),
    paddingBottom: hp('1%'),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: hp('0.5%'),
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },

  userProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: wp('12%'),
    height: wp('12%'),
    borderRadius: wp('6%'),
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: wp('3%'),
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: RFValue(16),
    fontWeight: '600',
    marginBottom: hp('0.3%'),
  },
  userPhone: {
    fontSize: RFValue(12),
    marginBottom: hp('0.3%'),
  },
  menuContainer: {
    flex: 1,
    paddingTop: hp('1%'),
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp('2%'),
    paddingVertical: hp('1.2%'),
    marginHorizontal: wp('1%'),
    borderRadius: wp('2%'),
    marginBottom: hp('1%'),
  },
  iconContainer: {
    width: wp('9%'),
    height: wp('9%'),
    borderRadius: wp('4.5%'),
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: wp('3%'),
  },
  menuLabel: {
    fontSize: RFValue(15),
    fontWeight: '500',
    flex: 1,
  },
  footer: {
    paddingHorizontal: wp('2%'),
    paddingTop: hp('1%'),
  },
  footerContent: {
    padding: wp('3%'),
    borderRadius: wp('2%'),
    alignItems: 'center',
  },
  footerText: {
    fontSize: RFValue(12),
    fontWeight: '500',
    marginBottom: hp('0.3%'),
  },
  footerSubtext: {
    fontSize: RFValue(10),
  },
  disabledMenuItem: {
    opacity: 0.5,
  },
});

export default SideBar; 