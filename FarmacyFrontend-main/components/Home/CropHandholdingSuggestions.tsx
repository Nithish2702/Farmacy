import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RFValue } from 'react-native-responsive-fontsize';
import { heightPercentageToDP as hp, widthPercentageToDP as wp } from 'react-native-responsive-screen';
import { Week } from '@/api/cropService';
import { CropTrackResponse } from '@/api/cropTrackService';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useCropsContext } from '@/context/CropsContext';
import i18n from '@/i18n.config';

interface CropHandholdingSuggestionsProps {
  colors: {
    background: string;
    card: string;
    text: string;
    textSecondary: string;
    primary: string;
    secondary: string;
    white: string;
    border: string;
    accent: string;
  };
  cropTracking: CropTrackResponse;
  isDarkMode?: boolean;
}

const CropHandholdingSuggestions: React.FC<CropHandholdingSuggestionsProps> = ({
  colors,
  cropTracking,
  isDarkMode = false
}) => {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [currentDay, setCurrentDay] = useState<number | null>(null);
  const {
    currentTracking,
    dailyUpdate,
    loading,
    error,
    loadDailyUpdate
  } = useCropsContext();

  // Use dailyUpdate as cropWeek data
  const cropWeek = dailyUpdate;

  const getCurrentDate = () => {
    const today = new Date();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    return {
      dayName: days[today.getDay()],
      dayNumber: today.getDate(),
      month: months[today.getMonth()],
      fullDate: `${days[today.getDay()]}, ${months[today.getMonth()]} ${today.getDate()}`,
      today: today
    };
  };

  const getGreeting = () => {
    
    return t('greetings.tracker', 'Crop Progress Tracker!');
  };

  const getDaysInWeek = (cropWeek: any) => {
    if (!cropWeek || !cropWeek.days) return [];

    return Object.keys(cropWeek.days)
      .map(dayKey => parseInt(dayKey))
      .sort((a, b) => a - b);
  };

  // Memoize the days array to prevent unnecessary recalculations
  const days = useMemo(() => getDaysInWeek(cropWeek), [cropWeek]);

  // Calculate current day only once when component mounts or when cropTracking changes
  useEffect(() => {
    if (cropTracking?.startDate) {
      const startDate = new Date(cropTracking.startDate);
      startDate.setHours(0, 0, 0, 0);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const diffTime = today.getTime() - startDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      const dayNumber = diffDays + 1;

      setCurrentDay(dayNumber);
      // Set initial selected day to today's day if it exists in available days
      if (days.includes(dayNumber)) {
        setSelectedDay(dayNumber);
      } else if (days.length > 0) {
        setSelectedDay(days[0]);
      }
    }
  }, [cropTracking?.startDate, days]);

  // Trigger daily update load when cropTracking changes
  useEffect(() => {
    if (cropTracking?.id && !loading.dailyUpdate) {
      console.log('CropHandholdingSuggestions: Triggering daily update load for tracking', cropTracking.id);
      loadDailyUpdate(cropTracking.id, true);
    }
  }, [cropTracking?.id]); // Remove loadDailyUpdate dependency to prevent infinite loops

  // Reset daily update when tracking changes to force fresh load
  useEffect(() => {
    if (cropTracking?.id) {
      console.log('CropHandholdingSuggestions: Tracking changed, will trigger fresh daily update load');
    }
  }, [cropTracking?.id]);

  const getDateForDay = useCallback((dayNumber: number, cropTracking: any) => {
    const startDate = new Date(cropTracking.startDate);
    startDate.setHours(0, 0, 0, 0);

    const totalDays = dayNumber - 1;
    const targetDate = new Date(startDate);
    targetDate.setDate(startDate.getDate() + totalDays);
    targetDate.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const currentLanguage = i18n.language;
    
    // Map language codes to locale codes
    const localeMap: { [key: string]: string } = {
      'en': 'en-US',
      'hi': 'hi-IN',
      'te': 'te-IN'
    };
    
    const locale = localeMap[currentLanguage] || 'en-US';
    
    try {
      // Try to use native localization first for day names only
      const dayName = targetDate.toLocaleDateString(locale, { weekday: 'short' });
      // Keep month names in English
      const monthName = targetDate.toLocaleDateString('en-US', { month: 'short' });
      const date = targetDate.getDate();

      const getOrdinalSuffix = (num: number): string => {
        const j = num % 10;
        const k = num % 100;
        if (j === 1 && k !== 11) return "st";
        if (j === 2 && k !== 12) return "nd";
        if (j === 3 && k !== 13) return "rd";
        return "th";
      };

      return {
        dayName,
        fullDate: `${dayName} ${monthName} ${date}${getOrdinalSuffix(date)}`,
        isToday: targetDate.getTime() === today.getTime(),
        actualDate: targetDate
      };
    } catch (error) {
      // Fallback to translation keys if locale is not supported
      const dayNames = [
        'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'
      ];
      const months = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
      ];

      const dayName = t(`common.daysShort.${dayNames[targetDate.getDay()]}`);
      const monthName = months[targetDate.getMonth()]; // Keep in English
      const date = targetDate.getDate();

      const getOrdinalSuffix = (num: number): string => {
        const j = num % 10;
        const k = num % 100;
        if (j === 1 && k !== 11) return "st";
        if (j === 2 && k !== 12) return "nd";
        if (j === 3 && k !== 13) return "rd";
        return "th";
      };

      return {
        dayName,
        fullDate: `${dayName} ${monthName} ${date}${getOrdinalSuffix(date)}`,
        isToday: targetDate.getTime() === today.getTime(),
        actualDate: targetDate
      };
    }
  }, [t]);

  const getTodaysCropDay = (cropTracking: any, cropWeek: any) => {
    if (!cropTracking?.startDate || !cropWeek?.days) return null;

    const startDate = new Date(cropTracking.startDate);
    startDate.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const diffTime = today.getTime() - startDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const dayNumber = diffDays + 1;

    return dayNumber;
  };

  const getInitialSelectedDay = (cropTracking: any, cropWeek: any) => {
    const todaysDay = getTodaysCropDay(cropTracking, cropWeek);
    const availableDays = getDaysInWeek(cropWeek);
    
    if (todaysDay && availableDays.includes(todaysDay)) {
      return todaysDay;
    }
    
    // If today's day is not available, find the closest future day
    if (todaysDay) {
      const futureDays = availableDays.filter(day => day > todaysDay);
      if (futureDays.length > 0) {
        return futureDays[0];
      }
    }
    
    // If no future days, return the last available day
    return availableDays[availableDays.length - 1];
  };

  const todaysCropDay = getTodaysCropDay(cropTracking, cropWeek);

  interface DayData {
    tasks?: string[];
    recommendations?: string[];
  }

  interface CropWeekWithDays {
    days: {
      [key: string]: DayData;
    };
  }

  interface DayTips {
    tasks: string[];
    recommendations: string[];
  }

  const getCurrentDayTips = (
    cropWeek: CropWeekWithDays | null,
    selectedDay: number
  ): DayTips => {
    if (!cropWeek || !cropWeek.days) {
      return { tasks: [], recommendations: [] };
    }

    const dayKey = selectedDay.toString();
    const dayData: DayData | undefined = cropWeek.days[dayKey];

    return {
      tasks: dayData?.tasks || [],
      recommendations: dayData?.recommendations || []
    };
  };

  const currentDate = getCurrentDate();
  const greeting = getGreeting();

  const getActualWeekNumber = (cropTracking: CropTrackResponse) => {
    if (!cropTracking?.startDate) return null;
    const startDate = new Date(cropTracking.startDate);
    const today = new Date();
    const diffTime = today.getTime() - startDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return Math.floor(diffDays / 7) + 1;
  };

  // Show loading state while daily update is being loaded
  // Only show loading if we have crop tracking but no daily update yet
  if (loading.dailyUpdate && cropTracking?.id && !dailyUpdate) {
    return (
      <View style={styles.container}>
        <View style={styles.headerSection}>
          <Text style={[styles.greetingText, { color: colors.primary }]}>{greeting}</Text>
          <Text style={[styles.dateText, { color: colors.textSecondary }]}>{currentDate.fullDate}</Text>
        </View>
        <View style={[styles.welcomeContainer, { backgroundColor: colors.card }]}>
          <View style={styles.welcomeContent}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.welcomeTitle, { color: colors.text }]}>Loading Daily Activities...</Text>
          </View>
        </View>
      </View>
    );
  }

  if (!cropWeek) {
    return (
      <View style={styles.container}>
        <View style={styles.headerSection}>
          <Text style={[styles.greetingText, { color: colors.primary }]}>{greeting}</Text>
          <Text style={[styles.dateText, { color: colors.textSecondary }]}>{currentDate.fullDate}</Text>
        </View>

        <View style={[styles.welcomeContainer, { backgroundColor: colors.card }]}>
          <View style={styles.welcomeContent}>
            <Ionicons name="leaf" size={RFValue(48)} color={colors.primary} />
            <Text style={[styles.welcomeTitle, { color: colors.text }]}>{t('dashboard.tracking.startCropTracking', 'Start Your Crop Journey')}</Text>
            <Text style={[styles.welcomeSubtitle, { color: colors.textSecondary }]}>
              {t('dashboard.tracking.description', 'Get personalized daily recommendations and expert guidance for your crops throughout the entire growing season.')}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  if (selectedDay === null) {
    return null; // Or a loading indicator if preferred
  }

  const tips = getCurrentDayTips(cropWeek, selectedDay);

  return (
    <View style={styles.container}>
      <View style={styles.headerSection}>
        <View>
          <Text style={[styles.greetingText, { color: colors.primary }]}>{greeting}</Text>
          <Text style={[styles.dateText, { color: colors.textSecondary }]}>{currentDate.fullDate}</Text>
        </View>
        <View style={[styles.weekBadge, { backgroundColor: colors.primary }]}>
          <Text style={[styles.weekBadgeText, { color: colors.white }]}>
            Week {cropTracking?.currentWeek || cropWeek?.week_number || 1}
          </Text>
        </View>
      </View>

      <View style={styles.cropTitleSection}>
        <Text style={[styles.cropWeekTitle, { color: colors.text }]}>{cropWeek?.title}</Text>
        <Text style={[styles.cropWeekSubtitle, { color: colors.textSecondary }]}>
          {t('handhold.continueRoutine', 'Continue your crop care routine')}
        </Text>
      </View>

      <View style={styles.daySelectorContainer}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('handhold.dailyCarePlan', 'Daily Care Plan')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.daySelector}>
          {days.map((day) => {
            const dateInfo = getDateForDay(day, cropTracking);
            const isSelected = selectedDay === day;
            const isToday = day === currentDay;

            return (
              <TouchableOpacity
                key={day}
                style={[
                  styles.dayButton,
                  {
                    backgroundColor: isSelected
                      ? (isToday ? colors.secondary || colors.primary : colors.primary)
                      : colors.card,
                    borderColor: isSelected
                      ? (isToday ? colors.secondary || colors.primary : colors.primary)
                      : colors.border,
                  }
                ]}
                onPress={() => setSelectedDay(day)}
              >
                <Text style={[
                  styles.dayButtonDate,
                  { color: isSelected ? colors.white : colors.text }
                ]}>
                  {dateInfo.fullDate}
                </Text>
                <Text style={[
                  styles.dayButtonNumber,
                  { color: isSelected ? colors.white : colors.textSecondary }
                ]}>
                  {t('common.day', 'Day')} {day}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <View style={[styles.activitiesCard, { backgroundColor: colors.card }]}>
        <View style={styles.activitiesHeader}>
          <Text style={[styles.activitiesTitle, { color: colors.text }]}>
            {t('handhold.dayActivities', 'Day {{day}} Activities', { day: selectedDay })}
          </Text>
          {getDateForDay(selectedDay, cropTracking).isToday && (
            <View style={[styles.todayBadge, { backgroundColor: colors.secondary || colors.primary }]}>
              <Text style={[styles.todayBadgeText, { color: colors.white }]}>{t('common.today', 'Today')}</Text>
            </View>
          )}
        </View>

        {tips.tasks.length > 0 && (
          <View style={styles.tasksSection}>
            <Text style={[styles.sectionSubtitle, { color: colors.primary }]}>
              🌱 {t('handhold.essentialTasks', 'Essential Tasks')}
            </Text>
            {tips.tasks.map((task: string, index: number) => (
              <View
                key={index}
                style={[styles.taskItem, { borderLeftColor: colors.primary }]}
              >
                <View style={[styles.taskIcon, { backgroundColor: colors.primary }]}>
                  <Ionicons name="checkmark" size={RFValue(12)} color={colors.white} />
                </View>
                <Text style={[styles.taskText, { color: colors.text }]}>
                  {task}
                </Text>
              </View>
            ))}
          </View>
        )}

        {tips.recommendations.length > 0 && (
          <View style={styles.recommendationsSection}>
            <Text style={[styles.sectionSubtitle, { color: colors.secondary }]}>
              💡 {t('handhold.expertRecommendations', 'Expert Recommendations')}
            </Text>
            {tips.recommendations.map((recommendation: string, index: number) => (
              <View
                key={index}
                style={[styles.recommendationItem, { borderLeftColor: colors.secondary }]}
              >
                <View style={[styles.recommendationIcon, { backgroundColor: colors.secondary }]}>
                  <Ionicons name="bulb" size={RFValue(12)} color={colors.white} />
                </View>
                <Text style={[styles.recommendationText, { color: colors.text }]}>
                  {recommendation}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={[styles.aiTipSection, { backgroundColor: colors.accent + '10' }]}>
          <View style={styles.aiTipHeader}>
            <Ionicons name="sparkles" size={RFValue(20)} color={colors.accent} />
            <Text style={[styles.aiTipTitle, { color: colors.accent }]}>{t('handhold.aiTodaysTip', "AI Today's Tip")}</Text>
          </View>
          <Text style={[styles.aiTipText, { color: colors.text }]}>
            {t('handhold.aiTipText', 'Based on your crop\'s growth stage and current conditions, focus on monitoring soil moisture levels. The optimal care routine for day {{day}} will maximize your crop\'s health and yield potential.', { day: selectedDay })}
          </Text>
        </View>
      </View>
      {/* Bottom Button */}
      <TouchableOpacity
        style={[styles.bottomButton, { backgroundColor: colors.primary }]}
        onPress={() => {
          const currentWeek = getActualWeekNumber(cropTracking);
          if (currentWeek) {
            router.push(`/(tabs)/crops?week_number=${currentWeek}`);
          } else {
            router.push('/(tabs)/crops');
          }
        }}
      >
        <Text style={[styles.bottomButtonText, { color: colors.white }]}>
          {t('handhold.viewWeeklyData', 'View Weekly Data')}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: hp('2%'),
  },
  headerSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: wp('1%'),
  },
  greetingText: {
    fontSize: RFValue(20),
    fontWeight: '700',
    marginBottom: hp('0.5%'),
  },
  dateText: {
    fontSize: RFValue(13),
    fontWeight: '500',
  },
  weekBadge: {
    paddingHorizontal: wp('3%'),
    paddingVertical: hp('0.8%'),
    borderRadius: wp('6%'),
  },
  weekBadgeText: {
    fontSize: RFValue(11),
    fontWeight: '600',
  },
  cropTitleSection: {
    paddingHorizontal: wp('1%'),
  },
  cropWeekTitle: {
    fontSize: RFValue(18),
    fontWeight: '700',
    marginBottom: hp('0.5%'),
  },
  cropWeekSubtitle: {
    fontSize: RFValue(13),
    lineHeight: RFValue(18),
  },
  welcomeContainer: {
    borderRadius: wp('4%'),
    padding: wp('6%'),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  welcomeContent: {
    alignItems: 'center',
  },
  welcomeTitle: {
    fontSize: RFValue(20),
    fontWeight: '700',
    textAlign: 'center',
    marginVertical: hp('2%'),
  },
  welcomeSubtitle: {
    fontSize: RFValue(14),
    textAlign: 'center',
    lineHeight: RFValue(20),
  },
  daySelectorContainer: {
    marginBottom: hp('1%'),
  },
  sectionTitle: {
    fontSize: RFValue(18),
    fontWeight: '700',
    marginBottom: hp('2%'),
    paddingHorizontal: wp('1%'),
  },
  daySelector: {
    flexDirection: 'row',
    paddingHorizontal: wp('1%'),
  },
  dayButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: wp('3%'),
    paddingVertical: hp('1.5%'),
    borderRadius: wp('3%'),
    marginRight: wp('3%'),
    minWidth: wp('28%'),
    borderWidth: 1,
  },
  dayButtonDate: {
    fontSize: RFValue(12),
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: hp('0.3%'),
  },
  dayButtonNumber: {
    fontSize: RFValue(10),
    fontWeight: '500',
    textAlign: 'center',
  },
  activitiesCard: {
    borderRadius: wp('4%'),
    padding: wp('4%'),
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  activitiesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: hp('2%'),
  },
  activitiesTitle: {
    fontSize: RFValue(16),
    fontWeight: '600',
  },
  todayBadge: {
    paddingHorizontal: wp('2.5%'),
    paddingVertical: hp('0.5%'),
    borderRadius: wp('4%'),
  },
  todayBadgeText: {
    fontSize: RFValue(10),
    fontWeight: '600',
  },
  tasksSection: {
    marginBottom: hp('2%'),
  },
  sectionSubtitle: {
    fontSize: RFValue(14),
    fontWeight: '600',
    marginBottom: hp('1.5%'),
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderLeftWidth: 3,
    paddingLeft: wp('3%'),
    marginBottom: hp('1.5%'),
    paddingVertical: hp('0.5%'),
  },
  taskIcon: {
    width: wp('5%'),
    height: wp('5%'),
    borderRadius: wp('2.5%'),
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: wp('3%'),
    marginTop: hp('0.2%'),
  },
  taskText: {
    flex: 1,
    fontSize: RFValue(12),
    lineHeight: RFValue(18),
  },
  recommendationsSection: {
    marginBottom: hp('2%'),
  },
  recommendationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderLeftWidth: 3,
    paddingLeft: wp('3%'),
    marginBottom: hp('1.5%'),
    paddingVertical: hp('0.5%'),
  },
  recommendationIcon: {
    width: wp('5%'),
    height: wp('5%'),
    borderRadius: wp('2.5%'),
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: wp('3%'),
    marginTop: hp('0.2%'),
  },
  recommendationText: {
    flex: 1,
    fontSize: RFValue(12),
    lineHeight: RFValue(18),
  },
  aiTipSection: {
    borderRadius: wp('3%'),
    padding: wp('4%'),
    marginTop: hp('1%'),
  },
  aiTipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp('1%'),
  },
  aiTipTitle: {
    fontSize: RFValue(14),
    fontWeight: '600',
    marginLeft: wp('2%'),
  },
  aiTipText: {
    fontSize: RFValue(12),
    lineHeight: RFValue(18),
    fontStyle: 'italic',
  },
  bottomButton: {
    // marginTop: hp('2%'),
    paddingVertical: hp('1.5%'),
    paddingHorizontal: wp('4%'),
    borderRadius: wp('3%'),
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    marginBottom: hp('4%')
  },
  bottomButtonText: {
    fontSize: RFValue(14),
    fontWeight: '600',
  },
});

export default CropHandholdingSuggestions;