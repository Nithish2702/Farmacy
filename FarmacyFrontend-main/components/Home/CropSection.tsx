import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Crop as CropType } from '@/api/cropService';
import CropCard from './CropCard';
import { heightPercentageToDP as hp, widthPercentageToDP as wp } from 'react-native-responsive-screen';
import { RFValue } from 'react-native-responsive-fontsize';

interface CropSectionProps {
  crops: CropType[];
  loadingCrops: boolean;
  cropError: string | null;
  fetchCrops: () => void;
  handleCropPress: (cropId: number) => void;
  colors: {
    card: string;
    text: string;
    primary: string;
  };
}

const CropSection: React.FC<CropSectionProps> = ({
  crops,
  loadingCrops,
  cropError,
  fetchCrops,
  handleCropPress,
  colors,
}) => {
  const { t } = useTranslation();

  if (loadingCrops) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (cropError) {
    return (
      <View style={styles.errorContainer}>
        <Text style={[styles.errorText, { color: colors.text }]}>{cropError}</Text>
        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: colors.primary }]}
          onPress={fetchCrops}
        >
          <Text style={styles.retryButtonText}>{t('common.retry', 'Retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.cropsSection}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        {t('dashboard.crops.title', 'Crops')}
      </Text>
      <View style={styles.cropsGrid}>
        {crops.map((crop) => (
          <CropCard
            key={crop.id}
            id={crop.id}
            name={crop.name}
            variety={crop.variety}
            imageUrl={crop.image_urls?.[0]}
            onPress={() => handleCropPress(crop.id)}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 16,
    marginBottom: 12,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  cropsSection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: RFValue(18),
    fontWeight: '600',
    marginBottom: hp('1%'),
  },
  cropsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
});

export default CropSection;