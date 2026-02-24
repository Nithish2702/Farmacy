import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { RFValue } from 'react-native-responsive-fontsize';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';

import { useEffect } from 'react';
import { SafeAreaLayout } from '@/components/ui/SafeAreaLayout';
import { useNavigationBar } from '@/hooks/useNavigationBar';

const Home = () => {
  const router = useRouter();
  const { t } = useTranslation();
              const { updateTheme, setTransparentBar } = useNavigationBar();

  // Ensure navigation bar is transparent
  useEffect(() => {
    updateTheme(false); // false for light theme
    setTransparentBar();
  }, [updateTheme, setTransparentBar]);

  return (
    <SafeAreaLayout
      backgroundImage={require('@/assets/background3.jpg')}
      gradient={{
        colors: ['rgba(0, 0, 0, 0.4)', 'rgba(0, 0, 0, 0.6)'],
        locations: [0, 1]
      }}
      statusBarStyle="light-content"
      edges={['top', 'left', 'right', 'bottom']}
      contentStyle={styles.contentContainer}
    >
      {/* Back Button */}
      <TouchableOpacity 
        style={styles.backButton}
        onPress={() => router.back()}
      >
        <MaterialCommunityIcons name="arrow-left" size={RFValue(20)} color="#fff" />
      </TouchableOpacity>

      <View style={styles.headerContainer}>
        <Text style={styles.title}>{t('home.title')}</Text>
        <Text style={styles.subtitle}>{t('home.subtitle')}</Text>
      </View>

      <View style={styles.quoteContainer}>
        <View style={styles.quoteDivider} />
        <Text style={styles.quotation}>{t('home.quotation')}</Text>
        <View style={styles.quoteDivider} />
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.button}
          onPress={() => router.replace('/phone-auth')}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>{t('home.getStarted')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaLayout>
  );
};

export default Home;

const styles = StyleSheet.create({
  contentContainer: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    justifyContent: 'center',
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
  headerContainer: {
    alignItems: 'center',
    marginBottom: 40,
    width: '100%',
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
  subtitle: {
    fontSize: 22,
    color: '#e0f2e0',
    marginTop: 8,
    textAlign: 'center',
  },
  quoteContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 50,
    paddingHorizontal: 20,
  },
  quoteDivider: {
    height: 1,
    backgroundColor: 'rgba(200, 230, 201, 0.5)',
    width: '30%',
    marginVertical: 15,
  },
  quotation: {
    fontSize: 18,
    color: '#e0f2e0',
    fontStyle: 'italic',
    textAlign: 'center',
    fontWeight: '300',
    letterSpacing: 0.5,
    lineHeight: 26,
  },
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
  },
  button: {
    backgroundColor: '#8bc34a',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginVertical: 10,
    width: '80%',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
