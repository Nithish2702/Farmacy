import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, Dimensions, ImageBackground } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import { RFValue } from 'react-native-responsive-fontsize';
import { useTranslation } from 'react-i18next';

const height = Dimensions.get('window').height;

// Add type for Section props
interface SectionProps {
  title: string;
  children: React.ReactNode;
}

export default function PrivacyPolicyScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  const Section = ({ title, children }: SectionProps) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <ImageBackground
          source={require('../assets/login_backgrnd.png')}
          style={styles.backgroundImage}
          resizeMode="cover"
        >
          <LinearGradient
            colors={['rgba(0, 0, 0, 0.6)', 'rgba(0, 0, 0, 0.95)']}
            style={styles.gradient}
          >
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <MaterialCommunityIcons name="arrow-left" size={RFValue(20)} color="#fff" />
            </TouchableOpacity>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
              <View style={styles.mainContent}>
                <Text style={styles.title}>{t('privacy.title')}</Text>
                <Text style={styles.subtitle}>{t('privacy.subtitle')}</Text>

                <Section title={t('privacy.section1.title')}>
                  <Text style={styles.bodyText}>
                    {t('privacy.section1.body')}
                  </Text>
                </Section>

                <Section title={t('privacy.section2.title')}>
                  <Text style={styles.subSectionTitle}>{t('privacy.section2.subSection1.title')}</Text>
                  <Text style={styles.bodyText}>
                    {t('privacy.section2.subSection1.body')}
                  </Text>
                  <Text style={styles.subSectionTitle}>{t('privacy.section2.subSection2.title')}</Text>
                  <Text style={styles.bodyText}>
                    {t('privacy.section2.subSection2.body')}
                  </Text>
                  <Text style={styles.subSectionTitle}>{t('privacy.section2.subSection3.title')}</Text>
                  <Text style={styles.bodyText}>
                    {t('privacy.section2.subSection3.body')}
                  </Text>
                </Section>

                <Section title={t('privacy.section3.title')}>
                  <Text style={styles.bodyText}>
                    {t('privacy.section3.body1')}
                  </Text>
                  <Text style={styles.bodyText}>
                    {t('privacy.section3.body2')}
                  </Text>
                  <Text style={styles.bodyText}>
                    {t('privacy.section3.body3')}
                  </Text>
                  <Text style={styles.bodyText}>
                    {t('privacy.section3.body4')}
                  </Text>
                </Section>

                <Section title={t('privacy.section4.title')}>
                  <Text style={styles.bodyText}>
                    {t('privacy.section4.body')}
                  </Text>
                </Section>

                <Section title={t('privacy.section5.title')}>
                  <Text style={styles.bodyText}>
                    {t('privacy.section5.body')}
                  </Text>
                </Section>

                <Section title={t('privacy.section6.title')}>
                  <Text style={styles.subSectionTitle}>{t('privacy.section6.subSection1.title')}</Text>
                  <Text style={styles.bodyText}>
                    {t('privacy.section6.subSection1.body')}
                  </Text>
                  <Text style={styles.subSectionTitle}>{t('privacy.section6.subSection2.title')}</Text>
                  <Text style={styles.bodyText}>
                    {t('privacy.section6.subSection2.body')}
                  </Text>
                </Section>

                <Section title={t('privacy.section7.title')}>
                  <Text style={styles.bodyText}>
                    {t('privacy.section7.body')}
                  </Text>
                </Section>

                <Section title={t('privacy.section8.title')}>
                  <Text style={styles.bodyText}>
                    {t('privacy.section8.body')}
                  </Text>
                </Section>

                <View style={styles.footer}>
                  <Text style={styles.footerText}>
                    {t('privacy.footer.contact')}
                  </Text>
                  <Text style={styles.footerText}>
                    {t('privacy.footer.lastUpdated')}
                  </Text>
                </View>
              </View>
            </ScrollView>
          </LinearGradient>
        </ImageBackground>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  gradient: {
    flex: 1,
  },
  backButton: {
    position: 'absolute',
    top: hp('2%'),
    left: wp('6%'),
    zIndex: 10,
    padding: wp('3%'),
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: wp('6%'),
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: wp('6%'),
    paddingVertical: hp('10%'),
    paddingBottom: hp('4%'),
  },
  mainContent: {
    flex: 1,
    paddingVertical: hp('2%'),
  },
  title: {
    fontSize: RFValue(26),
    fontWeight: '700',
    color: '#fff',
    marginBottom: hp('1%'),
    textAlign: 'center',
  },
  subtitle: {
    fontSize: RFValue(14),
    color: 'rgba(255,255,255,0.8)',
    marginBottom: hp('3%'),
    textAlign: 'center',
    fontStyle: 'italic',
  },
  section: {
    marginBottom: hp('3%'),
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: wp('3%'),
    padding: wp('4%'),
  },
  sectionTitle: {
    fontSize: RFValue(16),
    fontWeight: '600',
    color: '#4CAF50',
    marginBottom: hp('1.5%'),
    textAlign: 'left',
  },
  subSectionTitle: {
    fontSize: RFValue(14),
    fontWeight: '500',
    color: '#81C784',
    marginTop: hp('1%'),
    marginBottom: hp('0.5%'),
    textAlign: 'left',
  },
  bodyText: {
    fontSize: RFValue(12),
    color: '#c8e6c9',
    textAlign: 'left',
    lineHeight: height < 700 ? RFValue(16) : RFValue(18),
    marginBottom: hp('1%'),
  },
  footer: {
    marginTop: hp('2%'),
    padding: wp('4%'),
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    borderRadius: wp('3%'),
    alignItems: 'center',
  },
  footerText: {
    fontSize: RFValue(11),
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginBottom: hp('0.5%'),
  },
});