# Global Safe Area Implementation Guide

## Overview

This guide explains how to use the new global safe area system that ensures:
- **Background images, colors, and gradients extend to the full screen** (including safe areas)
- **Content (text, buttons, etc.) respects safe area boundaries** and doesn't get cut off
- **Consistent behavior across all screens** in the app

## How It Works

The system consists of several components working together:

1. **SafeAreaLayout Component** - The core component that handles background and content layers
2. **SafeAreaContext** - Global context for managing safe area configuration
3. **useGlobalSafeArea Hook** - Easy-to-use hook for configuring safe areas
4. **withGlobalSafeArea HOC** - Higher-order component for wrapping screens

## Quick Start

### Method 1: Using the Hook (Recommended)

```tsx
import { useGlobalSafeArea } from '@/hooks/useGlobalSafeArea';
import { useEffect } from 'react';

export default function MyScreen() {
  const { configureSafeArea } = useGlobalSafeArea();

  useEffect(() => {
    // Configure safe area when screen mounts
    configureSafeArea({
      backgroundImage: require('@/assets/background.jpg'),
      gradient: {
        colors: ['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.7)'],
        locations: [0, 1]
      },
      statusBarStyle: 'light-content',
      edges: ['top', 'left', 'right', 'bottom']
    });

    // Cleanup when screen unmounts
    return () => {
      configureSafeArea({});
    };
  }, []);

  return (
    <View style={styles.container}>
      {/* Your content here - will respect safe areas */}
      <Text>This text will stay within safe areas</Text>
    </View>
  );
}
```

### Method 2: Using the HOC

```tsx
import { withGlobalSafeArea } from '@/components/ui/withGlobalSafeArea';

function MyScreen() {
  return (
    <View style={styles.container}>
      {/* Your content here */}
    </View>
  );
}

export default withGlobalSafeArea(MyScreen, {
  backgroundImage: require('@/assets/background.jpg'),
  gradient: {
    colors: ['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.7)'],
    locations: [0, 1]
  },
  statusBarStyle: 'light-content',
  edges: ['top', 'left', 'right', 'bottom']
});
```

### Method 3: Direct Component Usage

```tsx
import { SafeAreaLayout } from '@/components/ui/SafeAreaLayout';

export default function MyScreen() {
  return (
    <SafeAreaLayout
      backgroundImage={require('@/assets/background.jpg')}
      gradient={{
        colors: ['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.7)'],
        locations: [0, 1]
      }}
      statusBarStyle="light-content"
      edges={['top', 'left', 'right', 'bottom']}
    >
      <View style={styles.container}>
        {/* Your content here */}
      </View>
    </SafeAreaLayout>
  );
}
```

## Configuration Options

### Background Options

```tsx
// Background image only
configureSafeArea({
  backgroundImage: require('@/assets/background.jpg')
});

// Gradient only
configureSafeArea({
  gradient: {
    colors: ['#a8e6cf', '#dcedc1'],
    locations: [0, 1]
  }
});

// Background image with gradient overlay
configureSafeArea({
  backgroundImage: require('@/assets/background.jpg'),
  gradient: {
    colors: ['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.7)'],
    locations: [0, 1]
  }
});

// Solid background color
configureSafeArea({
  backgroundColor: '#f0f0f0'
});
```

### Status Bar Options

```tsx
// Light content (white text/icons)
configureSafeArea({
  statusBarStyle: 'light-content'
});

// Dark content (black text/icons)
configureSafeArea({
  statusBarStyle: 'dark-content'
});

// Hide status bar
configureSafeArea({
  statusBarHidden: true
});
```

### Safe Area Edges

```tsx
// All edges (default)
configureSafeArea({
  edges: ['top', 'left', 'right', 'bottom']
});

// Only top and bottom
configureSafeArea({
  edges: ['top', 'bottom']
});

// Only left and right
configureSafeArea({
  edges: ['left', 'right']
});

// No safe area protection (full screen content)
configureSafeArea({
  edges: []
});
```

## Migration Guide

### From Old SafeAreaView Implementation

**Before:**
```tsx
import { SafeAreaView } from 'react-native-safe-area-context';
import { ImageBackground } from 'react-native';

<SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
  <ImageBackground source={require('@/assets/bg.jpg')} style={styles.background}>
    <LinearGradient colors={['#fff', '#000']} style={styles.gradient}>
      {children}
    </LinearGradient>
  </ImageBackground>
</SafeAreaView>
```

