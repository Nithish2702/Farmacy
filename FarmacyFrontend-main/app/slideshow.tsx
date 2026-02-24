import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  TouchableOpacity,
  Image,
  Platform,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { RFValue } from 'react-native-responsive-fontsize';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { SafeAreaLayout } from '@/components/ui/SafeAreaLayout';
import { useNavigationBar } from '@/hooks/useNavigationBar';

const { width } = Dimensions.get('window');

const Slideshow: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const router = useRouter();
  const scrollX = new Animated.Value(0);
  const { t } = useTranslation();
  const { updateTheme, setTransparentBar } = useNavigationBar();

  const slides = [
    {
      id: '1',
      title: t('slideshow.slides.diseaseDetection.title'),
      description: t('slideshow.slides.diseaseDetection.description'),
      image: require('@/assets/features/disease_detection.png'),
      icon: 'scan-outline'
    },
    {
      id: '2',
      title: t('slideshow.slides.cropTracking.title'),
      description: t('slideshow.slides.cropTracking.description'),
      image: require('@/assets/features/crop_tracking.png'),
      icon: 'leaf-outline'
    },
    {
      id: '3',
      title: t('slideshow.slides.news.title'),
      description: t('slideshow.slides.news.description'),
      image: require('@/assets/features/news.png'),
      icon: 'newspaper-outline'
    },
    {
      id: '4',
      title: t('slideshow.slides.guide.title'),
      description: t('slideshow.slides.guide.description'),
      image: require('@/assets/features/guide.png'),
      icon: 'book-outline'
    },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      if (currentIndex < slides.length - 1) {
        setCurrentIndex(prev => prev + 1);
        flatListRef.current?.scrollToIndex({
          index: currentIndex + 1,
          animated: true,
        });
      } else {
        setCurrentIndex(0);
        flatListRef.current?.scrollToIndex({
          index: 0,
          animated: true,
        });
      }
    }, 5000);

    return () => clearInterval(timer);
  }, [currentIndex]);

  // Ensure navigation bar is transparent
  useEffect(() => {
    updateTheme(true); // true for dark theme (black background)
    setTransparentBar();
  }, [updateTheme, setTransparentBar]);

  const handleContinue = () => {
    if (currentIndex < slides.length - 1) {
      setCurrentIndex(prev => prev + 1);
      flatListRef.current?.scrollToIndex({
        index: currentIndex + 1,
        animated: true,
      });
    } else {
      router.push('/cropselect');
    }
  };

  return (
    <SafeAreaLayout
      backgroundColor="#000"
      statusBarStyle="light-content"
      edges={['top', 'left', 'right', 'bottom']}
      contentStyle={styles.container}
    >
      <View style={{ flex: 1 }}>
        <FlatList
          ref={flatListRef}
          data={slides}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => {
            const index = Math.round(e.nativeEvent.contentOffset.x / width);
            setCurrentIndex(index);
          }}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { x: scrollX } } }],
            { useNativeDriver: false }
          )}
          renderItem={({ item }) => (
            <View style={styles.slide}>
              <Image
                source={item.image}
                style={styles.image}
                resizeMode="cover"
              />
              <View style={styles.overlay}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.description}>{item.description}</Text>
              </View>
            </View>
          )}
        />
        <View style={styles.pagination}>
          {slides.map((_, index) => {
            const inputRange = [
              (index - 1) * width,
              index * width,
              (index + 1) * width,
            ];
            const dotWidth = scrollX.interpolate({
              inputRange,
              outputRange: [8, 20, 8],
              extrapolate: 'clamp',
            });
            const opacity = scrollX.interpolate({
              inputRange,
              outputRange: [0.3, 1, 0.3],
              extrapolate: 'clamp',
            });
            return (
              <Animated.View
                key={index}
                style={[
                  styles.dot,
                  {
                    width: dotWidth,
                    opacity,
                  },
                ]}
              />
            );
          })}
        </View>
        <View style={styles.footer}>
          <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
            <Text style={styles.continueButtonText}>
              {currentIndex === slides.length - 1 ? t('slideshow.getStarted') : t('slideshow.continueButton')}
            </Text>
            <Ionicons name="arrow-forward" size={24} color="white" />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaLayout>
  );
};

const styles = StyleSheet.create({
  slide: {
    width,
    height: '100%',
  },
  image: {
    width: '100%',
    height: '100%',
    opacity: 0.7,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: RFValue(24),
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 10,
  },
  description: {
    fontSize: RFValue(16),
    color: '#fff',
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: hp('5%'),
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2E7D32',
    paddingHorizontal: wp('6%'),
    paddingVertical: hp('1.5%'),
    borderRadius: wp('5%'),
  },
  continueButtonText: {
    color: 'white',
    fontSize: RFValue(16),
    fontWeight: '600',
    marginRight: wp('2%'),
  },
  pagination: {
    position: 'absolute',
    bottom: 20,
    flexDirection: 'row',
    alignSelf: 'center',
  },
  dot: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    marginHorizontal: 4,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default Slideshow; 