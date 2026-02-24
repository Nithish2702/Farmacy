import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Platform,
  ScrollView,
  RefreshControl,
  Animated,
  Easing,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { RFValue } from 'react-native-responsive-fontsize';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import diseaseService, { Disease, CropStageDiseases } from '../../api/diseaseService';
import { cropService, Crop } from '../../api/cropService';
import CropSelectorDropdown from '@/components/CropSelectorDropDown';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '@/context/theme';
import { useTranslation } from 'react-i18next';
import { useCropsContext } from '@/context/CropsContext';

export default function DiseaseListScreen() {
  const router = useRouter();
  const { colors, mode } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { currentCrop: contextCurrentCrop, crops, loading: cropsLoading } = useCropsContext();
  
  const [selectedCrop, setSelectedCrop] = useState<Crop | null>(null);
  const [cropStageDiseases, setCropStageDiseases] = useState<CropStageDiseases | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [lastLoadedCropId, setLastLoadedCropId] = useState<number | null>(null);

  // Enhanced loadDiseasesByStage with better error handling and caching
  const loadDiseasesByStage = useCallback(async (crop: Crop, forceRefresh: boolean = false) => {
    if (!crop || !crop.id) {
      console.log('[DISEASE SCREEN] No valid crop provided for disease loading');
      return;
    }

    // Skip loading if we already have data for this crop and not forcing refresh
    if (!forceRefresh && lastLoadedCropId === crop.id && cropStageDiseases) {
      console.log(`[DISEASE SCREEN] Skipping load - already have data for crop ${crop.name}`);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      console.log(`[DISEASE SCREEN] Loading diseases by stage for crop: ${crop.name} (ID: ${crop.id})`);
      
      const data = await diseaseService.getDiseasesByStage(crop.id, forceRefresh);
      console.log(`[DISEASE SCREEN] API Response:`, data);
      
      if (data && data.stages) {
        setCropStageDiseases(data);
        setLastLoadedCropId(crop.id);
        console.log(`[DISEASE SCREEN] Loaded ${data.stages.length} stages with diseases`);
      } else {
        console.log('[DISEASE SCREEN] No stages data received');
        setCropStageDiseases(null);
        setLastLoadedCropId(null);
      }
    } catch (err) {
      console.error('[DISEASE SCREEN] Error loading diseases by stage:', err);
      setError(err instanceof Error ? err.message : 'Failed to load diseases');
      setCropStageDiseases(null);
      setLastLoadedCropId(null);
    } finally {
      setLoading(false);
    }
  }, [cropStageDiseases, lastLoadedCropId]);

  // Initialize with default crop - enhanced logic with proper priority
  useEffect(() => {
    if (!selectedCrop && contextCurrentCrop) {
      setSelectedCrop(contextCurrentCrop);
      if (!cropStageDiseases || lastLoadedCropId !== contextCurrentCrop.id) {
        loadDiseasesByStage(contextCurrentCrop);
      }
    }
  }, []);

  // Enhanced crop selection handler
  const handleCropSelect = useCallback((crop: Crop | null) => {
    console.log('[DISEASE SCREEN] Crop selection changed:', crop?.name || 'null');
    
    if (crop) {
      setSelectedCrop(crop);
      // Force refresh when manually selecting a crop
      loadDiseasesByStage(crop, true);
    } else {
      setSelectedCrop(null);
      setCropStageDiseases(null);
      setLastLoadedCropId(null);
    }
  }, [loadDiseasesByStage]);

  // Enhanced refresh handler
  const onRefresh = useCallback(async () => {
    if (selectedCrop) {
      console.log('[DISEASE SCREEN] Refreshing diseases for crop:', selectedCrop.name);
      setRefreshing(true);
      try {
        await loadDiseasesByStage(selectedCrop, true);
      } catch (error) {
        console.error('[DISEASE SCREEN] Error refreshing diseases:', error);
      } finally {
        setRefreshing(false);
      }
    }
  }, [selectedCrop, loadDiseasesByStage]);

  // Enhanced focus effect
  useFocusEffect(
    React.useCallback(() => {
      if (
        selectedCrop &&
        (!cropStageDiseases || lastLoadedCropId !== selectedCrop.id)
      ) {
        loadDiseasesByStage(selectedCrop);
      }
    }, [selectedCrop, cropStageDiseases, lastLoadedCropId, loadDiseasesByStage])
  );

  const getImageUrl = (disease: Disease): string | undefined => {
    return disease.image_urls && disease.image_urls.length > 0 
      ? disease.image_urls[0] 
      : undefined;
  };

  const getStageIcon = (stageNumber: number): keyof typeof Ionicons.glyphMap => {
    // Return different icons based on stage number
    switch (stageNumber) {
      case 1: return 'leaf-outline'; // Seedling
      case 2: return 'flower-outline'; // Vegetative
      case 3: return 'trending-up-outline'; // Flowering
      case 4: return 'fitness-outline'; // Fruiting
      case 5: return 'checkmark-circle-outline'; // Maturity
      case 6: return 'leaf-outline'; // Harvesting
      case 7: return 'leaf-outline'; // Post-harvest
      case 8: return 'leaf-outline'; // Storage
      default: return 'leaf-outline';
    }
  };

  const renderDiseaseCard = (disease: Disease, index: number) => {
    const imageUrl = getImageUrl(disease);
    
    return (
      <TouchableOpacity
        key={`disease-${disease.id}-${index}`}
        style={[styles.diseaseCard, { 
          backgroundColor: colors.card, 
          borderColor: colors.border,
        }]}
        onPress={() => router.push({
          pathname: '/disease/[id]' as const,
          params: { 
            id: disease.id,
            diseaseData: JSON.stringify(disease) 
          }
        })}
        activeOpacity={0.7}
      >
        <Image
          source={imageUrl ? { uri: imageUrl } : require('@/assets/default-crop.png')}
          style={styles.diseaseCardImage}
          resizeMode="cover"
        />
        <View style={styles.diseaseCardContent}>
          <Text style={[styles.diseaseType, { color: colors.textSecondary }]}>
            {disease.type}
          </Text>
          <Text style={[styles.diseaseName, { color: colors.text }]} numberOfLines={2}>
            {disease.name}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderStageSection = (stage: any) => {
    if (!stage.diseases || stage.diseases.length === 0) return null;
    return (
      <View key={`stage-${stage.stage_number}`} style={styles.stageSection}>
        <View style={styles.stageHeader}>
          <View style={styles.stageTitleButtonRow}>
            <View style={styles.stageTitleContainer}>
              <Ionicons 
                name={getStageIcon(stage.stage_number)} 
                size={RFValue(16)} 
                color={colors.primary} 
                style={{ marginRight: 6 }}
              />
              <Text style={styles.stageTitle} numberOfLines={2} ellipsizeMode="tail">
                {stage.stage_title}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.viewAllButton}
              onPress={() => {
                router.push({
                  pathname: '/disease/stage' as const,
                  params: { 
                    cropId: selectedCrop?.id,
                    stageNumber: stage.stage_number,
                    stageTitle: stage.stage_title
                  }
                });
              }}
            >
              <Text style={[styles.viewAllText, { color: colors.primary }]}>{t('disease.viewAll')}</Text>
            </TouchableOpacity>
          </View>
        </View>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.diseaseCardsContainer}
        >
          {stage.diseases.map((disease: Disease, index: number) => 
            renderDiseaseCard(disease, index)
          )}
        </ScrollView>
      </View>
    );
  };

  // Defensive check for API response
  const isValidCropStageDiseases = cropStageDiseases && typeof cropStageDiseases === 'object' && Array.isArray(cropStageDiseases.stages);
  const stagesWithDiseases = isValidCropStageDiseases
    ? cropStageDiseases.stages.filter((stage: any) => Array.isArray(stage.diseases) && stage.diseases.length > 0)
    : [];

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      paddingTop: insets.top + hp('2%'),
      paddingHorizontal: wp('4%'),
      paddingBottom: hp('2%'),
      backgroundColor: colors.background,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: hp('1%'),
    },
    headerLeft: {
      flex: 1,
      marginRight: wp('3%'),
    },
    headerTitle: {
      fontSize: RFValue(24),
      fontWeight: '700',
      color: colors.text,
      marginBottom: hp('0.5%'),
    },
    headerSubtitle: {
      fontSize: RFValue(14),
      color: colors.textSecondary,
      fontWeight: '500',
    },
    cropSelectorContainer: {
      width: wp('42%'),
      flexShrink: 0,
    },
    contentContainer: {
      flex: 1,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
    },
    loadingContent: {
      alignItems: 'center',
    },
    loadingText: {
      fontSize: RFValue(14),
      color: colors.textSecondary,
      marginTop: hp('1%'),
      fontWeight: '500',
    },
    scrollView: {
      flex: 1,
    },
    scrollViewContent: {
      paddingTop: hp('2%'),
      paddingHorizontal: wp('4%'),
      paddingBottom: hp('10%'),
    },
    mainTitle: {
      fontSize: RFValue(20),
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      marginBottom: hp('1%'),
    },
    mainDescription: {
      fontSize: RFValue(14),
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: hp('3%'),
      lineHeight: RFValue(20),
    },
    stageSection: {
      marginBottom: hp('3%'),
    },
    stageHeader: {
      paddingBottom: hp('1%'),
    },
    stageTitleButtonRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
    },
    stageTitleContainer: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      flex: 1,
      minWidth: 0,
      marginRight: 8,
    },
    stageTitle: {
      color: colors.text,
      fontSize: RFValue(15),
      fontWeight: '700',
      flexShrink: 1,
      flexWrap: 'wrap',
      minWidth: 0,
    },
    viewAllButton: {
      alignSelf: 'flex-start',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      marginTop: 2,
    },
    viewAllText: {
      fontSize: RFValue(13),
      fontWeight: '600',
    },
    diseaseCardsContainer: {
      paddingRight: wp('4%'),
    },
    diseaseCard: {
      width: wp('35%'),
      marginRight: wp('3%'),
      borderRadius: wp('3%'),
      borderWidth: 1,
      overflow: 'hidden',
    },
    diseaseCardImage: {
      width: '100%',
      height: hp('15%'),
    },
    diseaseCardContent: {
      padding: wp('3%'),
    },
    diseaseType: {
      fontSize: RFValue(10),
      fontWeight: '600',
      marginBottom: hp('0.5%'),
      textTransform: 'uppercase',
    },
    diseaseName: {
      fontSize: RFValue(12),
      fontWeight: '600',
      lineHeight: RFValue(16),
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: wp('8%'),
    },
    emptyIcon: {
      marginBottom: hp('2%'),
    },
    emptyTitle: {
      fontSize: RFValue(18),
      fontWeight: '700',
      color: colors.text,
      marginBottom: hp('1%'),
      textAlign: 'center',
    },
    emptyText: {
      fontSize: RFValue(14),
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: RFValue(20),
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: wp('8%'),
    },
    errorIcon: {
      marginBottom: hp('2%'),
    },
    errorTitle: {
      fontSize: RFValue(18),
      fontWeight: '700',
      color: colors.error,
      marginBottom: hp('1%'),
      textAlign: 'center',
    },
    errorText: {
      fontSize: RFValue(14),
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: RFValue(20),
      marginBottom: hp('2%'),
    },
    retryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primary,
      paddingHorizontal: wp('4%'),
      paddingVertical: hp('1%'),
      borderRadius: wp('6%'),
    },
    retryButtonText: {
      fontSize: RFValue(12),
      fontWeight: '600',
      color: colors.white,
      marginLeft: wp('1%'),
    },
    stickyButtonContainer: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: Platform.OS === 'ios' ? hp('2%') : hp('1%'),
      paddingHorizontal: wp('6%'),
      paddingBottom: Platform.OS === 'ios' ? hp('2%') : hp('1%'),
      backgroundColor: 'transparent',
      zIndex: 100,
    },
    stickyButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: wp('6%'),
      paddingVertical: hp('1.5%'),
      paddingHorizontal: wp('2%'),
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      backgroundColor: colors.primary,
    },
    stickyButtonText: {
      color: '#fff',
      fontWeight: '700',
      fontSize: RFValue(15),
    },
    dotLoaderContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 6,
    },
    dot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.primary,
    },
    bottomLoaderOverlay: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: 'center',
      paddingVertical: 18,
      // Use dynamic background color with opacity
      backgroundColor: colors.background + (colors.background.length === 7 ? 'D9' : ''), // ~85% opacity
      zIndex: 200,
    },
    bottomLoaderText: {
      fontSize: RFValue(13),
      color: colors.textSecondary,
      marginTop: 2,
    },
    topLoaderContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 18,
      // Use dynamic background color with opacity
      backgroundColor: colors.background + (colors.background.length === 7 ? 'D9' : ''), // ~85% opacity
    },
    topLoaderText: {
      fontSize: RFValue(13),
      color: colors.textSecondary,
      marginTop: 2,
    },
  });

  // Debug logging
  console.log('[DISEASE SCREEN] Render state:', {
    selectedCrop: selectedCrop?.name,
    selectedCropId: selectedCrop?.id,
    cropStageDiseases: cropStageDiseases?.stages?.length || 0,
    stagesWithDiseases: stagesWithDiseases.length || 0,
    loading,
    error,
    initialized,
    contextCurrentCrop: contextCurrentCrop?.name,
    cropsCount: crops.length,
    cropsLoading,
    lastLoadedCropId
  });

  const ActionButton = () => (
    <View style={styles.stickyButtonContainer}>
      <TouchableOpacity
        style={styles.stickyButton}
        onPress={() => router.push('/detection')}
        activeOpacity={0.85}
      >
        <Ionicons name="search" size={RFValue(18)} color={colors.white} style={{ marginRight: 8 }} />
        <Text style={styles.stickyButtonText}>{t('disease.startDiagnosis')}</Text>
      </TouchableOpacity>
    </View>
  );

  const [dotAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    if (loading) {
      Animated.loop(
        Animated.timing(dotAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    } else {
      dotAnim.stopAnimation();
      dotAnim.setValue(0);
    }
  }, [loading]);

  const renderDotLoader = () => {
    // Animated three dots
    const dot1 = dotAnim.interpolate({ inputRange: [0, 0.33, 1], outputRange: [0.2, 1, 0.2] });
    const dot2 = dotAnim.interpolate({ inputRange: [0, 0.33, 0.66, 1], outputRange: [0.2, 0.2, 1, 0.2] });
    const dot3 = dotAnim.interpolate({ inputRange: [0, 0.66, 1], outputRange: [0.2, 0.2, 1] });
    return (
      <View style={styles.dotLoaderContainer}>
        <Animated.View style={[styles.dot, { opacity: dot1 }]} />
        <Animated.View style={[styles.dot, { opacity: dot2, marginHorizontal: 6 }]} />
        <Animated.View style={[styles.dot, { opacity: dot3 }]} />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>{t('disease.title', 'Pests & diseases')}</Text>
            <Text style={styles.headerSubtitle}>
              {t('disease.subtitle', 'See relevant information on')}
            </Text>
          </View>
          <View style={styles.cropSelectorContainer}>
            <CropSelectorDropdown
              isDarkMode={mode === 'dark'}
              selectSingle={true}
              onCropSelect={handleCropSelect}
              defaultSelectedCrop={selectedCrop ? { id: selectedCrop.id, name: selectedCrop.name } : undefined}
            />
          </View>
        </View>
      </View>

      {/* Always show Diseases By Stage title/desc at top */}
      <View style={{ paddingHorizontal: wp('4%'), paddingTop: hp('2%'), backgroundColor: colors.background }}>
        <Text style={styles.mainTitle}>
          {t('disease.diseasesByStage', 'Diseases By Stage')}
        </Text>
        <Text style={styles.mainDescription}>
          {t('disease.diseasesByStageDescription', 'All pests and diseases that might appear in your crop at different stages.')}
        </Text>
      </View>

      {/* Loader: show below title/desc if loading */}
      {loading && (
        <View style={styles.topLoaderContainer}>
          {renderDotLoader()}
          <Text style={styles.topLoaderText}>{t('disease.loadingData')}</Text>
        </View>
      )}

      {/* Content */}
      <View style={styles.contentContainer}>
        {error ? (
          <View style={styles.errorContainer}>
            <Ionicons 
              name="alert-circle-outline" 
              size={RFValue(64)} 
              color={colors.error}
              style={styles.errorIcon}
            />
            <Text style={styles.errorTitle}>
              {t('common.error', 'Error')}
            </Text>
            <Text style={styles.errorText}>
              {error}
            </Text>
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={() => {
                if (selectedCrop) {
                  setError(null);
                  loadDiseasesByStage(selectedCrop, true);
                }
              }}
            >
              <Ionicons name="refresh" size={RFValue(16)} color={colors.white} />
              <Text style={styles.retryButtonText}>
                {t('common.retry', 'Retry')}
              </Text>
            </TouchableOpacity>
          </View>
        ) : !selectedCrop ? (
          <View style={styles.emptyContainer}>
            <Ionicons 
              name="leaf-outline" 
              size={RFValue(64)} 
              color={colors.textSecondary}
              style={styles.emptyIcon}
            />
            <Text style={styles.emptyTitle}>
              {t('disease.selectCrop', 'Select a Crop')}
            </Text>
            <Text style={styles.emptyText}>
              {t('disease.selectCropDescription', 'Choose a crop from the dropdown above to view its diseases organized by growth stages.')}
            </Text>
          </View>
        ) : !loading && (!isValidCropStageDiseases || stagesWithDiseases.length === 0) ? (
          <View style={styles.emptyContainer}>
            <Ionicons 
              name="medical-outline" 
              size={RFValue(64)} 
              color={colors.textSecondary}
              style={styles.emptyIcon}
            />
            <Text style={styles.emptyTitle}>
              {t('disease.noDiseasesData', 'This crop has no diseases data, select another.')}
            </Text>
          </View>
        ) : (
          <ScrollView 
            style={styles.scrollView}
            contentContainerStyle={styles.scrollViewContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[colors.primary]}
                tintColor={colors.primary}
              />
            }
          >
            {stagesWithDiseases.map((stage) => renderStageSection(stage))}
          </ScrollView>
        )}
        {/* Modern loader overlay at bottom if loading and we have data */}
        {loading && isValidCropStageDiseases && stagesWithDiseases.length > 0 && (
          <View style={styles.bottomLoaderOverlay}>
            {renderDotLoader()}
            <Text style={styles.bottomLoaderText}>{t('disease.updatingData')}</Text>
          </View>
        )}
      </View>
      {/* Sticky action button always at bottom */}
      <ActionButton />
    </View>
  );
}