// utils/phoneUtils.ts
import { parsePhoneNumberWithError, isValidPhoneNumber, CountryCode } from 'libphonenumber-js';

export interface CountryInfo {
  code: CountryCode;
  name: string;
  flag: string;
  dialCode: string;
}

export const popularCountries: CountryInfo[] = [
  { code: 'IN', name: 'India', flag: '🇮🇳', dialCode: '+91' },
  { code: 'US', name: 'United States', flag: '🇺🇸', dialCode: '+1' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧', dialCode: '+44' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦', dialCode: '+1' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺', dialCode: '+61' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪', dialCode: '+49' },
  { code: 'FR', name: 'France', flag: '🇫🇷', dialCode: '+33' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵', dialCode: '+81' },
  { code: 'KR', name: 'South Korea', flag: '🇰🇷', dialCode: '+82' },
  { code: 'CN', name: 'China', flag: '🇨🇳', dialCode: '+86' },
  { code: 'AE', name: 'UAE', flag: '🇦🇪', dialCode: '+971' },
  { code: 'SA', name: 'Saudi Arabia', flag: '🇸🇦', dialCode: '+966' },
  { code: 'SG', name: 'Singapore', flag: '🇸🇬', dialCode: '+65' },
  { code: 'MY', name: 'Malaysia', flag: '🇲🇾', dialCode: '+60' },
  { code: 'BD', name: 'Bangladesh', flag: '🇧🇩', dialCode: '+880' },
  { code: 'PK', name: 'Pakistan', flag: '🇵🇰', dialCode: '+92' },
  { code: 'LK', name: 'Sri Lanka', flag: '🇱🇰', dialCode: '+94' },
  { code: 'NP', name: 'Nepal', flag: '🇳🇵', dialCode: '+977' },
];

export const validatePhoneNumber = (phone: string, countryCode?: CountryCode): boolean => {
  try {
    if (!phone) return false;
    return isValidPhoneNumber(phone, countryCode);
  } catch (error) {
    return false;
  }
};

export const formatPhoneNumber = (phone: string, countryCode?: CountryCode): string => {
  try {
    const phoneNumber = parsePhoneNumberWithError(phone, countryCode);
    return phoneNumber?.formatInternational() || phone;
  } catch (error) {
    return phone;
  }
};

export const getFormattedPhoneNumber = (dialCode: string, phoneNumber: string): string => {
  try {
    const fullNumber = `${dialCode}${phoneNumber}`;
    const parsed = parsePhoneNumberWithError(fullNumber);
    return parsed?.format('E.164') || fullNumber;
  } catch (error) {
    return `${dialCode}${phoneNumber}`;
  }
};
