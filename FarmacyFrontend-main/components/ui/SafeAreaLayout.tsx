import React, { useEffect } from 'react';
import { View, StyleSheet, StatusBar, ViewStyle, ColorValue, ImageSourcePropType, ImageBackground } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigationBar } from '@/hooks/useNavigationBar';
import { heightPercentageToDP as hp } from 'react-native-responsive-screen';

interface SafeAreaLayoutProps {
  children: React.ReactNode;
  backgroundImage?: ImageSourcePropType;
  backgroundColor?: string;
  gradient?: {
    colors: [ColorValue, ColorValue, ...ColorValue[]];
    locations?: [number, number, ...number[]] | null;
  };
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  statusBarStyle?: 'light-content' | 'dark-content' | 'default';
  statusBarHidden?: boolean;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
}

export const SafeAreaLayout: React.FC<SafeAreaLayoutProps> = ({
  children,
  backgroundImage,
  backgroundColor = '#000',
  gradient,
  style,
  contentStyle,
  statusBarStyle = 'light-content',
  statusBarHidden = false,
  edges = ['top', 'left', 'right', 'bottom'],
}) => {
  const { setTransparentBar } = useNavigationBar();

  // Ensure navigation bar is transparent when this component mounts
  useEffect(() => {
    console.log('SafeAreaLayout: Component mounted, calling setTransparentBar');
    setTransparentBar();
  }, [setTransparentBar]);

  const Background = () => {
    if (backgroundImage) {
      return (
        <ImageBackground
          source={backgroundImage}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        >
          {gradient && (
            <LinearGradient
              colors={gradient.colors}
              locations={gradient.locations}
              style={StyleSheet.absoluteFill}
            />
          )}
        </ImageBackground>
      );
    }

    if (gradient) {
      return (
        <LinearGradient
          colors={gradient.colors}
          locations={gradient.locations}
          style={StyleSheet.absoluteFill}
        />
      );
    }

    return null;
  };

  return (
    <View style={[styles.container, { backgroundColor }, style]}>
      <StatusBar 
        barStyle={statusBarStyle} 
        backgroundColor="transparent" 
        translucent={true}
        hidden={statusBarHidden}
        animated={true}
      />
      
      {/* Background layer that extends into ALL safe areas - positioned absolutely */}
      <View style={[StyleSheet.absoluteFill, { zIndex: 0 }]}>
        <Background />
      </View>

      {/* Content layer that respects safe areas on specified edges */}
      <SafeAreaView edges={edges} style={[styles.contentContainer, contentStyle, { zIndex: 1 }]}>
        {children}
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // Ensure background extends to all edges
  },
  contentContainer: {
    flex: 1,
    // Content respects safe areas
    paddingTop: hp('0.002%'), // Global header padding
  },
}); 