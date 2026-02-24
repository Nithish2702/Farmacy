import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  Image, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  StatusBar,
  ActivityIndicator,
  Linking,
  Alert
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/context/theme';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import { RFValue } from 'react-native-responsive-fontsize';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NewsArticle, newsService } from '@/api/newsService';

const NewsDetailScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { id, article: articleParam } = params;
  const { t } = useTranslation();
  const { mode } = useTheme();
  const insets = useSafeAreaInsets();
  const isDarkMode = mode === 'dark';
  
  // State for article data
  const [article, setArticle] = useState<NewsArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const colors = {
    background: isDarkMode ? '#1F2937' : '#FAFCF8',
    card: isDarkMode ? '#374151' : '#FFFFFF',
    text: isDarkMode ? '#F9FAFB' : '#333333',
    textSecondary: isDarkMode ? '#D1D5DB' : '#6B7280',
    primary: '#4CAF50',
    secondary: '#81C784',
    border: isDarkMode ? '#4B5563' : '#E5E7EB',
    accent: '#FF6B6B',
    white: '#FFFFFF',
  };

  useEffect(() => {
    const fetchArticle = async () => {
      try {
        setLoading(true);
        
        // First try to use the passed article data
        if (articleParam) {
          const parsedArticle = JSON.parse(articleParam as string);
          setArticle(parsedArticle);
          setLoading(false);
          return;
        }
        
        // If no article data passed, fetch from API
        if (id) {
          const fetchedArticle = await newsService.getNewsById(parseInt(id as string));
          setArticle(fetchedArticle);
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching article:', err);
        setError(t('news.errors.fetchFailed', 'Failed to load article'));
        setLoading(false);
      }
    };

    fetchArticle();
  }, [id, articleParam]);

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Split description into readable paragraphs
  const getParagraphs = () => {
    if (!article?.description) return [];
    
    // Split into paragraphs and clean them up
    const paragraphs = article.description
      .split(/\n\s*\n|\.\s+(?=[A-Z])/g)
      .map(p => p.trim())
      .filter(p => p.length > 10)
      .map(p => {
        if (!/[.!?]$/.test(p)) {
          p += '.';
        }
        return p;
      });
      
    return paragraphs;
  };

  // Get category color
  const getCategoryColor = (category: string | null) => {
    if (!category) return colors.primary;
    
    switch (category.toLowerCase()) {
      case 'policy': return '#3B82F6';
      case 'weather': return '#F59E0B';
      case 'research': return '#8B5CF6';
      case 'technology': return '#10B981';
      case 'market': return '#EF4444';
      default: return colors.primary;
    }
  };

  // Handle opening source links
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

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          {t('news.loading', 'Loading news article...')}
        </Text>
      </View>
    );
  }

  if (error || !article) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: colors.background }]}>
        <Ionicons name="alert-circle" size={50} color={colors.accent} />
        <Text style={[styles.errorText, { color: colors.accent }]}>
          {error || t('news.errors.notFound', 'Article not found')}
        </Text>
        <TouchableOpacity 
          style={[styles.backButton, { backgroundColor: colors.primary }]} 
          onPress={() => router.back()}
        >
          <Text style={[styles.backButtonText, { color: colors.white }]}>
            {t('common.back', 'Go Back')}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const paragraphs = getParagraphs();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar 
        barStyle={isDarkMode ? "light-content" : "dark-content"} 
        backgroundColor={colors.background} 
      />
      
      {/* Featured Image */}
      <View style={styles.imageContainer}>
        <Image 
          source={
            article.image_urls?.[0] 
              ? { uri: article.image_urls[0] } 
              : require('@/assets/stages-guide.png')
          } 
          style={styles.featuredImage} 
          resizeMode="cover"
        />
        
        {/* Header overlay with navigation */}
        <View style={[styles.headerOverlay, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity 
            style={[styles.backButtonCircle, { backgroundColor: colors.card }]} 
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>
      
      <ScrollView 
        style={[styles.contentScroll, { backgroundColor: colors.background }]}
        showsVerticalScrollIndicator={false}
        bounces={true}
      >
        {/* Article Header */}
        <View style={[styles.articleHeader, { backgroundColor: colors.card }]}>
          {/* Category Badge */}
          {article.category && (
            <View style={[styles.categoryBadge, { backgroundColor: getCategoryColor(article.category) }]}>
              <Text style={[styles.categoryText, { color: colors.white }]}>
                {article.category.toUpperCase()}
              </Text>
            </View>
          )}
          
          {/* Article Title */}
          <Text style={[styles.title, { color: colors.text }]}>
            {article.title}
          </Text>
          
          {/* Metadata */}
          <View style={styles.metadataRow}>
            <View style={styles.metadataItem}>
              <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
              <Text style={[styles.metadataText, { color: colors.textSecondary }]}>
                {formatDate(article.published_at)}
              </Text>
            </View>
            
            {article.author && (
              <View style={styles.metadataItem}>
                <Ionicons name="person-outline" size={16} color={colors.textSecondary} />
                <Text style={[styles.metadataText, { color: colors.textSecondary }]}>
                  {article.author}
                </Text>
              </View>
            )}
          </View>
        </View>
        
        {/* Article Content */}
        <View style={[styles.contentContainer, { backgroundColor: colors.card }]}>
          {paragraphs.map((paragraph, index) => (
            <Text 
              key={index}
              style={[styles.paragraph, { color: colors.text }]}
            >
              {paragraph}
            </Text>
          ))}
        </View>
        
        {/* Source Information */}
        {(article.source || article.url) && (
          <View style={[styles.sourceContainer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
            <Text style={[styles.sourceTitle, { color: colors.text }]}>
              {t('news.source', 'Source')}
            </Text>
            
            {article.source && (
              <Text style={[styles.sourceText, { color: colors.textSecondary }]}>
                {article.source}
              </Text>
            )}
            
            {article.url && (
              <TouchableOpacity 
                style={styles.sourceItem}
                onPress={() => handleSourcePress(article.url)}
              >
                <Ionicons name="link" size={18} color={colors.primary} />
                <Text style={[styles.sourceLink, { color: colors.primary }]}>
                  {t('news.readOriginal', 'Read Original Article')}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        
        {/* Bottom Spacing */}
        <View style={[styles.bottomPadding, { height: insets.bottom + 40 }]} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: wp('5%'),
  },
  loadingText: {
    fontSize: RFValue(14),
    marginTop: hp('2%'),
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: wp('5%'),
  },
  errorText: {
    fontSize: RFValue(16),
    marginTop: hp('2%'),
    marginBottom: hp('3%'),
    textAlign: 'center',
  },
  backButton: {
    paddingHorizontal: wp('6%'),
    paddingVertical: hp('1.5%'),
    borderRadius: wp('6%'),
  },
  backButtonText: {
    fontSize: RFValue(14),
    fontWeight: '600',
  },
  imageContainer: {
    position: 'relative',
    height: hp('30%'),
  },
  featuredImage: {
    width: '100%',
    height: '100%',
  },
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: wp('4%'),
    zIndex: 10,
  },
  backButtonCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  shareButtonCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  contentScroll: {
    flex: 1,
  },
  articleHeader: {
    padding: wp('5%'),
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB20',
  },
  categoryBadge: {
    paddingHorizontal: wp('3%'),
    paddingVertical: hp('0.5%'),
    borderRadius: wp('4%'),
    alignSelf: 'flex-start',
    marginBottom: hp('1.5%'),
  },
  categoryText: {
    fontSize: RFValue(11),
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: RFValue(26),
    fontWeight: '700',
    lineHeight: RFValue(34),
    marginBottom: hp('2%'),
  },
  metadataRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: wp('4%'),
  },
  metadataItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp('0.5%'),
  },
  metadataText: {
    fontSize: RFValue(13),
    marginLeft: wp('1.5%'),
    fontWeight: '500',
  },
  contentContainer: {
    padding: wp('5%'),
  },
  paragraph: {
    fontSize: RFValue(16),
    lineHeight: RFValue(26),
    marginBottom: hp('2.5%'),
    textAlign: 'justify',
  },
  sourceContainer: {
    padding: wp('5%'),
    borderTopWidth: 1,
    marginTop: hp('2%'),
  },
  sourceTitle: {
    fontSize: RFValue(18),
    fontWeight: '700',
    marginBottom: hp('1.5%'),
  },
  sourceText: {
    fontSize: RFValue(14),
    marginBottom: hp('1%'),
    fontStyle: 'italic',
  },
  sourceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: hp('1%'),
    paddingHorizontal: wp('3%'),
    backgroundColor: '#4CAF5010',
    borderRadius: wp('2%'),
    marginTop: hp('1%'),
  },
  sourceLink: {
    marginLeft: wp('2%'),
    fontSize: RFValue(15),
    fontWeight: '600',
  },
  bottomPadding: {
    marginTop: hp('2%'),
  },
});

export default NewsDetailScreen; 