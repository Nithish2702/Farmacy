import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  RefreshControl,
  Linking,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/context/theme';
import { useTranslation } from 'react-i18next';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import { RFValue } from 'react-native-responsive-fontsize';
import Ionicons from '@expo/vector-icons/Ionicons';
import { NewsArticle, newsService } from '@/api/newsService';
import { SafeAreaLayout } from '@/components/ui/SafeAreaLayout';

const NewsTab = () => {
  const router = useRouter();
  const { mode } = useTheme();
  const { t } = useTranslation();
  const isDarkMode = mode === 'dark';
  const [refreshing, setRefreshing] = useState(false);
  const [newsData, setNewsData] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const colors = {
    background: isDarkMode ? '#1F2937' : '#F9FAFB',
    card: isDarkMode ? '#374151' : '#FFFFFF',
    text: isDarkMode ? '#F9FAFB' : '#2C3E2C',
    textSecondary: isDarkMode ? '#D1D5DB' : '#6B7280',
    primary: '#4CAF50',
    secondary: '#81C784',
    border: isDarkMode ? '#4B5563' : '#E5E7EB',
    accent: '#FF6B6B',
    white: '#FFFFFF',
  };

  const fetchNews = async () => {
    try {
      setLoading(true);
      const response = await newsService.getAllNews();
      // console.log('Fetched news data:', response);
      setNewsData(response);
      setError(null);
    } catch (err) {
      console.error('Error fetching news:', err);
      setError(t('news.errors.fetchFailed', 'Failed to fetch agricultural news'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNews();
  }, []);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await fetchNews();
    setRefreshing(false);
  }, []);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return t('common.today', 'Today');
    if (diffDays === 2) return t('common.yesterday', 'Yesterday');
    if (diffDays <= 7) return t('common.daysAgo', '{{count}} days ago', { count: diffDays - 1 });
    return date.toLocaleDateString();
  };

  const shortenDescription = (description: string | null, maxLength: number = 100) => {
    if (!description) return '';
    if (description.length <= maxLength) return description;
    return description.substring(0, maxLength) + '...';
  };

  const handleNewsPress = (article: any) => {
    router.push({
      pathname: '/news/[id]' as any,
      params: { 
        id: article.id.toString(),
        article: JSON.stringify(article)
      }
    });
  };

  const handleSourcePress = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert(
          t('common.error'),
          t('news.errors.cannotOpenLink', 'Cannot open this link'),
          [{ text: t('common.ok'), style: 'default' }]
        );
      }
    } catch (error) {
      console.error('Error opening link:', error);
      Alert.alert(
        t('common.error'),
        t('news.errors.linkError', 'Error opening link'),
        [{ text: t('common.ok'), style: 'default' }]
      );
    }
  };

  const newsArticles = newsData.length > 0 ? newsData : [
    {
      id: 1,
      title: t('news.items.subsidy.title', 'Government Announces New Fertilizer Subsidy Scheme'),
      description: t('news.items.subsidy.description', 'The central government has announced a new fertilizer subsidy scheme to support farmers across the country.'),
      image: require('@/assets/stages-guide.png'),
      category: t('news.categories.policy', 'Policy'),
      timeAgo: t('common.timeAgo.hours', '2 hours ago'),
      featured: true,
    },
    {
      id: 2,
      title: t('news.items.weather.title', 'Weather Alert: Heavy Rainfall Expected This Week'),
      description: t('news.items.weather.description', 'Meteorological department issues warning for heavy rainfall in agricultural regions.'),
      image: require('@/assets/disease-guide.png'),
      category: t('news.categories.weather', 'Weather'),
      timeAgo: t('common.timeAgo.hours', '4 hours ago'),
      featured: false,
    },
    {
      id: 3,
      title: t('news.items.research.title', 'New Disease-Resistant Crop Varieties Developed'),
      description: t('news.items.research.description', 'Agricultural scientists develop new varieties that are resistant to common crop diseases.'),
      image: require('@/assets/stages-guide.png'),
      category: t('news.categories.research', 'Research'),
      timeAgo: t('common.timeAgo.days', '1 day ago'),
      featured: false,
    },
    {
      id: 4,
      title: t('news.items.technology.title', 'Digital Agriculture: Tech Solutions for Modern Farming'),
      description: t('news.items.technology.description', 'How technology is revolutionizing agriculture and helping farmers increase productivity.'),
      image: require('@/assets/disease-guide.png'),
      category: t('news.categories.technology', 'Technology'),
      timeAgo: t('common.timeAgo.days', '2 days ago'),
      featured: false,
    },
  ];

  const getCategoryColor = (category: string) => {
    switch (category.toLowerCase()) {
      case 'policy': return '#3B82F6';
      case 'weather': return '#F59E0B';
      case 'research': return '#8B5CF6';
      case 'technology': return '#10B981';
      default: return colors.primary;
    }
  };

  const renderFeaturedArticle = (article: any) => (
    <TouchableOpacity 
      key={article.id}
      style={[styles.featuredCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => handleNewsPress(article)}
    >
      <Image 
        source={article.image_urls?.[0] ? { uri: article.image_urls[0] } : article.image || require('@/assets/stages-guide.png')} 
        style={styles.featuredImage}
        resizeMode="cover"
      />
      <View style={styles.featuredOverlay}>
        <View style={[styles.categoryBadge, { backgroundColor: getCategoryColor(article.category) }]}>
          <Text style={styles.categoryText}>{article.category}</Text>
        </View>
        <Text style={[styles.featuredTitle, { color: colors.card }]}>
          {article.title}
        </Text>
        <Text style={[styles.featuredTime, { color: colors.card }]}>
          {article.published_at ? formatDate(article.published_at) : article.timeAgo}
        </Text>
        
        {/* Source Button for Featured Article */}
        {article.source_url && (
          <View style={styles.featuredActionButtons}>
            <TouchableOpacity 
              style={[styles.featuredActionButton, { backgroundColor: colors.primary }]}
              onPress={() => handleSourcePress(article.source_url)}
            >
              <Ionicons name="open-outline" size={14} color={colors.white} />
              <Text style={[styles.featuredActionButtonText, { color: colors.white }]}>
                {t('news.source', 'Source')}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderNewsArticle = (article: any) => (
    <TouchableOpacity 
      key={article.id}
      style={[styles.newsCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => handleNewsPress(article)}
    >
      <Image 
        source={article.image_urls?.[0] ? { uri: article.image_urls[0] } : article.image || require('@/assets/disease-guide.png')} 
        style={styles.newsImage}
        resizeMode="cover"
      />
      <View style={styles.newsContent}>
        <View style={styles.newsHeader}>
          <View style={[styles.categoryBadge, { backgroundColor: getCategoryColor(article.category) }]}>
            <Text style={styles.categoryText}>{article.category}</Text>
          </View>
          <Text style={[styles.timeText, { color: colors.textSecondary }]}>
            {article.published_at ? formatDate(article.published_at) : article.timeAgo}
          </Text>
        </View>
        <Text style={[styles.newsTitle, { color: colors.text }]}>
          {article.title}
        </Text>
        <Text style={[styles.newsDescription, { color: colors.textSecondary }]}>
          {shortenDescription(article.description, 80)}
        </Text>
        {article.description && article.description.length > 80 && (
          <Text style={[styles.readMoreText, { color: colors.primary }]}>
            {t('news.readMore', 'Read More')}
          </Text>
        )}
        
        {/* Source Button */}
        {article.source_url && (
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: colors.primary }]}
              onPress={() => handleSourcePress(article.source_url)}
            >
              <Ionicons name="open-outline" size={16} color={colors.white} />
              <Text style={[styles.actionButtonText, { color: colors.white }]}>
                {t('news.source', 'Source')}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaLayout
      backgroundColor={colors.background}
      statusBarStyle={isDarkMode ? 'light-content' : 'dark-content'}
      edges={['top', 'left', 'right', 'bottom']}
      contentStyle={styles.container}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.background }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('news.title', 'Agricultural News')}</Text>
        <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
          {t('news.subtitle', 'Stay updated with latest farming news')}
        </Text>
      </View>

      {/* Content */}
      <ScrollView 
        style={styles.content}
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
        {loading ? (
          <View style={[styles.loadingContainer, { paddingVertical: hp('10%') }]}>
            <Ionicons name="leaf" size={40} color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>{t('news.loading', 'Loading fresh agricultural news...')}</Text>
          </View>
        ) : error ? (
          <View style={[styles.loadingContainer, { paddingVertical: hp('10%') }]}>
            <Ionicons name="alert-circle" size={40} color={colors.accent} />
            <Text style={[styles.loadingText, { color: colors.accent }]}>{error}</Text>
            <TouchableOpacity style={[styles.retryButton, { backgroundColor: colors.primary }]} onPress={fetchNews}>
              <Text style={[styles.retryButtonText, { color: colors.white }]}>{t('common.tryAgain', 'Try Again')}</Text>
            </TouchableOpacity>
          </View>
        ) : newsData.length === 0 ? (
          <View style={[styles.loadingContainer, { paddingVertical: hp('10%') }]}>
            <Ionicons name="newspaper-outline" size={40} color={colors.textSecondary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>{t('news.noNews', 'No agricultural news available')}</Text>
          </View>
        ) : (
          <>
            {/* Featured News */}
            <View style={styles.featuredSection}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('news.featured', 'Featured')}</Text>
              {newsArticles.length > 0 && renderFeaturedArticle(newsArticles[0])}
            </View>

            {/* Latest News */}
            <View style={styles.newsSection}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('news.latest', 'Latest News')}</Text>
              {newsArticles.slice(1).map(article => renderNewsArticle(article))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: wp('4%'),
    paddingBottom: hp('1%'),
  },
  headerTitle: {
    fontSize: RFValue(24),
    fontWeight: '700',
    marginBottom: hp('0.5%'),
  },
  headerSubtitle: {
    fontSize: RFValue(14),
    fontWeight: '400',
  },
  content: {
    flex: 1,
    paddingHorizontal: wp('4%'),
  },
  sectionTitle: {
    fontSize: RFValue(18),
    fontWeight: '600',
    marginBottom: hp('1.5%'),
    marginTop: hp('1%'),
  },
  featuredSection: {
    marginBottom: hp('2%'),
  },
  featuredCard: {
    borderRadius: wp('4%'),
    marginBottom: hp('2%'),
    height: hp('25%'),
    overflow: 'hidden',
    borderWidth: 1,
  },
  featuredImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  featuredOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    padding: wp('4%'),
    justifyContent: 'flex-end',
  },
  featuredTitle: {
    fontSize: RFValue(16),
    fontWeight: '600',
    marginBottom: hp('0.5%'),
    lineHeight: RFValue(22),
  },
  featuredTime: {
    fontSize: RFValue(12),
    opacity: 0.8,
  },
  newsSection: {
    marginBottom: hp('15%'),
  },
  newsCard: {
    flexDirection: 'row',
    borderRadius: wp('3%'),
    marginBottom: hp('1.5%'),
    overflow: 'hidden',
    borderWidth: 1,
  },
  newsImage: {
    width: wp('25%'),
    height: hp('12%'),
    alignSelf: 'center',
    paddingLeft: wp('1%'),
  },
  newsContent: {
    flex: 1,
    padding: wp('3%'),
  },
  newsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: hp('0.5%'),
  },
  categoryBadge: {
    paddingHorizontal: wp('2%'),
    paddingVertical: hp('0.3%'),
    borderRadius: wp('2%'),
  },
  categoryText: {
    fontSize: RFValue(10),
    color: '#FFFFFF',
    fontWeight: '600',
  },
  timeText: {
    fontSize: RFValue(11),
    fontWeight: '400',
  },
  newsTitle: {
    fontSize: RFValue(14),
    fontWeight: '600',
    marginBottom: hp('0.5%'),
    lineHeight: RFValue(18),
  },
  newsDescription: {
    fontSize: RFValue(12),
    lineHeight: RFValue(16),
  },
  readMoreText: {
    fontSize: RFValue(11),
    fontWeight: '600',
    marginTop: hp('0.5%'),
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: RFValue(14),
    textAlign: 'center',
    marginTop: hp('1%'),
  },
  retryButton: {
    paddingHorizontal: wp('6%'),
    paddingVertical: hp('1%'),
    borderRadius: wp('6%'),
    marginTop: hp('2%'),
  },
  retryButtonText: {
    fontSize: RFValue(12),
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: hp('1%'),
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp('3%'),
    paddingVertical: hp('0.5%'),
    borderRadius: wp('3%'),
    marginHorizontal: wp('1%'),
  },
  actionButtonText: {
    fontSize: RFValue(10),
    fontWeight: '600',
    marginLeft: wp('1%'),
  },
  featuredActionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: hp('1%'),
  },
  featuredActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp('3%'),
    paddingVertical: hp('0.5%'),
    borderRadius: wp('3%'),
    marginHorizontal: wp('1%'),
  },
  featuredActionButtonText: {
    fontSize: RFValue(10),
    fontWeight: '600',
    marginLeft: wp('1%'),
  },
});

export default NewsTab; 