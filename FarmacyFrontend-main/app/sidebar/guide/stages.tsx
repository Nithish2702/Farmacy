import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/context/theme';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import { RFValue } from 'react-native-responsive-fontsize';
import { Ionicons } from '@expo/vector-icons';
import { useCrops } from '@/hooks/useCrops';
import { useStageWiseData } from '@/hooks/useStageWiseData';
import { Crop, Stage } from '@/api/cropService';
import CropSelectorDropdown from '@/components/CropSelectorDropDown';
import { useCropsContext } from '@/context/CropsContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const getStageImage = (stageNumber: number) => {
  // Static mapping of stage numbers to image requires
  const stageImages: { [key: number]: any } = {
    1: require('@/assets/stage1.png'),
    2: require('@/assets/stage2.png'),
    3: require('@/assets/stage3.png'),
    4: require('@/assets/stage4.png'),
    5: require('@/assets/stage5.png'),
    6: require('@/assets/stage6.png'),
    7: require('@/assets/stage7.png'),
    8: require('@/assets/stage8.png'),
    9: require('@/assets/stage9.png'),
  };

  // Return the stage image if it exists, otherwise return default
  return stageImages[stageNumber] || require('@/assets/default-crop.png');
};

const StageGuide = () => {
  const router = useRouter();
  const { t } = useTranslation();
  const { mode } = useTheme();
  const isDarkMode = mode === 'dark';
  const { crops, currentCrop } = useCropsContext();
  const { stages, loading: stageLoading, error: stageError, fetchCropStages } = useStageWiseData();
  const insets = useSafeAreaInsets();
  
  const [selectedCrop, setSelectedCrop] = useState<Crop | null>(currentCrop || null);
  
  const [showCropSelect, setShowCropSelect] = useState(false);
  const [expandedStages, setExpandedStages] = useState<number[]>([]);

  const colors = {
    background: isDarkMode ? '#1F2937' : '#F0F7F0',
    card: isDarkMode ? '#374151' : '#FFFFFF',
    text: isDarkMode ? '#F9FAFB' : '#2C3E2C',
    textSecondary: isDarkMode ? '#D1D5DB' : '#6B7280',
    primary: '#4CAF50',
    secondary: '#81C784',
    border: isDarkMode ? '#4B5563' : '#E5E7EB',
    success: isDarkMode ? '#22C55E' : '#16A34A',
  };

  useEffect(() => {
    if (selectedCrop?.id) {
      fetchCropStages(selectedCrop?.id);
    }
  }, [selectedCrop?.id, fetchCropStages]);

  // Reset expanded stages when crop changes - close all stages when switching crops
  useEffect(() => {
    setExpandedStages([]);
  }, [selectedCrop?.id]);

  const renderStage = (stage: Stage) => {
    const isExpanded = expandedStages.includes(stage.stage_number);
    const description = typeof stage.description === 'string' ? { overview: stage.description } : stage.description;

    return (
      <View
        key={stage.stage_number}
        style={[styles.stageCard, { backgroundColor: colors.card }]}
      >
        <Image
          source={getStageImage(stage.stage_number)}
          style={styles.stageImage}
          resizeMode="cover"
        />

        <TouchableOpacity
          style={styles.stageHeader}
          onPress={() => {
            if (isExpanded) {
              // Remove from expanded stages
              setExpandedStages(expandedStages.filter(stageNum => stageNum !== stage.stage_number));
            } else {
              // Add to expanded stages
              setExpandedStages([...expandedStages, stage.stage_number]);
            }
          }}
        >
          <View style={styles.stageHeaderContent}>
            <Text style={[styles.stageNumber, { color: colors.primary }]}>
              {t('stages.stage', 'Stage {{number}}', { number: stage.stage_number })}
            </Text>
            <Text style={[styles.stageTitle, { color: colors.text }]}>
              {stage.title}
            </Text>
          </View>
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={RFValue(24)}
            color={colors.text}
          />
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.stageContent}>
            <Text style={[styles.overview, { color: colors.text }]}>
              {description.overview}
            </Text>

            {description.sub_steps && (
              <View style={styles.subSteps}>
                {Object.entries(description.sub_steps).map(([key, step]) => {
                  const subStep = typeof step === 'string' ? { title: key, description: step } : step;
                  return (
                    <View key={key} style={styles.subStep}>
                      <Text style={[styles.bulletText, { color: colors.primary }]}>
                        •
                      </Text>
                      <View style={styles.stepContent}>
                        <Text style={[styles.stepTitle, { color: colors.text }]}>
                          {subStep.title}
                        </Text>
                        <Text style={[styles.stepDescription, { color: colors.text }]}>
                          {subStep.description}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header with Back Button */}
      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={RFValue(24)} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {currentCrop ? `${t('stages.cropGrowthGuide')}` : `${t('stages.cropGrowthGuide')}`}
          </Text>
        </View>
      </View>

      {/* Content */}
      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
      >
        <CropSelectorDropdown
          selectSingle={true}
          onCropSelect={(crop) => {
            setSelectedCrop(crop);
            setShowCropSelect(false);
          }}
          defaultSelectedCrop={selectedCrop}
        />
        {/* Stages List */}
        {stageLoading.stages ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.success} />
          </View>
        ) : selectedCrop ? (
          stages.map(stage => renderStage(stage))
        ) : (
          <View style={styles.noCropContainer}>
            <Text style={[styles.noCropText, { color: colors.text }]}>
              {t('stages.selectCrop', 'Select a crop to view stages')}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('2%'),
    borderBottomWidth: 1,
  },
  backButton: {
    padding: wp('2%'),
    marginRight: wp('3%'),
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: RFValue(20),
    fontWeight: '600',
  },
  headerSubtitle: {
    fontSize: RFValue(14),
    fontWeight: '400',
    marginTop: hp('0.5%'),
  },
  content: {
    flex: 1,
    padding: wp('4%'),
  },
  cropSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: wp('4%'),
    borderRadius: wp('3%'),
    marginBottom: hp('2%'),
  },
  cropSelectorText: {
    fontSize: RFValue(16),
    fontWeight: '500',
  },
  stageCard: {
    marginBottom: hp('2%'),
    borderRadius: wp('3%'),
    padding: wp('4%'),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  stageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: hp('1%'),
  },
  stageHeaderContent: {
    flex: 1,
  },
  stageNumber: {
    fontSize: RFValue(14),
    fontWeight: '600',
    marginBottom: hp('0.5%'),
  },
  stageTitle: {
    fontSize: RFValue(16),
    fontWeight: '500',
  },
  stageContent: {
    padding: wp('4%'),
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  stageImage: {
    width: '100%',
    height: hp('20%'),
    borderRadius: wp('3%'),
    marginBottom: hp('2%'),
  },
  overview: {
    fontSize: RFValue(14),
    lineHeight: RFValue(20),
    marginBottom: hp('2%'),
  },
  subSteps: {
    marginBottom: hp('2%'),
  },
  subStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: hp('2%'),
  },
  bulletText: {
    fontSize: RFValue(16),
    fontWeight: '600',
    marginRight: wp('2%'),
    marginTop: hp('0.1%'),
  },

  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: RFValue(14),
    fontWeight: '600',
    marginBottom: hp('0.5%'),
  },
  stepDescription: {
    fontSize: RFValue(13),
    lineHeight: RFValue(18),
  },
  loadingContainer: {
    padding: wp('8%'),
    alignItems: 'center',
  },
  noCropContainer: {
    padding: wp('8%'),
    alignItems: 'center',
  },
  noCropText: {
    fontSize: RFValue(14),
    textAlign: 'center',
    opacity: 0.7,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: wp('85%'),
    maxHeight: hp('70%'),
    padding: wp('5%'),
    borderRadius: wp('3%'),
  },
  modalTitle: {
    fontSize: RFValue(18),
    fontWeight: '600',
    marginBottom: hp('2%'),
    textAlign: 'center',
  },
  cropOption: {
    paddingVertical: hp('2%'),
    borderBottomWidth: 1,
  },
  cropName: {
    fontSize: RFValue(16),
    fontWeight: '500',
  },
  varietyName: {
    fontSize: RFValue(14),
    opacity: 0.7,
    marginTop: hp('0.5%'),
  },
  closeButton: {
    marginTop: hp('2%'),
    padding: wp('3%'),
    borderRadius: wp('2%'),
    borderWidth: 1,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: RFValue(16),
    fontWeight: '500',
  },
  modalScrollView: {
    maxHeight: hp('60%'),
  },
  textSecondary: {
    opacity: 0.7,
  },
});

export default StageGuide; 