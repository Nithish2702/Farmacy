import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/context/theme';
import { useTranslation } from 'react-i18next';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import { RFValue } from 'react-native-responsive-fontsize';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SafeAreaLayout } from '@/components/ui/SafeAreaLayout';

const LearnTab = () => {
  const router = useRouter();
  const { mode } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const isDarkMode = mode === 'dark';

  const colors = {
    background: isDarkMode ? '#1F2937' : '#F0F7F0',
    card: isDarkMode ? '#374151' : '#FFFFFF',
    text: isDarkMode ? '#F9FAFB' : '#2C3E2C',
    textSecondary: isDarkMode ? '#D1D5DB' : '#6B7280',
    primary: '#4CAF50',
    secondary: '#81C784',
    border: isDarkMode ? '#4B5563' : '#E5E7EB',
  };

  const guideArticles = [
    {
      id: 1,
      title: t('learn.articles.stagesGuide.title', 'Stage-wise Crops Guide'),
      description: t('learn.articles.stagesGuide.description', 'Learn about different growth stages of your crops and how to manage them effectively.'),
      image: require('@/assets/stages-guide.png'),
      route: '/sidebar/guide/stages' as const,
    },
    {
      id: 2,
      title: t('learn.articles.diseaseGuide.title', 'Disease Learning Guide'),
      description: t('learn.articles.diseaseGuide.description', 'Identify and manage crop diseases with comprehensive learning resources.'),
      image: require('@/assets/disease-guide.png'),
      route: '/disease' as const,
    },
  ];



  return (
    <SafeAreaLayout
      backgroundColor={colors.background}
      statusBarStyle={isDarkMode ? 'light-content' : 'dark-content'}
      edges={['top', 'left', 'right', 'bottom']}
      contentStyle={styles.container}
    >
      {/* Clean Header */}
      <View style={[styles.header, { backgroundColor: colors.background }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('learn.title', 'Learn & Grow')}</Text>
        <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
          {t('learn.subtitle', 'Expert guides for better farming')}
        </Text>
      </View>

      {/* Content */}
      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent, 
          { paddingBottom: Math.max(insets.bottom + hp('2%'), hp('4%')) }
        ]}
      >
        {/* Learning Guides */}
        {guideArticles.map((article) => (
          <TouchableOpacity 
            key={article.id}
            style={[styles.articleCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push(article.route)}
          >
            <Image 
              source={article.image} 
              style={styles.articleImage}
              resizeMode="cover"
            />
            <View style={styles.articleContent}>
              <Text style={[styles.articleTitle, { color: colors.text }]}>
                {article.title}
              </Text>
              <Text style={[styles.articleDescription, { color: colors.textSecondary }]}>
                {article.description}
              </Text>
              <View style={styles.readMoreContainer}>
                <Text style={[styles.readMoreText, { color: colors.primary }]}>
                  {t('learn.readMore', 'Read More')}
                </Text>
                <Ionicons 
                  name="chevron-forward" 
                  size={RFValue(16)} 
                  color={colors.primary} 
                />
              </View>
            </View>
          </TouchableOpacity>
        ))}
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
    paddingBottom: hp('4%'),
  },
  headerTitle: {
    fontSize: RFValue(24),
    fontWeight: '700',
    marginBottom: hp('2%'),
    
  },
  headerSubtitle: {
    fontSize: RFValue(14),
    fontWeight: '400',
    marginBottom: hp('1%'),
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: wp('4%'),
  },
  // Crop Selector Styles
  cropSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: wp('4%'),
    borderRadius: wp('3%'),
    marginBottom: hp('2%'),
    borderWidth: 1,
  },
  cropSelectorContent: {
    flex: 1,
  },
  cropSelectorLabel: {
    fontSize: RFValue(12),
    fontWeight: '500',
    marginBottom: hp('0.5%'),
  },
  cropSelectorText: {
    fontSize: RFValue(14),
    fontWeight: '600',
  },
  // Error and Loading Styles
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: wp('4%'),
    borderRadius: wp('3%'),
    marginBottom: hp('2%'),
    borderWidth: 1,
  },
  errorText: {
    flex: 1,
    fontSize: RFValue(14),
    fontWeight: '500',
  },
  errorDismiss: {
    fontSize: RFValue(12),
    fontWeight: '600',
    marginLeft: wp('2%'),
  },
  loadingContainer: {
    padding: wp('8%'),
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: RFValue(14),
    marginTop: hp('1%'),
    textAlign: 'center',
  },
  // Section Styles
  sectionTitle: {
    fontSize: RFValue(18),
    fontWeight: '600',
    marginBottom: hp('2%'),
    marginTop: hp('1%'),
  },
  stagesContainer: {
    marginBottom: hp('3%'),
  },
  guidesSection: {
    marginTop: hp('2%'),
  },
  noDataContainer: {
    padding: wp('8%'),
    alignItems: 'center',
    justifyContent: 'center',
  },
  noDataText: {
    fontSize: RFValue(14),
    textAlign: 'center',
    fontStyle: 'italic',
  },
  // Stage Card Styles
  stageCard: {
    borderRadius: wp('2.5%'),
    marginBottom: hp('1.5%'),
    borderWidth: 1,
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
    padding: wp('3%'),
  },
  stageHeaderContent: {
    flex: 1,
  },
  stageNumber: {
    fontSize: RFValue(12),
    fontWeight: '600',
    marginBottom: hp('0.5%'),
  },
  stageTitle: {
    fontSize: RFValue(14),
    fontWeight: '600',
  },
  stageContent: {
    padding: wp('3%'),
    paddingTop: 0,
  },
  stageDescription: {
    fontSize: RFValue(12),
    lineHeight: RFValue(18),
    marginBottom: hp('1.5%'),
  },
  weeksSection: {
    marginTop: hp('1%'),
  },
  weeksTitle: {
    fontSize: RFValue(14),
    fontWeight: '600',
    marginBottom: hp('1%'),
  },
  weekItem: {
    marginBottom: hp('1%'),
    paddingLeft: wp('2%'),
  },
  weekTitle: {
    fontSize: RFValue(13),
    fontWeight: '600',
    marginBottom: hp('0.5%'),
  },
  weekDescription: {
    fontSize: RFValue(12),
    lineHeight: RFValue(16),
  },
  // Article Card Styles
  articleCard: {
    borderRadius: wp('3%'),
    marginBottom: hp('1.5%'),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
    borderWidth: 1,
  },
  articleImage: {
    width: '100%',
    height: hp('14%'),
  },
  articleContent: {
    padding: wp('3%'),
  },
  articleTitle: {
    fontSize: RFValue(15),
    fontWeight: '600',
    marginBottom: hp('0.8%'),
    lineHeight: RFValue(20),
  },
  articleDescription: {
    fontSize: RFValue(12),
    lineHeight: RFValue(18),
    marginBottom: hp('1.2%'),
  },
  readMoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  readMoreText: {
    fontSize: RFValue(12),
    fontWeight: '600',
    marginRight: wp('1%'),
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: wp('85%'),
    maxHeight: hp('70%'),
    borderRadius: wp('3%'),
    padding: wp('5%'),
  },
  modalTitle: {
    fontSize: RFValue(18),
    fontWeight: '600',
    marginBottom: hp('2%'),
    textAlign: 'center',
  },
  modalScrollView: {
    maxHeight: hp('50%'),
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
});

export default LearnTab; 