import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/context/theme';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import { RFValue } from 'react-native-responsive-fontsize';
import { Ionicons } from '@expo/vector-icons';

const Guide = () => {
  const router = useRouter();
  const { t } = useTranslation();
  const { mode } = useTheme();
  const isDarkMode = mode === 'dark';

  const colors = {
    background: isDarkMode ? '#1F2937' : '#F0F7F0',
    card: isDarkMode ? '#374151' : '#FFFFFF',
    text: isDarkMode ? '#F9FAFB' : '#2C3E2C',
    primary: '#4CAF50',
    secondary: '#81C784',
    border: isDarkMode ? '#4B5563' : '#E5E7EB',
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card }]}>
        <TouchableOpacity 
          onPress={() => router.back()}
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={RFValue(24)} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Crop Guide</Text>
        <View style={{ width: RFValue(24) }} />
      </View>

      {/* Content */}
      <ScrollView style={styles.content}>
        {/* Stage-wise Crops Guide */}
        <TouchableOpacity 
          style={[styles.guideCard, { backgroundColor: colors.card }]}
          onPress={() => router.push('/sidebar/guide/stages')}
        >
          <View style={styles.cardContent}>
            <Image 
              source={require('@/assets/stages-guide.png')} 
              style={styles.guideImage}
              resizeMode="cover"
            />
            <View style={styles.guideInfo}>
              <Text style={[styles.guideTitle, { color: colors.text }]}>
                Stage-wise Crops Guide
              </Text>
              <Text style={[styles.guideDescription, { color: colors.text }]}>
                Learn about different growth stages of your crops and how to manage them effectively.
              </Text>
              <View style={styles.arrowContainer}>
                <Ionicons name="chevron-forward" size={RFValue(24)} color={colors.text} />
              </View>
            </View>
          </View>
        </TouchableOpacity>

        {/* Stage-wise Disease Guide */}
        <TouchableOpacity 
          style={[styles.guideCard, { backgroundColor: colors.card }]}
          onPress={() => router.push('/sidebar/guide/diseases')}
        >
          <View style={styles.cardContent}>
            <Image 
              source={require('@/assets/disease-guide.png')} 
              style={styles.guideImage}
              resizeMode="cover"
            />
            <View style={styles.guideInfo}>
              <Text style={[styles.guideTitle, { color: colors.text }]}>
                Stage-wise Disease Guide
              </Text>
              <Text style={[styles.guideDescription, { color: colors.text }]}>
                Identify and manage crop diseases at different growth stages.
              </Text>
              <View style={styles.arrowContainer}>
                <Ionicons name="chevron-forward" size={RFValue(24)} color={colors.text} />
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('2%'),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 3,
  },
  headerTitle: {
    fontSize: RFValue(20),
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: wp('4%'),
  },
  guideCard: {
    borderRadius: wp('3%'),
    marginBottom: hp('2%'),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    overflow: 'hidden',
  },
  cardContent: {
    width: '100%',
  },
  guideImage: {
    width: '100%',
    height: hp('25%'),
    borderTopLeftRadius: wp('3%'),
    borderTopRightRadius: wp('3%'),
  },
  guideInfo: {
    padding: wp('4%'),
  },
  guideTitle: {
    fontSize: RFValue(18),
    fontWeight: '600',
    marginBottom: hp('1%'),
  },
  guideDescription: {
    fontSize: RFValue(14),
    opacity: 0.7,
    marginBottom: hp('1%'),
  },
  arrowContainer: {
    alignItems: 'flex-end',
  },
});

export default Guide; 