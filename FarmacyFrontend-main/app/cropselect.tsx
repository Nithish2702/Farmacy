import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Image,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { RFValue } from 'react-native-responsive-fontsize';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Crop } from '@/api/cropService';
import { useCropsContext } from '@/context/CropsContext';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

const CropSelect: React.FC = () => {
  const router = useRouter();
  const { crops, loading } = useCropsContext();
  const navigation = useNavigation();
  const [selectedCrops, setSelectedCrops] = useState<{[key: string]: string[]}>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredCrops, setFilteredCrops] = useState<Crop[]>([]);
  const { t } = useTranslation();

  useEffect(() => {
    const filtered = crops.filter(crop =>
      crop.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      crop.variety.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredCrops(filtered);
  }, [crops, searchQuery]);

  const groupedCrops = filteredCrops.reduce((acc, crop) => {
    if (!acc[crop.name]) {
      acc[crop.name] = [];
    }
    acc[crop.name].push(crop);
    return acc;
  }, {} as Record<string, Crop[]>);

  const toggleVariety = (cropName: string, variety: string) => {
    setSelectedCrops(prev => {
      const cropVarieties = prev[cropName] || [];
      if (cropVarieties.includes(variety)) {
        const newVarieties = cropVarieties.filter(v => v !== variety);
        if (newVarieties.length === 0) {
          const { [cropName]: _, ...rest } = prev;
          return rest;
        }
        return {
          ...prev,
          [cropName]: newVarieties
        };
      } else {
        return {
          ...prev,
          [cropName]: [...cropVarieties, variety]
        };
      }
    });
  };

  const handleContinue = async () => {
    try {
      // Complete the user setup process with backend integration
      const tempUserData = await AsyncStorage.getItem('temp_user_setup');
      if (tempUserData) {
        const userData = JSON.parse(tempUserData);
        console.log("Completing user setup with backend:", userData);
                
        // Clear temporary data
        await AsyncStorage.removeItem('temp_user_setup');
      }
      
      console.log("The selected crops: ", selectedCrops);
      console.log("THE all crops", crops);
      
      // Navigate to main app
      navigation.reset({
        index: 0,
        routes: [{ name: '(tabs)' as never }],
      });
    } catch (error) {
      console.error('Error saving selected crops:', error);
      // Still navigate to main app even if crop saving fails
      navigation.reset({
        index: 0,
        routes: [{ name: '(tabs)' as never }],
      });
    }
  };

  const renderVariety = ({ item: crop }: { item: Crop }) => (
    <TouchableOpacity
      key={crop.variety}
      style={[
        styles.varietyItem,
        selectedCrops[crop.name]?.includes(crop.variety) && styles.varietyItemSelected
      ]}
      onPress={() => toggleVariety(crop.name, crop.variety)}
    >
      <View style={styles.varietyContent}>
        {crop.image_urls?.[0] ? (
          <Image
            source={{ uri: crop.image_urls[0] }}
            style={styles.varietyImage}
          />
        ) : (
          <View style={[styles.varietyImage, styles.placeholderImage]}>
            <Text style={styles.placeholderText}>{crop.variety[0]}</Text>
          </View>
        )}
        <Text style={[
          styles.varietyText,
          selectedCrops[crop.name]?.includes(crop.variety) && styles.varietyTextSelected
        ]}>
          {crop.variety}
        </Text>
        {selectedCrops[crop.name]?.includes(crop.variety) && (
          <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" style={styles.checkIcon} />
        )}
      </View>
    </TouchableOpacity>
  );

  const renderCropGroup = ({ item }: { item: [string, Crop[]] }) => {
    const [cropName, cropList] = item;
    return (
      <View style={styles.cropSection}>
        {/* If you want to translate crop names, use t(`crops.common.${cropName}`) if available, else fallback */}
        <Text style={styles.cropTitle}>{t(`crops.common.${cropName}`, cropName)}</Text>
        <View style={styles.varietiesContainer}>
          {cropList.map(crop => (
            <View key={crop.variety} style={styles.varietyWrapper}>
              {renderVariety({ item: crop })}
            </View>
          ))}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <View style={{ flex: 1 }}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('cropSelect.title')}</Text>
          <Text style={styles.subtitle}>{t('cropSelect.subtitle')}</Text>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#6B7280" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder={t('cropSelect.searchPlaceholder')}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>

        {loading.crops ? (
          <View style={styles.loadingContainer}>
            <Text>{t('cropSelect.loadingCrops')}</Text>
          </View>
        ) : (
          <FlatList
            data={Object.entries(groupedCrops)}
            keyExtractor={([cropName]) => cropName}
            renderItem={renderCropGroup}
            contentContainerStyle={styles.content}
          />
        )}

        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.continueButton,
              Object.keys(selectedCrops).length === 0 && styles.continueButtonDisabled
            ]}
            onPress={handleContinue}
            disabled={Object.keys(selectedCrops).length === 0}
          >
            <Text style={styles.continueButtonText}>{t('cropSelect.continueButton')}</Text>
            <Ionicons name="arrow-forward" size={24} color="white" />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F9F7',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? hp('6%') : hp('3%'),
    paddingHorizontal: wp('5%'),
    paddingBottom: hp('2%'),
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: RFValue(24),
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: hp('1%'),
  },
  subtitle: {
    fontSize: RFValue(16),
    color: '#6B7280',
    marginBottom: hp('2%'),
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: wp('2%'),
    paddingHorizontal: wp('3%'),
    marginBottom: hp('1%'),
  },
  searchIcon: {
    marginRight: wp('2%'),
  },
  searchInput: {
    flex: 1,
    fontSize: RFValue(16),
    paddingVertical: hp('1%'),
  },
  content: {
    padding: wp('5%'),
    paddingBottom: hp('10%'),
  },
  cropSection: {
    marginBottom: hp('4%'),
    backgroundColor: 'white',
    borderRadius: wp('3%'),
    padding: wp('4%'),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cropTitle: {
    fontSize: RFValue(20),
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: hp('2%'),
  },
  varietiesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  varietyWrapper: {
    width: wp('30%'),
    marginBottom: hp('2%'),
  },
  varietyItem: {
    alignItems: 'center',
    padding: wp('3%'),
    backgroundColor: '#F3F4F6',
    borderRadius: wp('3%'),
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  varietyItemSelected: {
    backgroundColor: '#2E7D32',
    borderColor: '#2E7D32',
  },
  varietyContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  varietyImage: {
    width: wp('15%'),
    height: wp('15%'),
    borderRadius: wp('7.5%'),
    marginBottom: hp('1%'),
  },
  placeholderImage: {
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#6B7280',
    fontSize: RFValue(14),
    fontWeight: '600',
  },
  varietyText: {
    fontSize: RFValue(12),
    color: '#374151',
    textAlign: 'center',
  },
  varietyTextSelected: {
    color: 'white',
  },
  checkIcon: {
    position: 'absolute',
    top: -wp('2%'),
    right: -wp('2%'),
  },
  footer: {
    padding: wp('5%'),
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2E7D32',
    paddingVertical: hp('1.5%'),
    borderRadius: wp('5%'),
  },
  continueButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  continueButtonText: {
    color: 'white',
    fontSize: RFValue(16),
    fontWeight: '600',
    marginRight: wp('2%'),
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default CropSelect;