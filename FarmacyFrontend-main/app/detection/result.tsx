import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  Image,
  TouchableOpacity,
  Alert,
  Share,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import { RFValue } from 'react-native-responsive-fontsize';
import { useTheme } from '@/context/theme';
import predictionService, { PredictionResponse } from '@/api/predictionService';
import * as Speech from 'expo-speech';
import { useTranslation } from 'react-i18next';

const DetectionResult = () => {
  const router = useRouter();
  const navigation = useNavigation();
  const { colors, mode } = useTheme();
  const params = useLocalSearchParams();
  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const [predictionResult, setPredictionResult] = useState<PredictionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasAttempted, setHasAttempted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const { t } = useTranslation();

  const enhancedColors = {
    ...colors,
    success: mode === 'dark' ? '#22C55E' : '#16A34A',
    warning: mode === 'dark' ? '#F59E0B' : '#D97706',
    info: mode === 'dark' ? '#3B82F6' : '#2563EB',
    accent: mode === 'dark' ? '#EF4444' : '#DC2626',
    white: '#FFFFFF',
    secondary: mode === 'dark' ? '#059669' : '#15803D',
    healthy: '#10B981',
    diseased: '#EF4444',
    unknown: '#8B5CF6',
  };

  useEffect(() => {
    if (!hasAttempted && params.imageUri) {
      performPrediction();
    } else if (!params.imageUri) {
      setError('Missing image information');
      setIsAnalyzing(false);
    }
  }, [params, hasAttempted]);

  // Cleanup effect to stop speech when component unmounts
  useEffect(() => {
    return () => {
      // Always stop speech when component unmounts, regardless of state
      Speech.stop();
      setIsSpeaking(false);
    };
  }, []);

  // Handle screen focus changes - stop speech when screen loses focus
  useFocusEffect(
    React.useCallback(() => {
      return () => {
        // Always stop speech when screen loses focus, regardless of state
        Speech.stop();
        setIsSpeaking(false);
      };
    }, [])
  );

  const performPrediction = async () => {
    try {
      setIsAnalyzing(true);
      setError(null);
      setHasAttempted(true);
      
      console.log('Starting prediction with:', {
        imageUri: params.imageUri,
        cropName: params.cropName
      });
      
      const result = await predictionService.predictPlantDisease(
        params.imageUri as string,
        params.cropName as string || undefined
      );
      
      console.log('Prediction result:', JSON.stringify(result, null, 2));
      
      if (!result || 
          typeof result.prediction_id !== 'string' ||
          typeof result.crop_name !== 'string' ||
          typeof result.query !== 'string' ||
          typeof result.analysis !== 'string' ||
          typeof result.overall_confidence_score !== 'number' ||
          !Array.isArray(result.other_possible_diseases) ||
          !Array.isArray(result.general_recommendations) ||
          !['HEALTHY', 'DISEASED', 'UNKNOWN'].includes(result.status)) {
        console.error('Invalid prediction result structure:', result);
        throw new Error('Invalid prediction result received');
      }
      
      setPredictionResult(result);
    } catch (error) {
      console.error('Prediction error:', error);
      setError('Failed to analyze the image. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'HEALTHY':
        return enhancedColors.healthy;
      case 'DISEASED':
        return enhancedColors.diseased;
      case 'UNKNOWN':
        return enhancedColors.unknown;
      default:
        return enhancedColors.textSecondary;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'HEALTHY':
        return 'checkmark-circle';
      case 'DISEASED':
        return 'warning';
      case 'UNKNOWN':
        return 'help-circle';
      default:
        return 'help-circle';
    }
  };

  const handleShare = async () => {
    try {
      if (!predictionResult) return;

      // Get primary disease info
      const primaryDisease = predictionResult.primary_disease;
      const primaryDiseaseName = primaryDisease?.name || 'No disease detected';
      
      // Get confidence score
      const confidence = predictionResult.overall_confidence_score;
      
      // Get crop name
      const cropName = predictionResult.crop_name || 'Unknown crop';

      const shareMessage = `
🌿 Plant Health Analysis Report 🌿

Crop: ${cropName}
Status: ${predictionResult.status}
Confidence: ${Math.round(confidence * 100)}%

📊 Analysis:
${predictionResult.analysis}

${primaryDisease ? `🔍 Primary Disease:
• ${primaryDisease.name} (${Math.round(primaryDisease.confidence * 100)}% confidence)

💊 Treatment:
${primaryDisease.treatment.map(t => `• ${t}`).join('\n')}

🌱 Fertilizer Recommendations:
${primaryDisease.fertilizer_recommendations.map(f => `• ${f}`).join('\n')}` : '✅ Plant appears healthy'}

💡 General Recommendations:
${(predictionResult.general_recommendations || []).map(rec => `• ${rec}`).join('\n')}

Shared via Farmacy App
`;

      const shareOptions = {
        title: 'Share Plant Health Report',
        message: shareMessage,
        url: params.imageUri as string,
      };

      const result = await Share.share(shareOptions);
      
      if (result.action === Share.sharedAction) {
        if (result.activityType) {
          console.log('Shared with activity type:', result.activityType);
        } else {
          console.log('Shared successfully');
        }
      }
    } catch (error) {
      console.error('Error sharing:', error);
      Alert.alert('Error', 'Failed to share the report. Please try again.');
    }
  };

  const handleTextToSpeech = async () => {
    try {
      if (!predictionResult) return;

      if (isSpeaking) {
        Speech.stop();
        setIsSpeaking(false);
        return;
      }

      setIsSpeaking(true);
      
      let speechText = `Plant analysis result for ${predictionResult.crop_name}. `;
      
      if (predictionResult.status === 'DISEASED' && predictionResult.primary_disease) {
        speechText += `Disease detected: ${predictionResult.primary_disease.name}. `;
        speechText += `Confidence: ${Math.round(predictionResult.primary_disease.confidence * 100)} percent. `;
        
        if (predictionResult.primary_disease.symptoms.length > 0) {
          speechText += `Symptoms: ${predictionResult.primary_disease.symptoms.join(', ')}. `;
        }
        
        if (predictionResult.primary_disease.causes.length > 0) {
          speechText += `Causes: ${predictionResult.primary_disease.causes.join(', ')}. `;
        }
        
        if (predictionResult.primary_disease.treatment.length > 0) {
          speechText += `Treatment: ${predictionResult.primary_disease.treatment.join(', ')}. `;
        }
      } else if (predictionResult.status === 'HEALTHY') {
        speechText += `Plant appears healthy. `;
      } else {
        speechText += `Plant status: ${predictionResult.status}. `;
      }
      
      speechText += predictionResult.analysis;

      await Speech.speak(speechText, {
        onDone: () => setIsSpeaking(false),
        onStopped: () => setIsSpeaking(false),
        onError: () => setIsSpeaking(false),
      });
    } catch (error) {
      console.error('Text-to-speech error:', error);
      setIsSpeaking(false);
    }
  };

  const renderHeader = () => (
    <View style={[styles.header, { backgroundColor: enhancedColors.background, borderBottomColor: enhancedColors.border }]}>
              <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            // Stop any ongoing speech before navigation
            Speech.stop();
            setIsSpeaking(false);
            router.replace('/(tabs)');
          }}
        >
        <Ionicons name="arrow-back" size={RFValue(22)} color={enhancedColors.text} />
      </TouchableOpacity>
      <Text style={[styles.headerTitle, { color: enhancedColors.text }]}>Analysis Result</Text>
      <View style={styles.headerRight}>
        {!isAnalyzing && !error && predictionResult && (
          <>
            <TouchableOpacity
              style={styles.speechButton}
              onPress={handleTextToSpeech}
            >
              <Ionicons 
                name={isSpeaking ? "stop-circle" : "volume-high"} 
                size={RFValue(22)} 
                color={isSpeaking ? enhancedColors.accent : enhancedColors.primary} 
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.shareButton}
              onPress={handleShare}
            >
              <Ionicons name="share-outline" size={RFValue(22)} color={enhancedColors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={performPrediction}
            >
              <Ionicons name="refresh" size={RFValue(20)} color={enhancedColors.primary} />
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );

  const renderCapturedImage = () => (
    <View style={[styles.imageSection, { backgroundColor: enhancedColors.card }]}>
      <Text style={[styles.sectionTitle, { color: enhancedColors.text }]}>Captured Image</Text>
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: params.imageUri as string }}
          style={styles.capturedImage}
          resizeMode="cover"
        />
      </View>
      {/* Display crop name prominently below image - from API response */}
      {predictionResult?.crop_name && (
        <View style={[styles.cropNameSection, { backgroundColor: enhancedColors.primary + '20' }]}>
          <Text style={[styles.cropNameText, { color: enhancedColors.primary }]}>
            {predictionResult.crop_name}
          </Text>
        </View>
      )}
    </View>
  );

  const renderLoadingState = () => (
    <View style={[styles.loadingContainer, { backgroundColor: enhancedColors.card }]}>
      <ActivityIndicator size="large" color={enhancedColors.primary} />
      <Text style={[styles.loadingText, { color: enhancedColors.text }]}>
        {t('detection.analyzing')}
      </Text>
      <Text style={[styles.subLoadingText, { color: enhancedColors.textSecondary }]}>
        {t('detection.examiningImage')}
      </Text>
    </View>
  );

  const renderErrorState = () => (
    <View style={[styles.errorContainer, { backgroundColor: enhancedColors.card }]}>
      <Ionicons name="alert-circle" size={RFValue(48)} color={enhancedColors.accent} />
      <Text style={[styles.errorTitle, { color: enhancedColors.text }]}>Analysis Failed</Text>
      <Text style={[styles.errorText, { color: enhancedColors.textSecondary }]}>
        {error}
      </Text>
      <TouchableOpacity
        style={[styles.retryButtonFull, { backgroundColor: enhancedColors.primary }]}
        onPress={performPrediction}
      >
        <Text style={[styles.retryButtonText, { color: enhancedColors.white }]}>
          Try Again
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderDiseaseCard = (disease: any, index: number) => (
    <View key={index} style={[styles.diseaseCard, { backgroundColor: enhancedColors.card, borderColor: enhancedColors.border }]}>
      <View style={styles.diseaseHeader}>
        <View style={styles.diseaseInfo}>
          <Text style={[styles.diseaseName, { color: enhancedColors.text }]}>
            {disease.name}
          </Text>
          <View style={[styles.confidenceBadge, { backgroundColor: enhancedColors.primary + '20' }]}>
            <Text style={[styles.confidenceText, { color: enhancedColors.primary }]}>
              {Math.round(disease.confidence * 100)}% confidence
            </Text>
          </View>
        </View>
      </View>
      <Text style={[styles.diseaseDescription, { color: enhancedColors.textSecondary }]}>
        {disease.description}
      </Text>
    </View>
  );

  const renderPredictionResult = () => {
    if (!predictionResult) {
      console.log('No prediction result available');
      return null;
    }

    console.log('Rendering prediction result:', predictionResult);
    
    const statusColor = getStatusColor(predictionResult.status);
    const statusIcon = getStatusIcon(predictionResult.status);

    return (
      <ScrollView style={styles.resultContainer}>
        {/* Primary Disease - Prominently displayed at top */}
        {predictionResult.status === 'DISEASED' && predictionResult.primary_disease && (
          <View style={[styles.primaryDiseaseCard, { backgroundColor: enhancedColors.card }]}>
            <View style={styles.primaryDiseaseHeader}>
              <View style={[styles.diseaseIcon, { backgroundColor: enhancedColors.accent + '20' }]}>
                <Ionicons name="warning" size={RFValue(28)} color={enhancedColors.accent} />
              </View>
              <View style={styles.primaryDiseaseInfo}>
                <Text style={[styles.primaryDiseaseName, { color: enhancedColors.accent }]}>
                  {predictionResult.primary_disease.name}
                </Text>
                <View style={[styles.confidenceBadge, { backgroundColor: enhancedColors.accent + '20' }]}>
                  <Text style={[styles.confidenceText, { color: enhancedColors.accent }]}>
                    {Math.round(predictionResult.primary_disease.confidence * 100)}% confidence
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Status Overview for Healthy/Unknown */}
        {(predictionResult.status === 'HEALTHY' || predictionResult.status === 'UNKNOWN') && (
          <View style={[styles.statusCard, { backgroundColor: enhancedColors.card }]}>
            <View style={styles.statusHeader}>
              <View style={[styles.statusIcon, { backgroundColor: statusColor + '20' }]}>
                <Ionicons name={statusIcon} size={RFValue(24)} color={statusColor} />
              </View>
              <View style={styles.statusInfo}>
                <Text style={[styles.statusTitle, { color: enhancedColors.text }]}>
                  Plant Status
                </Text>
                <Text style={[styles.statusValue, { color: statusColor }]}>
                  {predictionResult.status}
                </Text>
              </View>
              <View style={[styles.confidenceScore, { backgroundColor: enhancedColors.primary + '20' }]}>
                <Text style={[styles.confidenceScoreText, { color: enhancedColors.primary }]}>
                  {Math.round(predictionResult.overall_confidence_score * 100)}%
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Analysis */}
        <View style={[styles.analysisCard, { backgroundColor: enhancedColors.card }]}>
          <View style={styles.analysisHeader}>
            <Ionicons name="analytics" size={RFValue(20)} color={enhancedColors.primary} />
            <Text style={[styles.analysisTitle, { color: enhancedColors.text }]}>
              AI Analysis
            </Text>
          </View>
          <Text style={[styles.analysisText, { color: enhancedColors.textSecondary }]}>
            {predictionResult.analysis}
          </Text>
        </View>

        {/* Disease Details - Symptoms, Causes, Treatment */}
        {predictionResult.status === 'DISEASED' && predictionResult.primary_disease && (
          <>
            {/* Symptoms */}
            {predictionResult.primary_disease.symptoms && predictionResult.primary_disease.symptoms.length > 0 && (
              <View style={[styles.diseaseDetailCard, { backgroundColor: enhancedColors.card }]}>
                <View style={styles.diseaseDetailHeader}>
                  <Ionicons name="eye" size={RFValue(20)} color={enhancedColors.info} />
                  <Text style={[styles.diseaseDetailTitle, { color: enhancedColors.text }]}>
                    Symptoms
                  </Text>
                </View>
                {predictionResult.primary_disease.symptoms.map((symptom, index) => (
                  <View key={`symptom-${index}`} style={[styles.detailItem, styles.detailItemSpaced]}>
                    <View style={[styles.detailBullet, { backgroundColor: enhancedColors.info }]} />
                    <Text style={[styles.detailText, { color: enhancedColors.text }]}>
                      {symptom}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Causes */}
            {predictionResult.primary_disease.causes && predictionResult.primary_disease.causes.length > 0 && (
              <View style={[styles.diseaseDetailCard, { backgroundColor: enhancedColors.card }]}>
                <View style={styles.diseaseDetailHeader}>
                  <Ionicons name="help-circle" size={RFValue(20)} color={enhancedColors.warning} />
                  <Text style={[styles.diseaseDetailTitle, { color: enhancedColors.text }]}>
                    Causes
                  </Text>
                </View>
                {predictionResult.primary_disease.causes.map((cause, index) => (
                  <View key={`cause-${index}`} style={[styles.detailItem, styles.detailItemSpaced]}>
                    <View style={[styles.detailBullet, { backgroundColor: enhancedColors.warning }]} />
                    <Text style={[styles.detailText, { color: enhancedColors.text }]}>
                      {cause}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Treatment */}
            {predictionResult.primary_disease.treatment && predictionResult.primary_disease.treatment.length > 0 && (
              <View style={[styles.diseaseDetailCard, { backgroundColor: enhancedColors.card }]}>
                <View style={styles.diseaseDetailHeader}>
                  <Ionicons name="medical" size={RFValue(20)} color={enhancedColors.success} />
                  <Text style={[styles.diseaseDetailTitle, { color: enhancedColors.text }]}>
                    Treatment
                  </Text>
                </View>
                {predictionResult.primary_disease.treatment.map((treatment, index) => (
                  <View key={`treatment-${index}`} style={[styles.detailItem, styles.detailItemSpaced]}>
                    <View style={[styles.detailBullet, { backgroundColor: enhancedColors.success }]} />
                    <Text style={[styles.detailText, { color: enhancedColors.text }]}>
                      {treatment}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Fertilizer Recommendations */}
            {predictionResult.primary_disease.fertilizer_recommendations && predictionResult.primary_disease.fertilizer_recommendations.length > 0 && (
              <View style={[styles.diseaseDetailCard, { backgroundColor: enhancedColors.card }]}>
                <View style={styles.diseaseDetailHeader}>
                  <Ionicons name="leaf" size={RFValue(20)} color={enhancedColors.secondary} />
                  <Text style={[styles.diseaseDetailTitle, { color: enhancedColors.text }]}>
                    Fertilizer Recommendations
                  </Text>
                </View>
                {predictionResult.primary_disease.fertilizer_recommendations.map((fertilizer, index) => (
                  <View key={`fertilizer-${index}`} style={[styles.detailItem, styles.detailItemSpaced]}>
                    <View style={[styles.detailBullet, { backgroundColor: enhancedColors.secondary }]} />
                    <Text style={[styles.detailText, { color: enhancedColors.text }]}>
                      {fertilizer}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Prevention Tips */}
            {predictionResult.primary_disease.prevention_tips && predictionResult.primary_disease.prevention_tips.length > 0 && (
              <View style={[styles.diseaseDetailCard, { backgroundColor: enhancedColors.card }]}>
                <View style={styles.diseaseDetailHeader}>
                  <Ionicons name="shield-checkmark" size={RFValue(20)} color={enhancedColors.info} />
                  <Text style={[styles.diseaseDetailTitle, { color: enhancedColors.text }]}>
                    Prevention Tips
                  </Text>
                </View>
                {predictionResult.primary_disease.prevention_tips.map((tip, index) => (
                  <View key={`prevention-${index}`} style={[styles.detailItem, styles.detailItemSpaced]}>
                    <View style={[styles.detailBullet, { backgroundColor: enhancedColors.info }]} />
                    <Text style={[styles.detailText, { color: enhancedColors.text }]}>
                      {tip}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {/* Other Possible Diseases */}
        {predictionResult.other_possible_diseases && predictionResult.other_possible_diseases.length > 0 && (
          <View style={[styles.otherDiseasesCard, { backgroundColor: enhancedColors.card }]}>
            <View style={styles.otherDiseasesHeader}>
              <Ionicons name="list" size={RFValue(20)} color={enhancedColors.textSecondary} />
              <Text style={[styles.otherDiseasesTitle, { color: enhancedColors.text }]}>
                Other Possible Diseases
              </Text>
            </View>
            {predictionResult.other_possible_diseases.map((disease, index) => (
              <View key={`other-disease-${index}`} style={[styles.otherDiseaseItem, { borderColor: enhancedColors.border }]}>
                <View style={styles.otherDiseaseHeader}>
                  <Text style={[styles.otherDiseaseName, { color: enhancedColors.text }]}>
                    {disease.name}
                  </Text>
                  <View style={[styles.confidenceBadge, { backgroundColor: enhancedColors.textSecondary + '20' }]}>
                    <Text style={[styles.confidenceText, { color: enhancedColors.textSecondary }]}>
                      {Math.round(disease.confidence * 100)}%
                    </Text>
                  </View>
                </View>
                {disease.symptoms && disease.symptoms.length > 0 && (
                  <Text style={[styles.otherDiseaseSymptoms, { color: enhancedColors.textSecondary }]}>
                    Symptoms: {disease.symptoms.join(', ')}
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* General Recommendations */}
        {predictionResult.general_recommendations && predictionResult.general_recommendations.length > 0 && (
          <View style={[styles.recommendationsCard, { backgroundColor: enhancedColors.card }]}>
            <View style={styles.recommendationsHeader}>
              <Ionicons name="bulb" size={RFValue(20)} color={enhancedColors.success} />
              <Text style={[styles.recommendationsTitle, { color: enhancedColors.text }]}>
                General Farming Tips
              </Text>
            </View>
            {predictionResult.general_recommendations.map((recommendation, index) => (
              <View key={`general-rec-${index}`} style={[styles.recommendationItem, styles.detailItemSpaced]}>
                <View style={[styles.recommendationBullet, { backgroundColor: enhancedColors.success }]} />
                <Text style={[styles.recommendationText, { color: enhancedColors.text }]}>
                  {recommendation}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: enhancedColors.primary }]}
            onPress={() => {
              navigation.reset({
               index: 0,
                routes: [{ name: '(tabs)' as never }],
              });
              router.push('/detection');
            }}
          >
            <Ionicons name="camera" size={RFValue(16)} color={enhancedColors.white} />
            <Text style={[styles.actionButtonText, { color: enhancedColors.white }]}>
              Analyze Another
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionButtonSecondary, { borderColor: enhancedColors.border }]}
            onPress={() => router.push('/history')}
          >
            <Ionicons name="time" size={RFValue(16)} color={enhancedColors.text} />
            <Text style={[styles.actionButtonSecondaryText, { color: enhancedColors.text }]}>
              View History
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: enhancedColors.background }]}>
      {renderHeader()}
      
      {/* Always show captured image */}
      {params.imageUri && renderCapturedImage()}
      
      {/* Show loading, error, or results based on state */}
      {isAnalyzing && renderLoadingState()}
      {error && !isAnalyzing && renderErrorState()}
      {!isAnalyzing && !error && predictionResult && renderPredictionResult()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('1.5%'),
    borderBottomWidth: 0.5,
  },
  backButton: {
    padding: wp('2%'),
  },
  headerTitle: {
    fontSize: RFValue(18),
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  retryButton: {
    padding: wp('2%'),
  },
  speechButton: {
    padding: wp('2%'),
  },
  imageSection: {
    margin: wp('4%'),
    borderRadius: wp('4%'),
    padding: wp('4%'),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: RFValue(16),
    fontWeight: '600',
    marginBottom: hp('1%'),
  },
  imageContainer: {
    position: 'relative',
    alignItems: 'center',
  },
  capturedImage: {
    width: wp('80%'),
    height: hp('25%'),
    borderRadius: wp('3%'),
  },
  cropNameSection: {
    marginTop: hp('1%'),
    paddingHorizontal: wp('3%'),
    paddingVertical: hp('1%'),
    borderRadius: wp('4%'),
    alignItems: 'center',
  },
  cropNameText: {
    fontSize: RFValue(18),
    fontWeight: '700',
    textAlign: 'center',
  },
  loadingContainer: {
    margin: wp('4%'),
    borderRadius: wp('4%'),
    padding: wp('8%'),
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  loadingText: {
    fontSize: RFValue(18),
    fontWeight: '600',
    marginTop: hp('2%'),
    textAlign: 'center',
  },
  subLoadingText: {
    fontSize: RFValue(14),
    marginTop: hp('1%'),
    textAlign: 'center',
  },
  errorContainer: {
    margin: wp('4%'),
    borderRadius: wp('4%'),
    padding: wp('8%'),
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  errorTitle: {
    fontSize: RFValue(18),
    fontWeight: '600',
    marginTop: hp('2%'),
    textAlign: 'center',
  },
  errorText: {
    fontSize: RFValue(14),
    marginTop: hp('1%'),
    marginBottom: hp('3%'),
    textAlign: 'center',
  },
  retryButtonFull: {
    paddingHorizontal: wp('8%'),
    paddingVertical: hp('1.5%'),
    borderRadius: wp('3%'),
  },
  retryButtonText: {
    fontSize: RFValue(16),
    fontWeight: '600',
  },
  resultContainer: {
    flex: 1,
    paddingHorizontal: wp('4%'),
  },
  statusCard: {
    borderRadius: wp('4%'),
    padding: wp('4%'),
    marginBottom: hp('2%'),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIcon: {
    width: wp('12%'),
    height: wp('12%'),
    borderRadius: wp('6%'),
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: wp('3%'),
  },
  statusInfo: {
    flex: 1,
  },
  statusTitle: {
    fontSize: RFValue(14),
    fontWeight: '500',
  },
  statusValue: {
    fontSize: RFValue(18),
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  confidenceScore: {
    paddingHorizontal: wp('3%'),
    paddingVertical: hp('0.5%'),
    borderRadius: wp('3%'),
  },
  confidenceScoreText: {
    fontSize: RFValue(14),
    fontWeight: '600',
  },
  analysisCard: {
    borderRadius: wp('4%'),
    padding: wp('4%'),
    marginBottom: hp('2%'),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  analysisHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp('1%'),
  },
  analysisTitle: {
    fontSize: RFValue(16),
    fontWeight: '600',
    marginLeft: wp('2%'),
  },
  analysisText: {
    fontSize: RFValue(14),
    lineHeight: RFValue(20),
  },
  diseasesSection: {
    borderRadius: wp('4%'),
    padding: wp('4%'),
    marginBottom: hp('2%'),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  diseasesSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp('2%'),
  },
  diseasesSectionTitle: {
    fontSize: RFValue(16),
    fontWeight: '600',
    marginLeft: wp('2%'),
  },
  diseaseCard: {
    borderRadius: wp('3%'),
    padding: wp('3%'),
    marginBottom: hp('1.5%'),
    borderWidth: 1,
  },
  diseaseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: hp('1%'),
  },
  diseaseInfo: {
    flex: 1,
  },
  diseaseName: {
    fontSize: RFValue(16),
    fontWeight: '600',
    marginBottom: hp('0.5%'),
  },
  confidenceBadge: {
    paddingHorizontal: wp('2%'),
    paddingVertical: hp('0.3%'),
    borderRadius: wp('2%'),
    alignSelf: 'flex-start',
  },
  confidenceText: {
    fontSize: RFValue(12),
    fontWeight: '600',
  },
  diseaseDescription: {
    fontSize: RFValue(14),
    lineHeight: RFValue(18),
  },
  recommendationsCard: {
    borderRadius: wp('4%'),
    padding: wp('4%'),
    marginBottom: hp('2%'),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  recommendationsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp('2%'),
  },
  recommendationsTitle: {
    fontSize: RFValue(16),
    fontWeight: '600',
    marginLeft: wp('2%'),
  },
  recommendationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: hp('1%'),
  },
  recommendationBullet: {
    width: wp('2%'),
    height: wp('2%'),
    borderRadius: wp('1%'),
    marginTop: hp('0.8%'),
    marginRight: wp('3%'),
  },
  recommendationText: {
    fontSize: RFValue(14),
    lineHeight: RFValue(20),
    flex: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: wp('3%'),
    marginBottom: hp('3%'),
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: hp('1.5%'),
    borderRadius: wp('3%'),
    gap: wp('2%'),
  },
  actionButtonText: {
    fontSize: RFValue(14),
    fontWeight: '600',
  },
  actionButtonSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: hp('1.5%'),
    borderRadius: wp('3%'),
    borderWidth: 1,
    gap: wp('2%'),
  },
  actionButtonSecondaryText: {
    fontSize: RFValue(14),
    fontWeight: '600',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp('2%'),
  },
  shareButton: {
    padding: wp('2%'),
  },
  primaryDiseaseCard: {
    borderRadius: wp('4%'),
    padding: wp('4%'),
    marginBottom: hp('2%'),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryDiseaseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  diseaseIcon: {
    width: wp('12%'),
    height: wp('12%'),
    borderRadius: wp('6%'),
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: wp('3%'),
  },
  primaryDiseaseInfo: {
    flex: 1,
  },
  primaryDiseaseName: {
    fontSize: RFValue(16),
    fontWeight: '600',
    marginBottom: hp('0.5%'),
  },
  diseaseDetailCard: {
    borderRadius: wp('4%'),
    padding: wp('4%'),
    marginBottom: hp('2%'),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  diseaseDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp('1%'),
  },
  diseaseDetailTitle: {
    fontSize: RFValue(16),
    fontWeight: '600',
    marginLeft: wp('2%'),
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: hp('1%'),
  },
  detailItemSpaced: {
    marginBottom: hp('1.5%'),
  },
  detailBullet: {
    width: wp('2%'),
    height: wp('2%'),
    borderRadius: wp('1%'),
    marginRight: wp('3%'),
    marginTop: hp('0.3%'),
  },
  detailText: {
    fontSize: RFValue(14),
    lineHeight: RFValue(20),
  },
  otherDiseasesCard: {
    borderRadius: wp('4%'),
    padding: wp('4%'),
    marginBottom: hp('2%'),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  otherDiseasesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp('2%'),
  },
  otherDiseasesTitle: {
    fontSize: RFValue(16),
    fontWeight: '600',
    marginLeft: wp('2%'),
  },
  otherDiseaseItem: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: wp('3%'),
    borderRadius: wp('3%'),
    marginBottom: hp('1%'),
  },
  otherDiseaseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: hp('0.5%'),
  },
  otherDiseaseName: {
    fontSize: RFValue(16),
    fontWeight: '600',
  },
  otherDiseaseSymptoms: {
    fontSize: RFValue(14),
    lineHeight: RFValue(20),
  },
});

export default DetectionResult;