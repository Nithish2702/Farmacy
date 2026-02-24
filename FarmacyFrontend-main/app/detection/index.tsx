import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  StatusBar,
  Alert,
  Modal,
  TextInput,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import { RFValue } from 'react-native-responsive-fontsize';
import { useTheme } from '@/context/theme';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring,
  withSequence,
  withTiming
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

const Detection = () => {
  const router = useRouter();
  const { colors, mode } = useTheme();
  const { t } = useTranslation();
  const [image, setImage] = useState<string | null>(null);
  const [showCropSelector, setShowCropSelector] = useState(false);
  const [selectedCrop, setSelectedCrop] = useState<string>('');
  const [cropInput, setCropInput] = useState<string>('');
  
  // Animation values
  const scaleAnim = useSharedValue(1);
  const fadeAnim = useSharedValue(1);

  // Enhanced color palette based on current theme
  const enhancedColors = useMemo(() => ({
    ...colors,
    success: mode === 'dark' ? '#22C55E' : '#16A34A',
    warning: mode === 'dark' ? '#F59E0B' : '#D97706',
    info: mode === 'dark' ? '#3B82F6' : '#2563EB',
    accent: mode === 'dark' ? '#EF4444' : '#DC2626',
    white: '#FFFFFF',
    secondary: mode === 'dark' ? '#059669' : '#15803D',
    gradientStart: mode === 'dark' ? '#1E293B' : '#e6f4ea',
    gradientEnd: mode === 'dark' ? '#0F172A' : '#bbf7d0',
  }), [colors, mode]);

  // Animated button press
  const handleButtonPress = (callback: () => void) => {
    scaleAnim.value = withSequence(
      withTiming(0.95, { duration: 100 }),
      withTiming(1, { duration: 150 })
    );
    callback();
  };

  const handleImageCapture = (imageUri: string) => {
    setImage(imageUri);
    setShowCropSelector(true);
  };

  const handleCropSelection = () => {
    setShowCropSelector(false);
    
    // Navigate to result page with image and optional crop data
    router.push({
      pathname: '/detection/result',
      params: {
        imageUri: image,
        ...(cropInput.trim() && { cropName: cropInput.trim() })
      }
    });
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      handleImageCapture(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    
    if (status === 'granted') {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled) {
        handleImageCapture(result.assets[0].uri);
      }
    } else {
      Alert.alert('Permission Required', 'Sorry, we need camera permissions to make this work!');
    }
  };

  // Animated styles
  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleAnim.value }],
  }));

  const fadeInStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
  }));

  const cropOptions = [
    'Rice',
    'Cotton',
    'Chilli',
    'Corn',
    'Wheat',
    'Soybean',
    'Sugarcane',
    'Tomato',
  ];

  return (
    <View style={[styles.container, { backgroundColor: enhancedColors.background }]}>
      <StatusBar
        barStyle={mode === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={enhancedColors.background}
      />
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: enhancedColors.background, borderBottomColor: enhancedColors.border }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.replace('/(tabs)')}
        >
          <Ionicons name="arrow-back" size={RFValue(22)} color={enhancedColors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: enhancedColors.text }]}>{t('detection.title')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Main Content */}
        <Animated.View style={[styles.contentSection, { backgroundColor: enhancedColors.card, borderColor: enhancedColors.border }, fadeInStyle]}>
          <View style={styles.headerContent}>
            <View style={styles.iconContainer}>
              <Ionicons name="leaf" size={RFValue(24)} color={enhancedColors.primary} />
            </View>
            <Text style={[styles.title, { color: enhancedColors.text }]}>{t('detection.subtitle')}</Text>
            <View style={styles.newBadge}>
              <Text style={[styles.newBadgeText, { color: enhancedColors.white }]}>AI</Text>
            </View>
          </View>

          <Text style={[styles.description, { color: enhancedColors.textSecondary }]}>
            {t('detection.instructions.title')}
          </Text>

          <View style={styles.imageContainer}>
            <Image
              source={t('detection.stepsImage') === 'detection_steps_hi.png'
                ? require('../../assets/detection_steps_hi.png')
                : t('detection.stepsImage') === 'detection_steps_te.png'
                  ? require('../../assets/detection_steps_te.png')
                  : require('../../assets/detection_steps.png')
              }
              style={styles.guideImage}
              resizeMode="contain"
            />
          </View>

          <View style={styles.buttonContainer}>
            <Animated.View style={animatedButtonStyle}>
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: enhancedColors.primary }]}
                onPress={() => handleButtonPress(takePhoto)}
              >
                <Ionicons name="camera" size={RFValue(16)} color={enhancedColors.white} />
                <Text style={[styles.primaryButtonText, { color: enhancedColors.white }]}>{t('detection.buttons.takePhoto')}</Text>
              </TouchableOpacity>
            </Animated.View>

            <Animated.View style={animatedButtonStyle}>
              <TouchableOpacity
                style={[styles.secondaryButton, { backgroundColor: enhancedColors.background, borderColor: enhancedColors.border }]}
                onPress={() => handleButtonPress(pickImage)}
              >
                <Ionicons name="images" size={RFValue(16)} color={enhancedColors.text} />
                <Text style={[styles.secondaryButtonText, { color: enhancedColors.text }]}>{t('detection.buttons.uploadImage')}</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </Animated.View>

        {/* Instructions Section */}
        <View style={[styles.instructionsSection, { backgroundColor: enhancedColors.card, borderColor: enhancedColors.border }]}>
          <View style={styles.instructionsHeader}>
            <Ionicons name="information-circle" size={RFValue(20)} color={enhancedColors.primary} />
            <Text style={[styles.instructionsTitle, { color: enhancedColors.text }]}>{t('detection.instructions.title')}</Text>
          </View>
          
          <View style={styles.instructionsList}>
            <View style={styles.instructionItem}>
              <View style={[styles.stepNumber, { backgroundColor: enhancedColors.primary + '20' }]}>
                <Text style={[styles.stepNumberText, { color: enhancedColors.primary }]}>1</Text>
              </View>
              <Text style={[styles.instructionText, { color: enhancedColors.text }]}>
                {t('detection.instructions.step1')}
              </Text>
            </View>
            
            <View style={styles.instructionItem}>
              <View style={[styles.stepNumber, { backgroundColor: enhancedColors.primary + '20' }]}>
                <Text style={[styles.stepNumberText, { color: enhancedColors.primary }]}>2</Text>
              </View>
              <Text style={[styles.instructionText, { color: enhancedColors.text }]}>
                {t('detection.instructions.step2')}
              </Text>
            </View>
            
            <View style={styles.instructionItem}>
              <View style={[styles.stepNumber, { backgroundColor: enhancedColors.primary + '20' }]}>
                <Text style={[styles.stepNumberText, { color: enhancedColors.primary }]}>3</Text>
              </View>
              <Text style={[styles.instructionText, { color: enhancedColors.text }]}>
                {t('detection.instructions.step3')}
              </Text>
            </View>
          </View>
        </View>

        {/* Tips Section */}
        <View style={[styles.tipsSection, { backgroundColor: enhancedColors.card, borderColor: enhancedColors.border }]}>
          <View style={styles.tipsHeader}>
            <Ionicons name="bulb" size={RFValue(20)} color={enhancedColors.warning} />
            <Text style={[styles.tipsTitle, { color: enhancedColors.text }]}>{t('detection.proTips.title')}</Text>
          </View>
          
          <View style={styles.tipsList}>
            <Text style={[styles.tipText, { color: enhancedColors.textSecondary }]}>
              {t('detection.proTips.tip1')}
            </Text>
            <Text style={[styles.tipText, { color: enhancedColors.textSecondary }]}>
              {t('detection.proTips.tip2')}
            </Text>
            <Text style={[styles.tipText, { color: enhancedColors.textSecondary }]}>
              {t('detection.proTips.tip3')}
            </Text>
            <Text style={[styles.tipText, { color: enhancedColors.textSecondary }]}>
              {t('detection.proTips.tip4')}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Crop Selection Modal */}
      <Modal
        visible={showCropSelector}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCropSelector(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: enhancedColors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: enhancedColors.text }]}>{t('detection.cropNameModal.title')}</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowCropSelector(false)}
              >
                <Ionicons name="close" size={RFValue(24)} color={enhancedColors.text} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.cropInputContainer}>
              <TextInput
                style={[styles.cropInput, { color: enhancedColors.text, borderColor: enhancedColors.border }]}
                placeholder={t('detection.cropNameModal.placeholder')}
                placeholderTextColor={enhancedColors.textSecondary}
                value={cropInput}
                onChangeText={setCropInput}
                onSubmitEditing={handleCropSelection}
              />
              <TouchableOpacity
                style={[styles.submitButton, { backgroundColor: enhancedColors.primary }]}
                onPress={handleCropSelection}
              >
                <Text style={[styles.submitButtonText, { color: enhancedColors.white }]}>{t('detection.cropNameModal.continue')}</Text>
              </TouchableOpacity>
            </View>
            {/* Dropdown for crop options */}
            <FlatList
              data={cropOptions.filter(option => option.toLowerCase().includes(cropInput.toLowerCase()))}
              keyExtractor={item => item}
              style={{ maxHeight: 200, marginTop: 8 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={{ paddingVertical: 10, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: enhancedColors.border }}
                  onPress={() => setCropInput(item)}
                >
                  <Text style={{ color: enhancedColors.text, fontSize: RFValue(14) }}>{item}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={null}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('1.5%'),
    borderBottomWidth: 0.5,
  },
  backButton: {
    padding: wp('2%'),
  },
  headerTitle: {
    fontSize: RFValue(18),
    fontWeight: '700',
  },
  headerSpacer: {
    width: wp('10%'),
  },
  scrollContainer: {
    flex: 1,
    paddingHorizontal: wp('4%'),
  },
  contentSection: {
    borderRadius: wp('4%'),
    padding: wp('4%'),
    marginTop: hp('2%'),
    marginBottom: hp('2%'),
    borderWidth: 1,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp('1%'),
  },
  iconContainer: {
    marginRight: wp('2%'),
  },
  title: {
    fontSize: RFValue(16),
    fontWeight: '600',
    flex: 1,
  },
  newBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: wp('2%'),
    paddingVertical: hp('0.3%'),
    borderRadius: wp('3%'),
  },
  newBadgeText: {
    fontSize: RFValue(8),
    fontWeight: '600',
  },
  description: {
    fontSize: RFValue(12),
    lineHeight: RFValue(18),
    marginBottom: hp('3%'),
  },
  imageContainer: {
    alignItems: 'center',
    marginVertical: hp('0.5%'),
  },
  guideImage: {
    width: wp('70%'),
    height: hp('15%'),
  },
  buttonContainer: {
    gap: hp('1.5%'),
    marginTop: hp('2%'),
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: hp('1.5%'),
    paddingHorizontal: wp('4%'),
    borderRadius: wp('3%'),
    gap: wp('2%'),
  },
  primaryButtonText: {
    fontSize: RFValue(14),
    fontWeight: '600',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: hp('1.5%'),
    paddingHorizontal: wp('4%'),
    borderRadius: wp('3%'),
    borderWidth: 1,
    gap: wp('2%'),
  },
  secondaryButtonText: {
    fontSize: RFValue(14),
    fontWeight: '600',
  },
  instructionsSection: {
    borderRadius: wp('4%'),
    padding: wp('4%'),
    marginBottom: hp('2%'),
    borderWidth: 1,
  },
  instructionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp('2%'),
    gap: wp('2%'),
  },
  instructionsTitle: {
    fontSize: RFValue(16),
    fontWeight: '600',
  },
  instructionsList: {
    gap: hp('1.5%'),
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp('3%'),
  },
  stepNumber: {
    width: wp('6%'),
    height: wp('6%'),
    borderRadius: wp('3%'),
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    fontSize: RFValue(12),
    fontWeight: '600',
  },
  instructionText: {
    fontSize: RFValue(13),
    lineHeight: RFValue(20),
    flex: 1,
  },
  tipsSection: {
    borderRadius: wp('4%'),
    padding: wp('4%'),
    marginBottom: hp('3%'),
    borderWidth: 1,
  },
  tipsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp('2%'),
    gap: wp('2%'),
  },
  tipsTitle: {
    fontSize: RFValue(16),
    fontWeight: '600',
  },
  tipsList: {
    gap: hp('0.8%'),
  },
  tipText: {
    fontSize: RFValue(12),
    lineHeight: RFValue(18),
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: wp('6%'),
    borderTopRightRadius: wp('6%'),
    maxHeight: hp('70%'),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: wp('4%'),
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: RFValue(18),
    fontWeight: '600',
  },
  closeButton: {
    padding: wp('2%'),
  },
  cropInputContainer: {
    padding: wp('4%'),
  },
  cropInput: {
    borderWidth: 1,
    borderRadius: wp('2%'),
    padding: wp('3%'),
    marginBottom: wp('3%'),
    fontSize: RFValue(16),
  },
  submitButton: {
    padding: wp('3%'),
    borderRadius: wp('2%'),
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: RFValue(16),
    fontWeight: '600',
  },
});

export default Detection;