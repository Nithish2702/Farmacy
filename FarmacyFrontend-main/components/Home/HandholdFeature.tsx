import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { RFValue } from 'react-native-responsive-fontsize';
import { format } from 'date-fns';
import { Week } from '@/api/cropService';
import { HandholdCrop } from '@/hooks/useCrops';
import { heightPercentageToDP as hp, widthPercentageToDP as wp } from 'react-native-responsive-screen';

interface HandholdFeatureProps {
  handholdCrops: HandholdCrop[];
  selectedCrop: HandholdCrop | null;
  setSelectedCrop: (crop: HandholdCrop | null) => void;
  weeks: Week[];
  loadingWeeks: boolean;
  loadingCrops?: boolean; // Add loading state for crops
  colors: {
    card: string;
    text: string;
    textSecondary: string;
    primary: string;
    secondary: string;
  };
}

const HandholdFeature: React.FC<HandholdFeatureProps> = ({
  handholdCrops,
  selectedCrop,
  setSelectedCrop,
  weeks,
  loadingWeeks,
  loadingCrops = false, // Default to false
  colors,
}) => {
  const { t } = useTranslation();
  const router = useRouter();

  // Safety check for required props
  if (!colors) {
    console.warn('HandholdFeature: colors prop is required');
    return null;
  }

  // Handle loading state for crops
  if (loadingCrops) {
    return (
      <View style={[styles.welcomeContainer, { backgroundColor: colors.card }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            {t('common.loadingData', 'Loading crops...')}
          </Text>
        </View>
      </View>
    );
  }

  // Handle empty state - check for both null/undefined and empty array
  if (!handholdCrops || handholdCrops.length === 0) {
    return (
      <View style={[styles.welcomeContainer, { backgroundColor: colors.card }]}>
        <View style={styles.welcomeContent}>
          <Ionicons name="leaf-outline" size={RFValue(48)} color={colors.primary} />
          <Text style={[styles.welcomeTitle, { color: colors.text }]}>
            {t('dashboard.handholding.title', 'Start Your Farming Journey')}
          </Text>
          <Text style={[styles.welcomeDescription, { color: colors.text }]}>
            {t('dashboard.handholding.description', 'Get personalized guidance throughout your crop cultivation with our handholding feature. We will help you with daily tasks, recommendations, and timely alerts.')}
          </Text>
          <TouchableOpacity 
            style={[styles.welcomeButton, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/sidebar/crophandholdselection')}
          >
            <Text style={styles.welcomeButtonText}>
              {t('dashboard.handholding.getStarted', 'Get Started')}
            </Text>
            <Ionicons name="arrow-forward" size={RFValue(20)} color="white" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.cropList}
      >
        {handholdCrops.map((crop) => (
          <TouchableOpacity
            key={crop.cropId || crop.id}
            style={[
              styles.cropCard,
              selectedCrop?.cropId === crop.cropId && styles.selectedCropCard,
              { backgroundColor: colors.card },
            ]}
            onPress={() => setSelectedCrop(crop)}
          >
            <Text style={[styles.cropName, { color: colors.text }]}>
              {crop.cropName || `Crop ${crop.cropId || crop.id}`}
            </Text>
            <Text style={[styles.cropVariety, { color: colors.textSecondary }]}>
              {crop.variety || 'Growing'}
            </Text>
            <Text style={[styles.cropStartDate, { color: colors.textSecondary }]}>
              {t('handholding.startedOn', 'Started on')}: {
                crop.startDate ? 
                  (() => {
                    try {
                      return format(new Date(crop.startDate), 'PP');
                    } catch (error) {
                      console.warn('Error formatting date:', error);
                      return 'Invalid Date';
                    }
                  })() 
                  : 'N/A'
              }
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {selectedCrop && (
        <View style={styles.weeksContainer}>
          {loadingWeeks ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                {t('common.loadingData', 'Loading weeks...')}
              </Text>
            </View>
          ) : weeks && weeks.length > 0 ? (
            weeks.map((week) => (
              <View key={week.week_number} style={[styles.weekCard, { backgroundColor: colors.card }]}>
                <Text style={[styles.weekTitle, { color: colors.text }]}>
                  {t('handholding.week', 'Week')} {week.week_number}: {week.title}
                </Text>
                {week.days && Object.entries(week.days).map(([day, data]) => (
                  <View key={day} style={styles.dayContainer}>
                    <Text style={[styles.dayTitle, { color: colors.text }]}>
                      {t('handholding.day', 'Day')} {day}
                    </Text>
                    {data.tasks && data.tasks.map((task, index) => (
                      <View key={index} style={styles.taskItem}>
                        <Ionicons name="checkmark-circle-outline" size={RFValue(20)} color={colors.primary} />
                        <Text style={[styles.task, { color: colors.text }]}>{task}</Text>
                      </View>
                    ))}
                    {data.recommendations && data.recommendations.map((rec, index) => (
                      <View key={index} style={styles.recommendationItem}>
                        <Ionicons name="bulb-outline" size={RFValue(20)} color={colors.secondary} />
                        <Text style={[styles.recommendation, { color: colors.secondary }]}>{rec}</Text>
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            ))
          ) : (
            <View style={[styles.weekCard, { backgroundColor: colors.card }]}>
              <Text style={[styles.weekTitle, { color: colors.textSecondary }]}>
                {t('handholding.noWeeks', 'No weeks data available')}
              </Text>
            </View>
          )}
        </View>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  welcomeContainer: {
    padding: wp('4%'),
    borderRadius: wp('3%'),
    marginTop: hp('2%'),
  },
  welcomeContent: {
    alignItems: 'center',
    padding: wp('4%'),
  },
  welcomeTitle: {
    fontSize: RFValue(24),
    fontWeight: '600',
    marginTop: hp('2%'),
    marginBottom: hp('1%'),
    textAlign: 'center',
  },
  welcomeDescription: {
    fontSize: RFValue(16),
    textAlign: 'center',
    lineHeight: RFValue(24),
    marginBottom: hp('3%'),
    opacity: 0.8,
    paddingHorizontal: wp('4%'),
  },
  welcomeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp('6%'),
    paddingVertical: hp('2%'),
    borderRadius: wp('3%'),
    marginTop: hp('2%'),
  },
  welcomeButtonText: {
    color: 'white',
    fontSize: RFValue(18),
    fontWeight: '600',
    marginRight: wp('2%'),
  },
  cropList: {
    marginBottom: hp('2.5%'),
  },
  cropCard: {
    padding: wp('4%'),
    borderRadius: wp('3%'),
    marginRight: wp('3%'),
    minWidth: wp('60%'),
  },
  selectedCropCard: {
    borderColor: '#4CAF50',
    borderWidth: 2,
  },
  cropName: {
    fontSize: RFValue(18),
    fontWeight: '600',
    marginBottom: hp('1%'),
  },
  cropVariety: {
    fontSize: RFValue(14),
    marginBottom: hp('1%'),
  },
  cropStartDate: {
    fontSize: RFValue(12),
  },
  weeksContainer: {
    marginTop: hp('2.5%'),
  },
  weekCard: {
    padding: wp('4%'),
    borderRadius: wp('3%'),
    marginBottom: hp('2.5%'),
  },
  weekTitle: {
    fontSize: RFValue(18),
    fontWeight: '600',
    marginBottom: hp('2%'),
  },
  dayContainer: {
    marginBottom: hp('2%'),
  },
  dayTitle: {
    fontSize: RFValue(16),
    fontWeight: '500',
    marginBottom: hp('1%'),
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp('1%'),
  },
  task: {
    fontSize: RFValue(14),
    marginLeft: wp('2%'),
    flex: 1,
  },
  recommendationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp('1%'),
    paddingLeft: wp('4%'),
  },
  recommendation: {
    fontSize: RFValue(14),
    marginLeft: wp('2%'),
    flex: 1,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: RFValue(14),
    marginTop: hp('2%'),
    textAlign: 'center',
  },
});

export default HandholdFeature;