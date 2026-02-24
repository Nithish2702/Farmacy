// components/PhoneInput.tsx
import React, { useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import { RFValue } from 'react-native-responsive-fontsize';
import { useTranslation } from 'react-i18next';

interface PhoneInputProps {
  phoneNumber: string;
  onPhoneNumberChange: (number: string) => void;
  showError?: boolean;
}

export const PhoneInput: React.FC<PhoneInputProps> = ({
  phoneNumber,
  onPhoneNumberChange,
  showError = false,
}) => {
  const { t } = useTranslation();
  const phoneInputRef = useRef<TextInput>(null);

  const handlePhoneNumberChange = (text: string) => {
    // Only allow numbers and limit to 10 digits
    const cleanedText = text.replace(/[^\d]/g, '').slice(0, 10);
    onPhoneNumberChange(cleanedText);
  };

  const handlePhoneInputFocus = () => {
    phoneInputRef.current?.focus();
  };

  // Indian mobile number validation: should start with 6, 7, 8, or 9 and be exactly 10 digits
  const isValidNumber = phoneNumber.length === 10 && /^[6-9]/.test(phoneNumber);
  
  const getErrorMessage = () => {
    if (phoneNumber.length === 0) return t('phoneAuth.errors.invalidPhone');
    if (phoneNumber.length < 10) return t('phoneAuth.errors.invalidPhone');
    if (!/^[6-9]/.test(phoneNumber)) return t('phoneAuth.errors.invalidPhone');
    return '';
  };

  return (
    <View style={styles.container}>
      <View style={styles.phoneInputContainer}>
        {/* India country code with flag */}
        <View style={styles.countryCode}>
          <Text style={styles.flag}>🇮🇳</Text>
          <Text style={styles.countryCodeText}>+91</Text>
        </View>

        <View style={styles.separator} />

        <View style={styles.phoneInputWrapper}>
          <TextInput
            ref={phoneInputRef}
            style={[styles.phoneInput, isValidNumber && styles.validInput]}
            placeholder={t('phoneAuth.phoneNumberPlaceholder')}
            placeholderTextColor="rgba(255, 255, 255, 0.6)"
            value={phoneNumber}
            onChangeText={handlePhoneNumberChange}
            keyboardType="phone-pad"
            maxLength={10}
            textAlignVertical="center"
            autoFocus={false}
            onFocus={handlePhoneInputFocus}
            returnKeyType="done"
            onSubmitEditing={Keyboard.dismiss}
            blurOnSubmit={true}
            autoComplete="tel"
            underlineColorAndroid="transparent"
          />
          {phoneNumber.length > 0 && (
            <View style={styles.validIndicator}>
              {isValidNumber ? (
                <Ionicons name="checkmark-circle" size={RFValue(16)} color="#4CAF50" />
              ) : (
                <Ionicons name="close-circle" size={RFValue(16)} color="#FF6B6B" />
              )}
            </View>
          )}
        </View>
      </View>

      {/* Error message */}
      {showError && !isValidNumber && (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={RFValue(14)} color="#FF6B6B" />
          <Text style={styles.errorText}>{getErrorMessage()}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: wp('5%'),
    height: hp('7%'),
    paddingHorizontal: wp('4%'),
  },
  countryCode: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: hp('1%'),
    paddingRight: wp('2%'),
    minWidth: wp('15%'),
  },
  flag: {
    fontSize: RFValue(16),
    marginRight: wp('1%'),
  },
  countryCodeText: {
    fontSize: RFValue(14),
    fontWeight: '600',
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  separator: {
    width: 1,
    height: hp('3%'),
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginHorizontal: wp('2%'),
  },
  phoneInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  phoneInput: {
    flex: 1,
    fontSize: RFValue(14),
    fontWeight: '500',
    color: '#fff',
    paddingVertical: hp('1.5%'),
    textAlignVertical: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  validInput: {
    color: '#fff',
  },
  validIndicator: {
    marginLeft: wp('2%'),
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: hp('1%'),
    paddingHorizontal: wp('2%'),
  },
  errorText: {
    fontSize: RFValue(12),
    color: '#FF6B6B',
    marginLeft: wp('1%'),
    fontWeight: '500',
  },
});

// Utility function to validate Indian phone numbers
export const validateIndianPhoneNumber = (phoneNumber: string): boolean => {
  return phoneNumber.length === 10 && /^[6-9]/.test(phoneNumber);
};