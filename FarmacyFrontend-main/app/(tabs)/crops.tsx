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
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/context/theme';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import { RFValue } from 'react-native-responsive-fontsize';
import { Ionicons } from '@expo/vector-icons';
import { useCropsContext } from '@/context/CropsContext';
import CropSelectorDropdown from '@/components/CropSelectorDropDown';
import { Crop, Week, cropService } from '@/api/cropService';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaLayout } from '@/components/ui/SafeAreaLayout';

const { width: screenWidth } = Dimensions.get('window');

const CropsTab = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { t } = useTranslation();
  const { colors, isDarkMode } = useTheme();
  const { crops, loading, currentCrop } = useCropsContext();

  
  const [selectedCrop, setSelectedCrop] = useState<Crop | null>(currentCrop);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [cropWeeks, setCropWeeks] = useState<Week[]>([]);
  const [isLoadingWeeks, setIsLoadingWeeks] = useState(false);

  // Handle deep link params for crop_id and week_number
  useEffect(() => {
    if (params.crop_id) {
      const cropIdNum = parseInt(params.crop_id as string, 10);
      const foundCrop = crops.find(c => c.id === cropIdNum);
      if (foundCrop) {
        setSelectedCrop(foundCrop);
      }
    }
  }, [params.crop_id, crops]);

  useEffect(() => {
    if (params.week_number) {
      const weekNum = parseInt(params.week_number as string, 10);
      setSelectedWeek(weekNum);
    }
  }, [params.week_number]);

  // Helper function to extract day number from day key (e.g., "day_1" -> 1)
  const extractDayNumber = (dayKey: string): number => {
    const match = dayKey.match(/day_(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  };

  // Fetch weeks data when a crop is selected
  useEffect(() => {
    const fetchWeeks = async () => {
      if (selectedCrop) {
        try {
          setIsLoadingWeeks(true);
          const weeks = await cropService.getCropWeeks(selectedCrop.id);
          setCropWeeks(weeks);
          
          // Only set first week as default if no week_number is provided in URL params
          if (weeks.length > 0 && !params.week_number) {
            setSelectedWeek(weeks[0].week_number);
          }
        } catch (error) {
          console.error('Error fetching weeks:', error);
        } finally {
          setIsLoadingWeeks(false);
        }
      } else {
        setCropWeeks([]);
        setSelectedWeek(null);
      }
    };

    fetchWeeks();
  }, [selectedCrop]); // Remove params.week_number dependency to prevent infinite loops

  if (loading.crops) {
    return (
      <SafeAreaLayout
        backgroundColor={colors.background}
        statusBarStyle={isDarkMode ? 'light-content' : 'dark-content'}
        edges={['top', 'left', 'right', 'bottom']}
        contentStyle={styles.container}
      >
        <View style={[styles.header, { backgroundColor: colors.background }]}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{t('crops.title', 'Crop Library')}</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            {t('crops.subtitle', 'Explore different crops and their varieties')}
          </Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaLayout>
    );
  }

  return (
    <SafeAreaLayout
      backgroundColor={colors.background}
      statusBarStyle={isDarkMode ? 'light-content' : 'dark-content'}
      edges={['top', 'left', 'right', 'bottom']}
      contentStyle={styles.container}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.background }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('crops.title', 'Crop Library')}</Text>
        <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
          {t('crops.subtitle', 'Explore different crops and their varieties')}
        </Text>
      </View>

      {/* Content */}
      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
      >
        <View style={[styles.selectorContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.selectorTitle, { color: colors.text }]}>
            {t('crops.selectCrop', 'Select a crop to view details')}
          </Text>
          <CropSelectorDropdown
            selectSingle={true}
            isDarkMode={isDarkMode}
            onCropSelect={(crop) => {
              setSelectedCrop(crop);
              setSelectedWeek(null);
            }}
            defaultSelectedCrop={currentCrop ? { 
              id: currentCrop.id, 
              name: currentCrop.variety ? `${currentCrop.variety} ${currentCrop.name}` : currentCrop.name 
            } : null}
          />
        </View>
        
        {/* Selected Crop Details */}
        {selectedCrop && (
          <View style={[styles.cropDetailsContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {/* Weekly Care Plan Section */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  {t('crops.weeklyPlan', 'Weekly Care Plan')}
                </Text>
                <Ionicons name="calendar-outline" size={RFValue(20)} color={colors.primary} />
              </View>
              
              {/* Week selector scrollbar */}
              {isLoadingWeeks ? (
                <View style={styles.loadingWeeksContainer}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                    {t('crops.loadingWeeks', 'Loading weekly care plan...')}
                  </Text>
                </View>
              ) : cropWeeks.length > 0 ? (
                <View style={styles.weeksContainer}>
                  <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false} 
                    style={styles.weekSelector}
                    contentContainerStyle={styles.weekSelectorContent}
                  >
                    {cropWeeks.map((week: Week) => (
                      <TouchableOpacity 
                        key={`selector-${week.week_number}`}
                        style={[
                          styles.weekSelectorItem, 
                          { 
                            backgroundColor: selectedWeek === week.week_number ? colors.primary : colors.card,
                            borderColor: selectedWeek === week.week_number ? colors.primary : colors.border,
                            marginRight: wp('2%')
                          }
                        ]}
                        onPress={() => setSelectedWeek(week.week_number)}
                      >
                        <Text 
                          style={[
                            styles.weekSelectorText, 
                            { color: selectedWeek === week.week_number ? colors.white : colors.primary }
                          ]}
                        >
                          {t('crops.week', 'Week {{number}}', { number: week.week_number })}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  
                  {/* Show selected week details */}
                  {selectedWeek !== null && cropWeeks.filter(week => week.week_number === selectedWeek).map((week) => (
                    <View 
                      key={week.week_number} 
                      style={[styles.weekCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                    >
                      {/* Week Image Section */}
                      {week.image_urls && week.image_urls.length > 0 && (
                        <View style={styles.weekImageContainer}>
                          <Image
                            source={{ uri: week.image_urls[0] }}
                            style={styles.weekImage}
                            resizeMode="cover"
                          />
                          <View style={[styles.imageOverlay, { backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.3)' }]} />
                          <View style={styles.weekImageContent}>
                            <View style={styles.weekImageHeader}>
                              <Text style={[styles.weekImageTitle, { color: colors.white }]}>
                                {t('crops.week', 'Week {{number}}', { number: week.week_number })}
                              </Text>
                              {week.day_range && (
                                <Text style={[styles.weekImageSubtitle, { color: 'rgba(255, 255, 255, 0.9)' }]}>
                                  {week.day_range}
                                </Text>
                              )}
                            </View>
                            <Text style={[styles.weekImageDescription, { color: 'rgba(255, 255, 255, 0.95)' }]}>
                              {week.title}
                            </Text>
                          </View>
                        </View>
                      )}
                      
                      {/* Week Header (if no image) */}
                      {(!week.image_urls || week.image_urls.length === 0) && (
                        <View style={[styles.weekHeader, { borderBottomColor: colors.border }]}>
                          <View style={styles.weekTitleContainer}>
                            <Text style={[styles.weekTitle, { color: colors.primary }]}>
                              {t('crops.week', 'Week {{number}}', { number: week.week_number })}
                            </Text>
                            <Text style={[styles.weekSubtitle, { color: colors.text }]}>
                              {week.title}
                            </Text>
                          </View>
                          {week.day_range && (
                            <View style={[styles.dayRangeBadge, { backgroundColor: colors.primary + '20' }]}>
                              <Text style={[styles.dayRange, { color: colors.primary }]}>
                                {week.day_range}
                              </Text>
                            </View>
                          )}
                        </View>
                      )}
                      
                      <View style={styles.weekDetails}>
                        {/* Show tasks by day */}
                        {Object.entries(week.days).length > 0 ? (
                          Object.entries(week.days)
                            .sort(([a], [b]) => extractDayNumber(a) - extractDayNumber(b))
                            .map(([day, data]) => {
                              const dayNumber = extractDayNumber(day);
                              return (
                                <View key={day} style={styles.daySection}>
                                  <View style={styles.dayHeader}>
                                    <Text style={[styles.dayTitle, { color: colors.text }]}>
                                      {t('crops.day', 'Day {{day}}', { day: dayNumber })}
                                    </Text>
                                  </View>
                                  
                                  {/* Tasks for this day */}
                                  {data.tasks && data.tasks.length > 0 && (
                                    <View style={styles.tasksSection}>
                                      {data.tasks.map((task, idx) => (
                                        <View key={`task-${idx}`} style={styles.taskItem}>
                                          <View style={[styles.taskBullet, { backgroundColor: colors.primary }]} />
                                          <Text style={[styles.taskText, { color: colors.text }]}>
                                            {task}
                                          </Text>
                                        </View>
                                      ))}
                                    </View>
                                  )}
                                  
                                  {/* Recommendations for this day */}
                                  {data.recommendations && data.recommendations.length > 0 && (
                                    <View style={styles.recommendationsSection}>
                                      {data.recommendations.map((rec, idx) => (
                                        <View key={`rec-${idx}`} style={styles.taskItem}>
                                          <View style={[styles.taskBullet, { backgroundColor: colors.info }]} />
                                          <Text style={[styles.taskText, { color: colors.text }]}>
                                            {rec}
                                          </Text>
                                        </View>
                                      ))}
                                    </View>
                                  )}
                                </View>
                              );
                            })
                        ) : (
                          <View style={styles.noDataContainer}>
                            <Ionicons name="document-outline" size={RFValue(40)} color={colors.textSecondary} />
                            <Text style={[styles.noDataText, { color: colors.textSecondary }]}>
                              {t('crops.noDailyData', 'No daily tasks available for this week.')}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  ))}
                  
                  {selectedWeek === null && (
                    <View style={[styles.noWeekSelected, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <Ionicons name="calendar-outline" size={RFValue(50)} color={colors.primary} />
                      <Text style={[styles.noWeekSelectedText, { color: colors.text }]}>
                        {t('crops.selectWeek', 'Select a week to view its care plan')}
                      </Text>
                      <Text style={[styles.noWeekSelectedSubtext, { color: colors.textSecondary }]}>
                        {t('crops.selectWeekHint', 'Choose from the week tabs above')}
                      </Text>
                    </View>
                  )}
                </View>
              ) : (
                <View style={styles.noDataContainer}>
                  <Ionicons name="calendar-outline" size={RFValue(40)} color={colors.textSecondary} />
                  <Text style={[styles.noDataText, { color: colors.textSecondary }]}>
                    {t('crops.noWeeklyData', 'No weekly care plan available for this crop.')}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}
        
        {/* No crops message */}
        {crops.length === 0 && (
          <View style={[styles.noCropsContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="leaf-outline" size={RFValue(50)} color={colors.primary} />
            <Text style={[styles.noCropsText, { color: colors.text }]}>
              {t('crops.noCrops', 'No crops available')}
            </Text>
          </View>
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
  },
  contentContainer: {
    paddingHorizontal: wp('4%'),
    paddingBottom: hp('15%'), // Add bottom padding for better scrolling
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectorContainer: {
    marginBottom: hp('2%'),
    borderWidth: 1,
    borderRadius: wp('3%'),
    padding: wp('4%'),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  selectorTitle: {
    fontSize: RFValue(16),
    fontWeight: '600',
    marginBottom: hp('1%'),
  },

  cropDetailsContainer: {
    borderWidth: 1,
    borderRadius: wp('3%'),
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  section: {
    padding: wp('4%'),
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: hp('2%'),
  },
  sectionTitle: {
    fontSize: RFValue(18),
    fontWeight: '600',
  },
  weeksContainer: {
    marginBottom: hp('2%'),
  },
  weekSelector: {
    maxHeight: hp('6%'),
    marginBottom: hp('2%'),
  },
  weekSelectorContent: {
    paddingVertical: hp('0.5%'),
  },
  weekSelectorItem: {
    paddingVertical: hp('0.8%'),
    paddingHorizontal: wp('4%'),
    borderWidth: 1.5,
    borderRadius: wp('3%'),
    marginRight: wp('2%'),
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  weekSelectorText: {
    fontSize: RFValue(14),
    fontWeight: '600',
  },
  weekCard: {
    borderRadius: wp('3%'),
    borderWidth: 1,
    marginBottom: hp('2%'),
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  weekImageContainer: {
    height: hp('25%'),
    position: 'relative',
  },
  weekImage: {
    width: '100%',
    height: '100%',
  },
  imageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  weekImageContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: wp('4%'),
  },
  weekImageHeader: {
    marginBottom: hp('1%'),
  },
  weekImageTitle: {
    fontSize: RFValue(20),
    fontWeight: '700',
    marginBottom: hp('0.5%'),
  },
  weekImageSubtitle: {
    fontSize: RFValue(12),
    fontWeight: '500',
  },
  weekImageDescription: {
    fontSize: RFValue(16),
    fontWeight: '600',
  },
  weekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: hp('1.5%'),
    borderBottomWidth: 1,
    paddingBottom: hp('1%'),
    padding: wp('4%'),
  },
  weekTitleContainer: {
    flex: 1,
  },
  weekTitle: {
    fontSize: RFValue(18),
    fontWeight: '700',
    marginBottom: hp('0.5%'),
  },
  weekSubtitle: {
    fontSize: RFValue(14),
    fontWeight: '500',
  },
  dayRangeBadge: {
    paddingHorizontal: wp('3%'),
    paddingVertical: hp('0.5%'),
    borderRadius: wp('2%'),
  },
  dayRange: {
    fontSize: RFValue(12),
    fontWeight: '600',
  },
  weekDetails: {
    padding: wp('4%'),
  },
  daySection: {
    marginBottom: hp('3%'),
  },
  dayHeader: {
    marginBottom: hp('1.5%'),
  },
  dayTitle: {
    fontSize: RFValue(16),
    fontWeight: '600',
  },
  tasksSection: {
    marginBottom: hp('2%'),
  },
  recommendationsSection: {
    marginBottom: hp('1%'),
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: hp('1%'),
    paddingVertical: hp('0.5%'),
  },
  taskBullet: {
    width: RFValue(6),
    height: RFValue(6),
    borderRadius: RFValue(3),
    marginTop: RFValue(6),
    marginRight: wp('2%'),
  },
  taskText: {
    fontSize: RFValue(13),
    lineHeight: RFValue(18),
    flex: 1,
  },
  noDataContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: wp('8%'),
  },
  noDataText: {
    fontSize: RFValue(14),
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: hp('2%'),
  },
  noCropsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: wp('4%'),
    borderWidth: 1,
    borderRadius: wp('3%'),
    marginTop: hp('2%'),
  },
  noCropsText: {
    fontSize: RFValue(16),
    fontWeight: '500',
    marginTop: hp('2%'),
    textAlign: 'center',
  },
  noWeekSelected: {
    padding: wp('6%'),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: wp('2%'),
  },
  noWeekSelectedText: {
    fontSize: RFValue(16),
    fontWeight: '600',
    marginTop: hp('2%'),
    textAlign: 'center',
  },
  noWeekSelectedSubtext: {
    fontSize: RFValue(14),
    marginTop: hp('1%'),
    textAlign: 'center',
  },
  loadingWeeksContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: wp('4%'),
  },
  loadingText: {
    fontSize: RFValue(14),
    fontWeight: '600',
    marginLeft: wp('2%'),
  },
});

export default CropsTab; 