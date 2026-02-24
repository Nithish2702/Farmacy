import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { RFValue } from 'react-native-responsive-fontsize';
import { heightPercentageToDP as hp, widthPercentageToDP as wp } from 'react-native-responsive-screen';

interface FeatureCardsProps {
  isLandscape: boolean;
  colors: {
    card: string;
    text: string;
    primary: string;
  };
}

const FeatureCards: React.FC<FeatureCardsProps> = ({ isLandscape, colors }) => {
  const { t } = useTranslation();

  return (
    <View style={[styles.featureCards, { flexDirection: isLandscape ? 'column' : 'row' }]}>
      <View style={[styles.featureCard, { backgroundColor: colors.card }]}>
        <View style={styles.featureHeader}>
          <Text style={[styles.featureTitle, { color: colors.text }]}>
            {t('dashboard.features.fertilizer.title')}
          </Text>
          <Ionicons name="leaf-outline" size={RFValue(20)} color="#10B981" />
        </View>
        <Text style={[styles.featureText, { color: colors.text }]}>
          {t('dashboard.features.fertilizer.next')}
        </Text>
        <Text style={[styles.featureSubtext, { color: colors.text }]}>
          {t('dashboard.features.fertilizer.dosage')}
        </Text>
        <Text style={[styles.featureReminder, { color: colors.primary }]}>
          {t('dashboard.features.fertilizer.reminder')}
        </Text>
      </View>
      <View style={[styles.featureCard, { backgroundColor: colors.card }]}>
        <View style={styles.featureHeader}>
          <Text style={[styles.featureTitle, { color: colors.text }]}>
            {t('dashboard.features.learning.title')}
          </Text>
          <Ionicons name="book-outline" size={RFValue(20)} color="#3B82F6" />
        </View>
        <View style={styles.learningItem}>
          <Ionicons name="play-circle-outline" size={RFValue(16)} color="#EF4444" />
          <Text style={[styles.learningText, { color: colors.text }]}>
            {t('dashboard.features.learning.sowing')}
          </Text>
        </View>
        <View style={styles.learningItem}>
          <Ionicons name="document-text-outline" size={RFValue(16)} color="#EF4444" />
          <Text style={[styles.learningText, { color: colors.text }]}>
            {t('dashboard.features.learning.guide')}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  featureCards: {
    flexDirection: 'row',
    gap: wp('3%'),
    marginTop: hp('2.5%'),
  },
  featureCard: {
    flex: 1,
    borderRadius: wp('3%'),
    padding: wp('4%'),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  featureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: hp('1%'),
  },
  featureTitle: {
    fontSize: RFValue(14),
    fontWeight: '500',
  },
  featureText: {
    fontSize: RFValue(13),
    marginBottom: hp('0.5%'),
  },
  featureSubtext: {
    fontSize: RFValue(12),
    marginBottom: hp('0.5%'),
  },
  featureReminder: {
    fontSize: RFValue(12),
    fontWeight: '500',
  },
  learningItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp('0.5%'),
  },
  learningText: {
    fontSize: RFValue(13),
    marginLeft: wp('1.5%'),
  },
});

export default FeatureCards;