**After:**
```tsx
import { useGlobalSafeArea } from '@/hooks/useGlobalSafeArea';

export default function MyScreen() {
  const { configureSafeArea } = useGlobalSafeArea();

  useEffect(() => {
    configureSafeArea({
      backgroundImage: require('@/assets/bg.jpg'),
      gradient: {
        colors: ['#fff', '#000'],
        locations: [0, 1]
      },
      edges: ['top', 'left', 'right']
    });

    return () => configureSafeArea({});
  }, []);

  return (
    <View style={styles.container}>
      {children}
    </View>
  );
}
```

### From ImageBackground Implementation

**Before:**
```tsx
import { ImageBackground } from 'react-native';

<ImageBackground source={require('@/assets/bg.jpg')} style={styles.background}>
  <LinearGradient colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.7)']} style={styles.gradient}>
    {children}
  </LinearGradient>
</ImageBackground>
```

**After:**
```tsx
import { useGlobalSafeArea } from '@/hooks/useGlobalSafeArea';

export default function MyScreen() {
  const { configureSafeArea } = useGlobalSafeArea();

  useEffect(() => {
    configureSafeArea({
      backgroundImage: require('@/assets/bg.jpg'),
      gradient: {
        colors: ['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.7)'],
        locations: [0, 1]
      }
    });

    return () => configureSafeArea({});
  }, []);

  return (
    <View style={styles.container}>
      {children}
    </View>
  );
}
```

## Best Practices

### 1. Always Clean Up
```tsx
useEffect(() => {
  configureSafeArea({ /* your config */ });
  
  // Always reset when component unmounts
  return () => {
    configureSafeArea({});
  };
}, []);
```

### 2. Use Appropriate Status Bar Style
```tsx
// For dark backgrounds
configureSafeArea({
  statusBarStyle: 'light-content'
});

// For light backgrounds
configureSafeArea({
  statusBarStyle: 'dark-content'
});
```

### 3. Choose the Right Edges
```tsx
// For full-screen backgrounds
configureSafeArea({
  edges: ['top', 'left', 'right', 'bottom']
});

// For content that can extend to sides
configureSafeArea({
  edges: ['top', 'bottom']
});
```

### 4. Optimize Background Images
```tsx
// Use appropriate image sizes and formats
// Consider using different images for different screen sizes
configureSafeArea({
  backgroundImage: require('@/assets/background.jpg')
});
```

## Troubleshooting

### Background Not Showing
- Make sure the image path is correct
- Check that the image file exists in the assets folder
- Verify the require statement syntax

### Content Getting Cut Off
- Ensure you're using the correct edges configuration
- Check that your content has proper padding/margins
- Verify that the SafeAreaLayout is wrapping your content

### Status Bar Issues
- Make sure statusBarStyle matches your background
- Check that translucent is set to true in the main layout
- Verify the status bar color contrast

### Performance Issues
- Use appropriate image sizes
- Consider using gradients instead of large images
- Clean up configurations when screens unmount

## Examples

### Login Screen
```tsx
export default function LoginScreen() {
  const { configureSafeArea } = useGlobalSafeArea();

  useEffect(() => {
    configureSafeArea({
      backgroundImage: require('@/assets/login-bg.jpg'),
      gradient: {
        colors: ['rgba(0,0,0,0.4)', 'rgba(0,0,0,0.8)'],
        locations: [0, 1]
      },
      statusBarStyle: 'light-content',
      edges: ['top', 'left', 'right', 'bottom']
    });

    return () => configureSafeArea({});
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome Back</Text>
      {/* Login form content */}
    </View>
  );
}
```

### Dashboard Screen
```tsx
export default function DashboardScreen() {
  const { configureSafeArea } = useGlobalSafeArea();

  useEffect(() => {
    configureSafeArea({
      gradient: {
        colors: ['#f8f9fa', '#e9ecef'],
        locations: [0, 1]
      },
      statusBarStyle: 'dark-content',
      edges: ['top', 'left', 'right', 'bottom']
    });

    return () => configureSafeArea({});
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Dashboard</Text>
      {/* Dashboard content */}
    </View>
  );
}
```

This system provides a consistent, maintainable way to handle safe areas across your entire app while ensuring backgrounds extend properly and content stays within safe boundaries. 