import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/context/theme';
import predictionService, { PredictionHistory } from '../../api/predictionService';
import { format } from 'date-fns';

const { width } = Dimensions.get('window');

export default function PredictionHistoryScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { mode, colors } = useTheme();
  const isDarkMode = mode === 'dark';
  
  // Enhanced color palette based on current theme
  const themeColors = {
    ...colors,
    success: mode === 'dark' ? '#22C55E' : '#16A34A',
    warning: mode === 'dark' ? '#F59E0B' : '#D97706',
    info: mode === 'dark' ? '#3B82F6' : '#2563EB',
    accent: mode === 'dark' ? '#EF4444' : '#DC2626',
    white: '#FFFFFF',
    secondary: mode === 'dark' ? '#059669' : '#15803D',
  };

  const [predictions, setPredictions] = useState<PredictionHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadPredictions = async (refresh = false, pageNumber?: number) => {
    try {
      if (refresh) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      const currentPage = refresh ? 0 : (pageNumber ?? page);
      const skip = currentPage * 10;
      const response = await predictionService.getPredictionHistory(skip, 10);
      
      if (refresh) {
        setPredictions(response.predictions);
        setPage(0);
      } else {
        setPredictions(prev => [...prev, ...response.predictions]);
        setPage(currentPage);
      }
      
      setHasMore(response.predictions.length === response.limit);
      setError(null);
    } catch (err) {
      setError(t('errors.loadPredictions'));
      console.error('Error loading predictions:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadPredictions(true);
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadPredictions(true);
  }, []);

  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      const nextPage = page + 1;
      loadPredictions(false, nextPage);
    }
  }, [loadingMore, hasMore, page]);

  const renderPredictionItem = useCallback(({ item, index }: { item: PredictionHistory; index: number }) => (
    <TouchableOpacity
      style={[styles.predictionCard, { backgroundColor: themeColors.card }]}
      onPress={() => router.push(`/history/${item.id || item.prediction_id}`)}
    >
      {item.image_url ? (
        <Image
          source={{ uri: item.image_url }}
          style={styles.predictionImage}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.predictionImage, styles.placeholderImage]}>
          <Ionicons name="image-outline" size={32} color="#9CA3AF" />
        </View>
      )}
      <View style={styles.predictionInfo}>
        <View style={styles.predictionHeader}>
          <Text style={[styles.cropName, { color: themeColors.text }]}>
            {item.prediction_result.crop_name || 'Unknown Crop'}
          </Text>
          <View style={[styles.statusBadge, { 
            backgroundColor: item.prediction_result.status === 'DISEASED' ? 
              (isDarkMode ? '#7F1D1D' : '#FEF2F2') : 
              item.prediction_result.status === 'HEALTHY' ? 
              (isDarkMode ? '#14532D' : '#F0FDF4') : 
              (isDarkMode ? '#374151' : '#F3F4F6')
          }]}>
            <Text style={[styles.statusText, { 
              color: item.prediction_result.status === 'DISEASED' ? '#DC2626' : 
                     item.prediction_result.status === 'HEALTHY' ? '#059669' : '#6B7280'
            }]}>
              {item.prediction_result.status}
            </Text>
          </View>
        </View>

        {/* Disease Name - Prominent for diseased plants */}
        {item.prediction_result.status === 'DISEASED' && item.prediction_result.primary_disease && (
          <Text style={[styles.primaryDiseaseName, { color: themeColors.accent }]}>
            {item.prediction_result.primary_disease.name}
          </Text>
        )}

        {/* Quick Preview of Symptoms */}
        {item.prediction_result.status === 'DISEASED' && item.prediction_result.primary_disease?.symptoms && (
          <Text style={[styles.symptomPreview, { color: themeColors.textSecondary }]} numberOfLines={1}>
            {item.prediction_result.primary_disease.symptoms[0]}
          </Text>
        )}

        <View style={styles.predictionMeta}>
          <Text style={[styles.date, { color: themeColors.textSecondary }]}>
            {item.created_at ? format(new Date(item.created_at), 'MMM dd, yyyy') : 'Date unknown'}
          </Text>
          <View style={styles.confidenceContainer}>
            <Ionicons name="analytics-outline" size={16} color={themeColors.success} />
            <Text style={[styles.confidenceScore, { color: themeColors.success }]}>
              {Math.round(item.prediction_result.overall_confidence_score * 100)}% 
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  ), [themeColors, router]);

  const renderFooter = useCallback(() => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={themeColors.success} />
      </View>
    );
  }, [loadingMore, themeColors.success]);

  const renderEmpty = useCallback(() => {
    if (loading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="leaf-outline" size={48} color={themeColors.textSecondary} />
        <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
          {error || t('history.noHistory')}
        </Text>
      </View>
    );
  }, [loading, error, themeColors.textSecondary, t]);

  const keyExtractor = useCallback((item: PredictionHistory, index: number) => 
    `prediction-${item.id || item.prediction_id}-${index}`, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <View style={[styles.header, { borderBottomColor: themeColors.border }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons
            name="arrow-back"
            size={24}
            color={themeColors.text}
          />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: themeColors.text }]}>
          {t('history.title')}
        </Text>
        <View style={styles.headerRight} />
      </View>

      {loading && !refreshing && predictions.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={themeColors.success} />
        </View>
      ) : (
        <FlatList
          data={predictions}
          renderItem={renderPredictionItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={themeColors.text}
            />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={renderEmpty}
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          windowSize={10}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  headerRight: {
    width: 24,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
  },
  predictionCard: {
    flexDirection: 'row',
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  predictionImage: {
    width: width * 0.3,
    height: width * 0.3,
  },
  predictionInfo: {
    flex: 1,
    padding: 12,
  },
  predictionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cropName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  primaryDiseaseName: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  symptomPreview: {
    fontSize: 12,
    marginBottom: 6,
    fontStyle: 'italic',
  },
  predictionMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  date: {
    fontSize: 12,
  },
  confidenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  confidenceScore: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
  footerLoader: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  placeholderImage: {
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
}); 