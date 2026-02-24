import React, { useRef, useState, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { View, TextInput, StyleSheet, Platform, Text, TouchableOpacity, Dimensions } from 'react-native';
import { useOTPAutoFill } from '../hooks/useOTP';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import { RFValue } from 'react-native-responsive-fontsize';

const { height } = Dimensions.get('window');

interface OTPInputProps {
  length: number;
  onComplete: (otp: string) => void;
  value: string;
  onChange: (otp: string) => void;
  autoFocus?: boolean;
  error?: boolean;
}

export interface OTPInputRef {
  startListener: () => void;
  stopSMSListener: () => void;
  forceCleanup: () => void;
  isListenerActive: boolean;
}

export const OTPInput = forwardRef<OTPInputRef, OTPInputProps>(({
  length,
  onComplete,
  value,
  onChange,
  autoFocus = true,
  error = false,
}, ref) => {
  const inputRef = useRef<TextInput>(null);
  const { autoFilledOTP, resetAutoFilledOTP, startListener, stopListener, forceCleanup, isListenerActive } = useOTPAutoFill();
  const [isFocused, setIsFocused] = useState(false);

  // Expose cleanup functions to parent component
  useImperativeHandle(ref, () => ({
    startListener,
    stopSMSListener: stopListener,
    forceCleanup,
    isListenerActive,
  }), [startListener, stopListener, forceCleanup, isListenerActive]);

  // Handle auto-filled OTP
  useEffect(() => {
    if (autoFilledOTP && autoFilledOTP.length === length && autoFilledOTP !== value) {
      onChange(autoFilledOTP);
      onComplete(autoFilledOTP);
    }
  }, [autoFilledOTP, length, onChange, onComplete, value]);

  // Reset auto-fill when value is cleared
  useEffect(() => {
    if (value === '') {
      resetAutoFilledOTP();
    }
  }, [value, resetAutoFilledOTP]);

  // Check if OTP is complete whenever value changes
  useEffect(() => {
    if (value.length === length) {
      onComplete(value);
    }
  }, [value, length, onComplete]);

  const handleTextChange = useCallback((text: string) => {
    // Remove any non-numeric characters and limit to length
    const cleanText = text.replace(/\D/g, '').slice(0, length);
    onChange(cleanText);
  }, [length, onChange]);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    // Ensure cursor is positioned at the end of current value
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.setNativeProps({
          selection: { start: value.length, end: value.length }
        });
      }
    }, 50);
  }, [value.length]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
  }, []);

  const focusInput = useCallback(() => {
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        // Set cursor position to end of current value
        inputRef.current.setNativeProps({
          selection: { start: value.length, end: value.length }
        });
      }
    }, 50);
  }, [value.length]);

  // Create array of digits for display
  const digits = Array.from({ length }, (_, index) => value[index] || '');

  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={styles.otpContainer}
        onPress={focusInput}
        activeOpacity={1}
      >
        {/* Hidden TextInput for actual input */}
        <TextInput
          ref={inputRef}
          style={styles.hiddenInput}
          value={value}
          onChangeText={handleTextChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          keyboardType="numeric"
          maxLength={length}
          autoFocus={autoFocus}
          textContentType={Platform.OS === 'ios' ? 'oneTimeCode' : undefined}
          autoComplete={Platform.OS === 'android' ? 'sms-otp' : undefined}
          selectTextOnFocus={false}
          contextMenuHidden={true}
          selection={{ start: value.length, end: value.length }}
        />
        
        {/* Visual OTP boxes */}
        {digits.map((digit, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.otpBox,
              digit && styles.filledBox,
              isFocused && index === value.length && styles.focusedBox,
              error && styles.errorBox,
            ]}
            onPress={focusInput}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.otpText,
              digit && styles.filledText,
              error && styles.errorText,
            ]}>
              {digit}
            </Text>
          </TouchableOpacity>
        ))}
      </TouchableOpacity>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: wp('2.5%'),
    paddingVertical: hp('1%'),
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
    zIndex: -1,
  },
  otpBox: {
    width: height < 700 ? wp('10%') : wp('11%'),
    height: height < 700 ? hp('6%') : hp('7%'),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: wp('3%'),
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filledBox: {
    borderColor: '#4CAF50',
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
  },
  focusedBox: {
    borderColor: '#81C784',
    backgroundColor: 'rgba(129, 199, 132, 0.15)',
  },
  errorBox: {
    borderColor: '#f44336',
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
  },
  otpText: {
    fontSize: height < 700 ? RFValue(18) : RFValue(22),
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
  },
  filledText: {
    color: '#fff',
  },
  errorText: {
    color: '#f44336',
  },
});