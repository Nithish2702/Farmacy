import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
  Share,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/context/theme';
import predictionService, { PredictionHistory } from '../../api/predictionService';
import { format } from 'date-fns';
import * as Speech from 'expo-speech';

const { width } = Dimensions.get('window');

export default function PredictionDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { t } = useTranslation();
  const { mode } = useTheme();
  const isDarkMode = mode === 'dark';

  const [prediction, setPrediction] = useState<PredictionHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    loadPredictionDetails();
  }, [id]);

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

  const loadPredictionDetails = async () => {
    try {
      const data = await predictionService.getPredictionById(Number(id));
      setPrediction(data);
      setError(null);
    } catch (err) {
      setError(t('errors.loadPredictionDetails'));
      console.error('Error loading prediction details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!prediction) return;

    try {
      const result = prediction.prediction_result;
      const primaryDisease = result?.primary_disease;
      const confidence = result?.overall_confidence_score || 0;
      const cropName = result?.crop_name || 'Unknown Crop';
      const status = result?.status || 'Unknown';
      const analysis = result?.analysis || '';
      const date = prediction.created_at ? format(new Date(prediction.created_at), 'MMM dd, yyyy') : 'Date unknown';
      const otherDiseases = result?.other_possible_diseases || [];
      const generalRecommendations = result?.general_recommendations || [];

      let shareMessage = `\n🌿 Plant Health Analysis Report 🌿\n\n`;
      shareMessage += `Crop: ${cropName}\n`;
      shareMessage += `Status: ${status}\n`;
      shareMessage += `Confidence: ${Math.round(confidence * 100)}%\n`;
      shareMessage += `Date: ${date}\n`;
      shareMessage += `\n📊 Analysis:\n${analysis}\n`;

      if (primaryDisease) {
        shareMessage += `\n🔍 Primary Disease:\n`;
        shareMessage += `• ${primaryDisease.name} (${Math.round((primaryDisease.confidence || 0) * 100)}% confidence)\n`;
        if (primaryDisease.symptoms && primaryDisease.symptoms.length > 0) {
          shareMessage += `\nSymptoms:\n${primaryDisease.symptoms.map((s) => `• ${s}`).join('\n')}\n`;
        }
        if (primaryDisease.causes && primaryDisease.causes.length > 0) {
          shareMessage += `\nCauses:\n${primaryDisease.causes.map((c) => `• ${c}`).join('\n')}\n`;
        }
        if (primaryDisease.treatment && primaryDisease.treatment.length > 0) {
          shareMessage += `\nTreatment:\n${primaryDisease.treatment.map((t) => `• ${t}`).join('\n')}\n`;
        }
        if (primaryDisease.fertilizer_recommendations && primaryDisease.fertilizer_recommendations.length > 0) {
          shareMessage += `\nFertilizer Recommendations:\n${primaryDisease.fertilizer_recommendations.map((f) => `• ${f}`).join('\n')}\n`;
        }
        if (primaryDisease.prevention_tips && primaryDisease.prevention_tips.length > 0) {
          shareMessage += `\nPrevention Tips:\n${primaryDisease.prevention_tips.map((p) => `• ${p}`).join('\n')}\n`;
        }
      } else if (status === 'HEALTHY') {
        shareMessage += `\n✅ Plant appears healthy`;
      }

      if (otherDiseases.length > 0) {
        shareMessage += `\n\n🦠 Other Possible Diseases:\n`;
        otherDiseases.forEach((disease: any) => {
          shareMessage += `• ${disease.name} (${Math.round((disease.confidence || 0) * 100)}% confidence)`;
          if (disease.symptoms && disease.symptoms.length > 0) {
            shareMessage += `\n  Symptoms: ${disease.symptoms.join(', ')}`;
          }
          shareMessage += `\n`;
        });
      }

      if (generalRecommendations.length > 0) {
        shareMessage += `\n💡 General Recommendations:\n${generalRecommendations.map((rec) => `• ${rec}`).join('\n')}\n`;
      }

      shareMessage += `\nShared via Farmacy App`;
      
      await Share.share({
        message: shareMessage,
        url: prediction.image_url,
      });
    } catch (error) {
      console.error('Error sharing prediction:', error);
    }
  };

  const handleTextToSpeech = async () => {
    try {
      if (!prediction) return;

      if (isSpeaking) {
        Speech.stop();
        setIsSpeaking(false);
        return;
      }

      setIsSpeaking(true);
      
      let speechText = `Historical plant analysis for ${prediction.prediction_result?.crop_name}. `;
      
      if (prediction.prediction_result?.status === 'DISEASED' && prediction.prediction_result?.primary_disease) {
        speechText += `Disease detected: ${prediction.prediction_result.primary_disease.name}. `;
        speechText += `Confidence: ${Math.round(prediction.prediction_result.primary_disease.confidence * 100)} percent. `;
        
        if (prediction.prediction_result.primary_disease.symptoms?.length > 0) {
          speechText += `Symptoms: ${prediction.prediction_result.primary_disease.symptoms.join(', ')}. `;
        }
        
        if (prediction.prediction_result.primary_disease.causes?.length > 0) {
          speechText += `Causes: ${prediction.prediction_result.primary_disease.causes.join(', ')}. `;
        }
        
        if (prediction.prediction_result.primary_disease.treatment?.length > 0) {
          speechText += `Treatment: ${prediction.prediction_result.primary_disease.treatment.join(', ')}. `;
        }
      } else if (prediction.prediction_result?.status === 'HEALTHY') {
        speechText += `Plant appears healthy. `;
      } else {
        speechText += `Plant status: ${prediction.prediction_result?.status}. `;
      }
      
      if (prediction.prediction_result?.analysis) {
        speechText += prediction.prediction_result.analysis;
      }

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

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: isDarkMode ? '#1F2937' : '#F9FAFB' }]}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  if (error || !prediction) {
    return (
      <View style={[styles.container, { backgroundColor: isDarkMode ? '#1F2937' : '#F9FAFB' }]}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
          <Text style={[styles.errorText, { color: isDarkMode ? '#F9FAFB' : '#111827' }]}>
            {error || t('errors.predictionNotFound')}
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: '#10B981' }]}
            onPress={loadPredictionDetails}
          >
            <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: isDarkMode ? '#1F2937' : '#F9FAFB' }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            // Stop any ongoing speech before navigation
            Speech.stop();
            setIsSpeaking(false);
            router.back();
          }}
        >
          <Ionicons
            name="arrow-back"
            size={24}
            color={isDarkMode ? '#F9FAFB' : '#111827'}
          />
        </TouchableOpacity>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.speechButton}
            onPress={handleTextToSpeech}
          >
            <Ionicons 
              name={isSpeaking ? "stop-circle" : "volume-high"} 
              size={24} 
              color={isSpeaking ? '#EF4444' : (isDarkMode ? '#F9FAFB' : '#111827')} 
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.shareButton}
            onPress={handleShare}
          >
            <Ionicons
              name="share-outline"
              size={24}
              color={isDarkMode ? '#F9FAFB' : '#111827'}
            />
          </TouchableOpacity>
        </View>
      </View>

      <Image
        source={{ uri: prediction.image_url }}
        style={styles.image}
        resizeMode="cover"
      />

      <View style={[styles.content, { backgroundColor: isDarkMode ? '#374151' : '#FFFFFF' }]}>
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: isDarkMode ? '#F9FAFB' : '#111827' }]}>
            {t('history.title')}
          </Text>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: isDarkMode ? '#D1D5DB' : '#4B5563' }]}>
              {t('history.crop')}
            </Text>
            <Text style={[styles.detailValue, { color: isDarkMode ? '#F9FAFB' : '#111827' }]}>
              {prediction.prediction_result?.crop_name}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: isDarkMode ? '#D1D5DB' : '#4B5563' }]}>
              Status
            </Text>
            <Text style={[styles.detailValue, { color: isDarkMode ? '#F9FAFB' : '#111827' }]}>
              {prediction.prediction_result?.status || 'Unknown'}
            </Text>
          </View>
          {(prediction.prediction_result?.primary_disease) && (
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: isDarkMode ? '#D1D5DB' : '#4B5563' }]}>
                Primary Disease
              </Text>
              <Text style={[styles.detailValue, { color: isDarkMode ? '#F9FAFB' : '#111827' }]}>
                {(prediction.prediction_result?.primary_disease)?.name}
              </Text>
            </View>
          )}
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: isDarkMode ? '#D1D5DB' : '#4B5563' }]}>
              {t('history.confidence')}
            </Text>
            <View style={styles.confidenceContainer}>
              <Ionicons name="analytics-outline" size={16} color="#10B981" />
              <Text style={styles.confidenceScore}>
                {Math.round((prediction.prediction_result?.overall_confidence_score || 0) * 100)}%
              </Text>
            </View>
          </View>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: isDarkMode ? '#D1D5DB' : '#4B5563' }]}>
              {t('history.date')}
            </Text>
            <Text style={[styles.detailValue, { color: isDarkMode ? '#F9FAFB' : '#111827' }]}>
              {prediction.created_at ? format(new Date(prediction.created_at), 'MMM dd, yyyy HH:mm') : 'Date unknown'}
            </Text>
          </View>
        </View>

        {/* Analysis Section */}
        {prediction.prediction_result?.analysis && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: isDarkMode ? '#F9FAFB' : '#111827' }]}>AI Analysis</Text>
            <Text style={[styles.recommendationText, { color: isDarkMode ? '#D1D5DB' : '#4B5563' }]}> 
              {prediction.prediction_result.analysis}
            </Text>
          </View>
        )}

        {/* Disease Details */}
        {(() => {
          const primaryDisease = prediction.prediction_result?.primary_disease;
          if (!primaryDisease) return null;
          return (
            <>
              {/* Symptoms */}
              {primaryDisease.symptoms && primaryDisease.symptoms.length > 0 && (
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: isDarkMode ? '#F9FAFB' : '#111827' }]}>Symptoms</Text>
                  {primaryDisease.symptoms.map((symptom: string, index: number) => (
                    <View key={`symptom-${index}`} style={styles.recommendationItem}>
                      <Ionicons name="eye" size={20} color="#3B82F6" />
                      <Text style={[styles.recommendationText, { color: isDarkMode ? '#D1D5DB' : '#4B5563' }]}>
                        {symptom}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
              {/* Causes */}
              {primaryDisease.causes && primaryDisease.causes.length > 0 && (
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: isDarkMode ? '#F9FAFB' : '#111827' }]}>Causes</Text>
                  {primaryDisease.causes.map((cause: string, index: number) => (
                    <View key={`cause-${index}`} style={styles.recommendationItem}>
                      <Ionicons name="help-circle" size={20} color="#F59E0B" />
                      <Text style={[styles.recommendationText, { color: isDarkMode ? '#D1D5DB' : '#4B5563' }]}>
                        {cause}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
              {/* Treatment */}
              {primaryDisease.treatment && primaryDisease.treatment.length > 0 && (
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: isDarkMode ? '#F9FAFB' : '#111827' }]}>Treatment</Text>
                  {primaryDisease.treatment.map((treatment: string, index: number) => (
                    <View key={`treatment-${index}`} style={styles.recommendationItem}>
                      <Ionicons name="medical" size={20} color="#10B981" />
                      <Text style={[styles.recommendationText, { color: isDarkMode ? '#D1D5DB' : '#4B5563' }]}>
                        {treatment}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
              {/* Fertilizer Recommendations */}
              {primaryDisease.fertilizer_recommendations && primaryDisease.fertilizer_recommendations.length > 0 && (
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: isDarkMode ? '#F9FAFB' : '#111827' }]}>Fertilizer Recommendations</Text>
                  {primaryDisease.fertilizer_recommendations.map((fertilizer: string, index: number) => (
                    <View key={`fertilizer-${index}`} style={styles.recommendationItem}>
                      <Ionicons name="leaf" size={20} color="#059669" />
                      <Text style={[styles.recommendationText, { color: isDarkMode ? '#D1D5DB' : '#4B5563' }]}>
                        {fertilizer}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
              {/* Prevention Tips */}
              {primaryDisease.prevention_tips && primaryDisease.prevention_tips.length > 0 && (
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: isDarkMode ? '#F9FAFB' : '#111827' }]}>Prevention Tips</Text>
                  {primaryDisease.prevention_tips.map((tip: string, index: number) => (
                    <View key={`prevention-${index}`} style={styles.recommendationItem}>
                      <Ionicons name="shield-checkmark" size={20} color="#3B82F6" />
                      <Text style={[styles.recommendationText, { color: isDarkMode ? '#D1D5DB' : '#4B5563' }]}>
                        {tip}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </>
          );
        })()}

        {/* General Recommendations */}
        {prediction.prediction_result?.general_recommendations && prediction.prediction_result.general_recommendations.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: isDarkMode ? '#F9FAFB' : '#111827' }]}>
              General Farming Tips
            </Text>
            {prediction.prediction_result.general_recommendations.map((recommendation: string, index: number) => (
              <View key={`general-rec-${index}`} style={styles.recommendationItem}>
                <Ionicons name="bulb" size={20} color="#10B981" />
                <Text style={[styles.recommendationText, { color: isDarkMode ? '#D1D5DB' : '#4B5563' }]}>
                  {recommendation}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Fallback to legacy recommendations */}
        {(!prediction.prediction_result?.general_recommendations || prediction.prediction_result.general_recommendations.length === 0) && 
          (prediction.prediction_result?.general_recommendations) && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: isDarkMode ? '#F9FAFB' : '#111827' }]}>
              {t('detection.results.recommendations')}
            </Text>
            {(prediction.prediction_result?.general_recommendations || []).map((recommendation: string, index: number) => (
              <View key={`legacy-rec-${index}`} style={styles.recommendationItem}>
                <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                <Text style={[styles.recommendationText, { color: isDarkMode ? '#D1D5DB' : '#4B5563' }]}>
                  {recommendation}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  shareButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  speechButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: width,
    height: width,
  },
  content: {
    flex: 1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -24,
    padding: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 14,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  confidenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  confidenceScore: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '500',
  },
  recommendationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  recommendationText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  placeholderImage: {
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  diseaseItem: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  diseaseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  diseaseName: {
    fontSize: 16,
    fontWeight: '600',
  },
  diseaseConfidence: {
    fontSize: 14,
    fontWeight: '500',
  },
  diseaseSymptoms: {
    fontSize: 14,
    lineHeight: 20,
  },
}); 