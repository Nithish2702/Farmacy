# Firebase SMS Template Configuration

## Overview
This document explains how to configure Firebase SMS templates for OTP verification without app hash dependency.

## Current Setup
- **App Name**: Farmacy
- **Template Format**: `%LOGIN_CODE% is your verification code for %APP_NAME%`
- **Expected SMS**: `123456 is your verification code for Farmacy`

## Firebase Console Configuration

### Step 1: Access Firebase Console
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `farmacy-3e39b`
3. Navigate to **Authentication** > **Templates**

### Step 2: Configure SMS Template
1. Click on **SMS templates**
2. Select **Phone number sign-in**
3. Update the template to:
   ```
   %LOGIN_CODE% is your verification code for %APP_NAME%.
   ```

### Step 3: Set App Name
1. Go to **Project Settings** > **General**
2. Ensure the **App Name** is set to: `Farmacy`

## Client-Side Configuration

### SMS Permissions
The app requires the following Android permissions (already configured):
- `RECEIVE_SMS` - To receive SMS messages
- `READ_SMS` - To read SMS content

### OTP Auto-Fill Implementation
The updated implementation:
- ✅ **No app hash dependency**
- ✅ **Works with custom SMS templates**
- ✅ **Handles SMS permissions properly**
- ✅ **Multiple pattern matching for reliability**

## Troubleshooting

### OTP Not Auto-Filling?

1. **Check SMS Permission**:
   - Ensure the app has SMS permissions granted
   - Check device settings: Apps > Farmacy > Permissions > SMS

2. **Verify SMS Format**:
   - Expected format: `123456 is your verification code for Farmacy`
   - The app supports multiple variations of this format

3. **Debug Logging**:
   - Check console logs for SMS processing messages
   - Look for "SMS received:" and "OTP extracted:" messages

4. **Test Manual Entry**:
   - If auto-fill doesn't work, manual entry should still function
   - The OTP input field accepts manual typing

### Common Issues

**Issue**: SMS received but OTP not extracted
**Solution**: Check if SMS format matches expected patterns. Add console logging to debug.

**Issue**: No SMS permission dialog
**Solution**: Ensure `RECEIVE_SMS` permission is in app.json and app is rebuilt.

**Issue**: App hash still required
**Solution**: Ensure you're using the updated `useOTP.ts` hook without hash dependency.

## Testing

### Test SMS Formats
The app should auto-fill OTP from these formats:
- `123456 is your verification code for Farmacy`
- `123456 is your verification code`
- `123456 is your`
- `verification code 123456`
- `code: 123456`

### Manual Testing
1. Send test SMS with format: `123456 is your verification code for Farmacy`
2. App should auto-fill the OTP field
3. Check console logs for debug information

## Production Checklist

- [ ] Firebase SMS template configured
- [ ] App name set to "Farmacy" in Firebase
- [ ] SMS permissions granted on device
- [ ] OTP auto-fill tested with real SMS
- [ ] Fallback manual entry works
- [ ] Console logging disabled for production builds

## Support

If OTP auto-fill still doesn't work:
1. Check device SMS permissions
2. Verify Firebase template configuration
3. Test with different SMS formats
4. Use manual entry as fallback 