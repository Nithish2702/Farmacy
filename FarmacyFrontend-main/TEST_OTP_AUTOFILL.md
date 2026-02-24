# OTP Auto-Fill Testing Guide

## Before Testing

### 1. Rebuild the App
After making changes to the OTP hook, rebuild the app:
```bash
expo run:android
# or
npx expo run:android
```

### 2. Check SMS Permissions
- Go to device Settings > Apps > Farmacy > Permissions
- Ensure SMS permission is granted

## Testing Steps

### Test 1: Firebase Template Format
1. **Send OTP** through the app
2. **Receive SMS** with format: `123456 is your verification code for Farmacy`
3. **Check Console** for these logs:
   - `SMS received: [message content]`
   - `OTP extracted using pattern 1: [pattern] OTP: [code]`
   - `OTP auto-filled from SMS: [code]`

### Test 2: Alternative Formats
Test with these SMS formats (you can send manually for testing):

**Format 1:** `123456 is your verification code for Farmacy`
**Format 2:** `123456 is your verification code`
**Format 3:** `123456 is your`
**Format 4:** `Your verification code is 123456`
**Format 5:** `Code: 123456`

### Test 3: Manual SMS Simulation
You can manually send SMS to test:
1. Send SMS to your device with format: `123456 is your verification code for Farmacy`
2. Check if OTP field auto-fills
3. Verify console logs

## Expected Behavior

### ✅ Working Correctly
- OTP field auto-fills when SMS arrives
- Console shows SMS processing logs
- No app hash required
- Works with custom Firebase template

### ❌ Not Working
- OTP field doesn't auto-fill
- No console logs for SMS processing
- SMS permission denied
- Only works with app hash

## Debug Console Logs

Look for these specific logs in the console:

```
SMS listener started successfully (without app hash)
SMS received: [your SMS content]
Processing SMS message: [your SMS content]
OTP extracted using pattern 1: [regex pattern] OTP: [6-digit code]
OTP auto-filled from SMS: [6-digit code]
```

## Common Issues & Solutions

### Issue 1: Permission Denied
**Symptoms:** `SMS permission denied, OTP auto-fill will not work`
**Solution:** Grant SMS permission in device settings

### Issue 2: No SMS Received
**Symptoms:** No console logs for SMS
**Solution:** 
- Check if SMS actually arrived
- Verify SMS contains expected format
- Check device is receiving SMS normally

### Issue 3: OTP Not Extracted
**Symptoms:** `No OTP pattern matched for message`
**Solution:**
- Check SMS format matches expected patterns
- Try different SMS formats
- Verify regex patterns in `useOTP.ts`

### Issue 4: Still Requires App Hash
**Symptoms:** Only works with app hash in SMS
**Solution:**
- Ensure you're using updated `useOTP.ts` hook
- Rebuild the app completely
- Clear app cache

## Firebase Console Configuration

1. Go to Firebase Console
2. Project Settings > General
3. Set App Name to: `Farmacy`
4. Authentication > Templates > SMS Templates
5. Set template to: `%LOGIN_CODE% is your verification code for %APP_NAME%.`

## Manual Test SMS

You can send this test SMS to your device:
```
123456 is your verification code for Farmacy
```

## Production Checklist

- [ ] OTP auto-fills with Firebase SMS
- [ ] Works without app hash
- [ ] Console logs show SMS processing
- [ ] Manual entry still works as fallback
- [ ] SMS permissions properly requested
- [ ] Firebase template configured correctly

## Need Help?

If auto-fill still doesn't work:
1. Share console logs
2. Share exact SMS format received
3. Verify SMS permissions
4. Test with manual SMS first 