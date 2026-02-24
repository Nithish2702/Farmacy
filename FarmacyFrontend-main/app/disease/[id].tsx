import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { RFValue } from 'react-native-responsive-fontsize';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import diseaseService, { Disease, DiseaseDescription } from '../../api/diseaseService';
import { useTheme } from '@/context/theme';
import { useTranslation } from 'react-i18next';

const { width: screenWidth } = Dimensions.get('window');

interface DiseaseDetailData {
  overview: string;
  pathogen: string;
  disease_type: string;
  symptoms: string[];
  causes: string[];
  prevention: string[];
  treatment: string[];
  impact: string;
}

export default function DiseaseDetailScreen() {
  const router = useRouter();
  const { id, diseaseData } = useLocalSearchParams();
  const { colors, mode } = useTheme();
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  
  const [disease, setDisease] = useState<Disease | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [detailData, setDetailData] = useState<DiseaseDetailData | null>(null);

  useEffect(() => {
    const loadDiseaseData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        let diseaseInfo: Disease | null = null;
        
        // Try to get disease from params first
        if (diseaseData && typeof diseaseData === 'string') {
          try {
            diseaseInfo = JSON.parse(diseaseData);
          } catch (e) {
            console.log('Failed to parse disease data from params');
          }
        }
        
        // If no disease data in params, fetch from API
        if (!diseaseInfo && id) {
          const response = await diseaseService.getDiseaseById(Number(id), false);
          diseaseInfo = response;
        }
        
        if (diseaseInfo) {
          setDisease(diseaseInfo);
          console.log('Disease loaded:', diseaseInfo.name);
          console.log('Description type:', typeof diseaseInfo.description);
          console.log('Description content:', diseaseInfo.description);
          
          // Parse disease description data
          let descriptionData: DiseaseDescription | null = null;
          
          if (typeof diseaseInfo.description === 'object' && diseaseInfo.description !== null) {
            // Check if it's a direct DiseaseDescription object
            if ('overview' in diseaseInfo.description || 'symptoms' in diseaseInfo.description) {
              descriptionData = diseaseInfo.description as DiseaseDescription;
            } else {
              // It's a multi-language object - try current language first
              const currentLang = i18n.language || 'en';
              const multilangDesc = diseaseInfo.description as { [key: string]: DiseaseDescription };
              
              if (multilangDesc[currentLang]) {
                descriptionData = multilangDesc[currentLang];
              } else {
                // Fallback to first available language
                const availableLanguages = Object.keys(multilangDesc);
                if (availableLanguages.length > 0) {
                  descriptionData = multilangDesc[availableLanguages[0]];
                }
              }
            }
          }
          
          // Set the parsed data
          if (descriptionData) {
            const parsedData = {
              overview: descriptionData.overview || 'No overview available',
              pathogen: descriptionData.pathogen || 'Unknown pathogen',
              disease_type: descriptionData.disease_type || diseaseInfo.type || 'Unknown type',
              symptoms: Array.isArray(descriptionData.symptoms) ? descriptionData.symptoms : [],
              causes: Array.isArray(descriptionData.causes) ? descriptionData.causes : [],
              prevention: Array.isArray(descriptionData.prevention) ? descriptionData.prevention : [],
              treatment: Array.isArray(descriptionData.treatment) ? descriptionData.treatment : [],
              impact: descriptionData.impact || 'Impact information not available',
            };
            console.log('Setting detail data:', parsedData);
            setDetailData(parsedData);
          } else {
            // Fallback for string description or no description
            setDetailData({
              overview: typeof diseaseInfo.description === 'string' ? diseaseInfo.description : 'No description available',
              pathogen: 'Unknown pathogen',
              disease_type: diseaseInfo.type || 'Unknown type',
              symptoms: [],
              causes: [],
              prevention: [],
              treatment: [],
              impact: 'Impact information not available',
            });
          }
        } else {
          throw new Error('Disease not found');
        }
      } catch (err) {
        console.error('Error loading disease:', err);
        setError(err instanceof Error ? err.message : 'Failed to load disease information');
      } finally {
        setLoading(false);
      }
    };

    loadDiseaseData();
  }, [id, diseaseData, i18n.language]);

  const handleRetry = () => {
    if (id) {
      setError(null);
      setLoading(true);
      // Retry logic will be triggered by useEffect dependency
    }
  };

  const nextImage = () => {
    if (disease?.image_urls && disease.image_urls.length > 1) {
      setCurrentImageIndex((prev) => 
        prev === disease.image_urls!.length - 1 ? 0 : prev + 1
      );
    }
  };

  const prevImage = () => {
    if (disease?.image_urls && disease.image_urls.length > 1) {
      setCurrentImageIndex((prev) => 
        prev === 0 ? disease.image_urls!.length - 1 : prev - 1
      );
    }
  };

  const renderArraySection = (title: string, items: string[], icon: keyof typeof Ionicons.glyphMap) => {
    if (!items || items.length === 0) return null;
    
    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name={icon} size={RFValue(18)} color={colors.primary} />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
        </View>
        <View style={styles.sectionContent}>
          {items.map((item, index) => (
            <View key={index} style={styles.listItem}>
              <View style={[styles.bulletPoint, { backgroundColor: colors.primary }]} />
              <Text style={[styles.listItemText, { color: colors.text }]}>{item}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderTextSection = (title: string, content: string, icon: keyof typeof Ionicons.glyphMap) => {
    if (!content || content.trim() === '') return null;
    
    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name={icon} size={RFValue(18)} color={colors.primary} />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
        </View>
        <View style={styles.sectionContent}>
          <Text style={[styles.sectionText, { color: colors.text }]}>{content}</Text>
        </View>
      </View>
    );
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
    },
    loadingText: {
      marginTop: hp('2%'),
      fontSize: RFValue(16),
      color: colors.textSecondary,
      fontWeight: '500',
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: wp('8%'),
      backgroundColor: colors.background,
    },
    errorIcon: {
      marginBottom: hp('2%'),
    },
    errorTitle: {
      fontSize: RFValue(18),
      fontWeight: '700',
      color: colors.text,
      marginBottom: hp('1%'),
      textAlign: 'center',
    },
    errorText: {
      fontSize: RFValue(14),
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: RFValue(20),
      marginBottom: hp('3%'),
    },
    retryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: wp('6%'),
      paddingVertical: hp('1.5%'),
      borderRadius: wp('6%'),
      backgroundColor: colors.primary,
    },
    retryButtonText: {
      fontSize: RFValue(14),
      fontWeight: '600',
      color: colors.white,
      marginLeft: wp('2%'),
    },
    backButton: {
      position: 'absolute',
      top: insets.top + hp('1%'),
      left: wp('4%'),
      zIndex: 100,
      backgroundColor: 'rgba(0,0,0,0.5)',
      padding: wp('2.5%'),
      borderRadius: wp('6%'),
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: hp('5%'),
    },
    imageSection: {
      height: hp('35%'), // 35% of screen height
      backgroundColor: colors.card,
      position: 'relative',
    },
    imageContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    diseaseImage: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
    },
    placeholderImage: {
      width: '100%',
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.border,
    },
    imageNavigation: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      justifyContent: 'center',
      alignItems: 'center',
      width: wp('12%'),
    },
    navButtonLeft: {
      left: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    navButtonRight: {
      right: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    imageCounter: {
      position: 'absolute',
      bottom: hp('2%'),
      right: wp('4%'),
      backgroundColor: 'rgba(0,0,0,0.7)',
      paddingHorizontal: wp('3%'),
      paddingVertical: hp('0.8%'),
      borderRadius: wp('4%'),
    },
    imageCounterText: {
      fontSize: RFValue(12),
      color: colors.white,
      fontWeight: '600',
    },
    contentContainer: {
      paddingHorizontal: wp('4%'),
      paddingTop: hp('3%'),
    },
    diseaseHeader: {
      marginBottom: hp('3%'),
    },
    diseaseName: {
      fontSize: RFValue(24),
      fontWeight: '700',
      color: colors.text,
      marginBottom: hp('1%'),
    },
    diseaseTypeChip: {
      alignSelf: 'flex-start',
      paddingHorizontal: wp('3%'),
      paddingVertical: hp('0.8%'),
      borderRadius: wp('5%'),
      backgroundColor: colors.primary,
      marginBottom: hp('1%'),
    },
    diseaseTypeText: {
      fontSize: RFValue(12),
      fontWeight: '600',
      color: colors.white,
    },
    pathogenInfo: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    pathogenLabel: {
      fontSize: RFValue(13),
      fontWeight: '600',
      color: colors.textSecondary,
      marginRight: wp('2%'),
    },
    pathogenText: {
      fontSize: RFValue(13),
      color: colors.text,
      fontWeight: '500',
    },
    section: {
      marginBottom: hp('3%'),
      backgroundColor: colors.card,
      borderRadius: wp('3%'),
      padding: wp('4%'),
      borderWidth: 1,
      borderColor: colors.border,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: hp('1.5%'),
    },
    sectionTitle: {
      fontSize: RFValue(16),
      fontWeight: '700',
      marginLeft: wp('2%'),
    },
    sectionContent: {
      paddingLeft: wp('6%'),
    },
    sectionText: {
      fontSize: RFValue(14),
      lineHeight: RFValue(20),
      fontWeight: '400',
    },
    listItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: hp('1%'),
    },
    bulletPoint: {
      width: wp('1.5%'),
      height: wp('1.5%'),
      borderRadius: wp('0.75%'),
      marginTop: hp('0.8%'),
      marginRight: wp('3%'),
    },
    listItemText: {
      fontSize: RFValue(14),
      lineHeight: RFValue(20),
      fontWeight: '400',
      flex: 1,
    },
  });

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>
            {t('disease.loadingDetails', 'Loading disease details...')}
          </Text>
        </View>
      </View>
    );
  }

  if (error || !disease) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons 
            name="alert-circle-outline" 
            size={RFValue(64)} 
            color={colors.error} 
            style={styles.errorIcon}
          />
          <Text style={styles.errorTitle}>
            {t('disease.errorTitle', 'Disease Not Found')}
          </Text>
          <Text style={styles.errorText}>
            {error || t('disease.errorMessage', 'We couldn\'t load the disease information. Please try again.')}
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
            <Ionicons name="refresh" size={RFValue(18)} color={colors.white} />
            <Text style={styles.retryButtonText}>
              {t('common.retry', 'Try Again')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const hasImages = disease.image_urls && disease.image_urls.length > 0;
  const currentImage = hasImages ? disease.image_urls![currentImageIndex] : null;

  return (
    <View style={styles.container}>
      {/* Back Button */}
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={RFValue(24)} color={colors.white} />
      </TouchableOpacity>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Image Section at Top */}
        <View style={styles.imageSection}>
          <View style={styles.imageContainer}>
            {currentImage ? (
              <Image
                source={{ uri: currentImage }}
                style={styles.diseaseImage}
              />
            ) : (
              <View style={styles.placeholderImage}>
                <Ionicons name="leaf" size={RFValue(48)} color={colors.textSecondary} />
              </View>
            )}
          </View>

          {/* Image Navigation */}
          {hasImages && disease.image_urls!.length > 1 && (
            <>
              <TouchableOpacity
                style={[styles.imageNavigation, styles.navButtonLeft]}
                onPress={prevImage}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-back" size={RFValue(24)} color={colors.white} />
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.imageNavigation, styles.navButtonRight]}
                onPress={nextImage}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-forward" size={RFValue(24)} color={colors.white} />
              </TouchableOpacity>
              
              <View style={styles.imageCounter}>
                <Text style={styles.imageCounterText}>
                  {currentImageIndex + 1} / {disease.image_urls!.length}
                </Text>
              </View>
            </>
          )}
        </View>

        {/* Content Section */}
        <View style={styles.contentContainer}>
          {/* Disease Header */}
          <View style={styles.diseaseHeader}>
            <Text style={styles.diseaseName}>{disease.name}</Text>
            
            <View style={styles.diseaseTypeChip}>
              <Text style={styles.diseaseTypeText}>
                {detailData?.disease_type || disease.type}
              </Text>
            </View>
            
            {detailData?.pathogen && (
              <View style={styles.pathogenInfo}>
                <Text style={styles.pathogenLabel}>
                  {t('disease.pathogen', 'Pathogen')}:
                </Text>
                <Text style={styles.pathogenText}>{detailData.pathogen}</Text>
              </View>
            )}
          </View>

          {/* Overview */}
          {renderTextSection(
            t('disease.overview', 'Overview'),
            detailData?.overview || '',
            'information-circle'
          )}

          {/* Symptoms */}
          {renderArraySection(
            t('disease.symptoms', 'Symptoms'),
            detailData?.symptoms || [],
            'medical'
          )}

          {/* Causes */}
          {renderArraySection(
            t('disease.causes', 'Causes'),
            detailData?.causes || [],
            'bug'
          )}

          {/* Treatment */}
          {renderArraySection(
            t('disease.treatment', 'Treatment'),
            detailData?.treatment || [],
            'medical-outline'
          )}

          {/* Prevention */}
          {renderArraySection(
            t('disease.prevention', 'Prevention'),
            detailData?.prevention || [],
            'shield-checkmark'
          )}

          {/* Impact */}
          {renderTextSection(
            t('disease.impact', 'Impact'),
            detailData?.impact || '',
            'warning'
          )}
        </View>
      </ScrollView>
    </View>
  );
}