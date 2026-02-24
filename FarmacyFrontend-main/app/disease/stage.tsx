import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { RFValue } from 'react-native-responsive-fontsize';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import diseaseService, { Disease } from '../../api/diseaseService';
import { useTheme } from '@/context/theme';
import { useTranslation } from 'react-i18next';

export default function StageDiseasesScreen() {
  const router = useRouter();
  const { colors, mode } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  
  const cropId = params.cropId ? parseInt(params.cropId as string) : null;
  const stageNumber = params.stageNumber ? parseInt(params.stageNumber as string) : null;
  const stageTitle = params.stageTitle as string;
  
  const [diseases, setDiseases] = useState<Disease[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStageDiseases = useCallback(async () => {
    if (!cropId || !stageNumber) {
      console.log('[STAGE DISEASES] Missing cropId or stageNumber:', { cropId, stageNumber });
      setError('Invalid crop or stage information');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      console.log(`[STAGE DISEASES] Loading diseases for crop ${cropId}, stage ${stageNumber}`);
      
      const data = await diseaseService.getStageDiseases(cropId, stageNumber, false);
      console.log(`[STAGE DISEASES] API Response:`, data);
      
      if (data && Array.isArray(data)) {
        setDiseases(data);
        console.log(`[STAGE DISEASES] Loaded ${data.length} diseases`);
      } else {
        console.log('[STAGE DISEASES] Invalid response format');
        setDiseases([]);
      }
    } catch (err) {
      console.error('[STAGE DISEASES] Error loading stage diseases:', err);
      setError(err instanceof Error ? err.message : 'Failed to load diseases');
      setDiseases([]);
    } finally {
      setLoading(false);
    }
  }, [cropId, stageNumber]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadStageDiseases();
    setRefreshing(false);
  }, [loadStageDiseases]);

  useEffect(() => {
    console.log('[STAGE DISEASES] Component mounted with params:', { cropId, stageNumber, stageTitle });
    loadStageDiseases();
  }, [loadStageDiseases]);

  // Remove the default header by setting navigation options if using expo-router
  // For expo-router, use the following at the top level of the component:
  // @ts-ignore
  StageDiseasesScreen.options = { headerShown: false };

  const getImageUrl = (disease: Disease): string | undefined => {
    return disease.image_urls && disease.image_urls.length > 0 
      ? disease.image_urls[0] 
      : undefined;
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
      alignItems: 'center',
      marginBottom: hp('1%'),
    },
    backButton: {
      marginRight: wp('3%'),
      padding: wp('1%'),
    },
    headerTitle: {
      fontSize: RFValue(20),
      fontWeight: '700',
      color: colors.text,
      flex: 1,
    },
    stageInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: wp('2%'),
    },
    stageIcon: {
      width: wp('8%'),
      height: wp('8%'),
      borderRadius: wp('4%'),
      backgroundColor: colors.primary + '20',
      alignItems: 'center',
      justifyContent: 'center',
    },
    stageTitle: {
      fontSize: RFValue(16),
      fontWeight: '600',
      color: colors.text,
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
    diseasesGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
    },
    diseaseCard: {
      width: wp('45%'),
      marginBottom: hp('2%'),
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
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={RFValue(24)} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {t('disease.stageDiseases', 'Stage Diseases')}
          </Text>
        </View>
        
        <View style={styles.stageInfo}>
          <View style={styles.stageIcon}>
            <Ionicons 
              name="leaf-outline" 
              size={RFValue(20)} 
              color={colors.primary} 
            />
          </View>
          <Text style={styles.stageTitle}>
            {stageTitle || `Stage ${stageNumber}`}
          </Text>
        </View>
      </View>

      {/* Content */}
      <View style={styles.contentContainer}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <View style={styles.loadingContent}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>
                {t('disease.loadingDiseases', 'Loading diseases')}...
              </Text>
            </View>
          </View>
        ) : error ? (
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
              onPress={loadStageDiseases}
            >
              <Ionicons name="refresh" size={RFValue(16)} color={colors.white} />
              <Text style={styles.retryButtonText}>
                {t('common.retry', 'Retry')}
              </Text>
            </TouchableOpacity>
          </View>
        ) : !diseases || diseases.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons 
              name="medical-outline" 
              size={RFValue(64)} 
              color={colors.textSecondary}
              style={styles.emptyIcon}
            />
            <Text style={styles.emptyTitle}>
              {t('disease.noDiseasesFound', 'No Diseases Found')}
            </Text>
            <Text style={styles.emptyText}>
              {t('disease.noDiseasesForStage', 'No diseases have been recorded for this stage yet.')}
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
            <View style={styles.diseasesGrid}>
              {diseases.map((disease, index) => renderDiseaseCard(disease, index))}
            </View>
          </ScrollView>
        )}
      </View>
    </View>
  );
} 