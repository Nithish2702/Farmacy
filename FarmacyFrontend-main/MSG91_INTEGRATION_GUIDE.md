# MSG91 OTP Widget Integration Guide

This guide explains how to integrate the MSG91 OTP Widget service into the Farmacy application.

## Overview

The MSG91 OTP Widget provides a complete OTP verification solution with the following features:
- **Client-side OTP sending and verification** using MSG91's React Native SDK
- **Server-side access token verification** for security
- **Multiple communication channels** (SMS, WhatsApp, Voice, Email)
- **Automatic retry functionality** with channel selection
- **Secure access token generation** for user authentication

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Native  │    │   MSG91 API     │    │   Farmacy       │
│   Frontend      │    │   (Widget)      │    │   Backend       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │ 1. Send OTP          │                       │
         │─────────────────────▶│                       │
         │                       │                       │
         │ 2. Verify OTP        │                       │
         │─────────────────────▶│                       │
         │                       │                       │
         │ 3. Access Token      │                       │
         │◀─────────────────────│                       │
         │                       │                       │
         │ 4. Verify Token      │                       │
         │─────────────────────────────────────────────▶│
         │                       │                       │
         │ 5. User Status       │                       │
         │◀─────────────────────────────────────────────│
```

## Setup Instructions

### 1. MSG91 Dashboard Configuration

1. **Create OTP Widget**:
   - Log in to your MSG91 dashboard
   - Navigate to the OTP section
   - Click "Create New Widget"
   - Configure the widget settings:
     - **Widget Name**: Farmacy OTP
     - **Verification Type**: Login using OTP
     - **Contact Point**: Mobile Number
     - **Primary Channel**: SMS
     - **OTP Length**: 6
     - **Resend Count**: 3
     - **Resend Time**: 30 seconds
     - **OTP Expiry**: 5 minutes
     - **Mobile Integration**: Enabled
     - **Captcha Validation**: Disabled (for mobile apps)

2. **Configure Templates**:
   - Create SMS template for OTP delivery
   - Template variables: `{{otp}}` for the OTP code
   - Example: "Your Farmacy verification code is {{otp}}. Valid for 5 minutes."

3. **Get Credentials**:
   - **Widget ID**: Copy from widget configuration
   - **Auth Token**: Generate from Token section
   - **Auth Key**: Copy from your account settings

### 2. Frontend Configuration

Update the configuration file `config/msg91.ts`:

```typescript
export const MSG91_CONFIG = {
  WIDGET_ID: 'your_actual_widget_id_here',
  AUTH_TOKEN: 'your_actual_auth_token_here',
  API_BASE_URL: 'https://your-backend-url.com',
};
```

### 3. Backend Configuration

Add the following environment variables to your `.env` file:

```env
# MSG91 OTP Widget Configuration
MSG91_AUTH_KEY=your_actual_auth_key_here
```

## API Endpoints

### Frontend (MSG91 SDK)

```typescript
// Initialize widget
await OTPWidget.initializeWidget(widgetId, authToken);

// Send OTP
const response = await OTPWidget.sendOTP({ identifier: phoneNumber });

// Verify OTP
const response = await OTPWidget.verifyOTP({ reqId, otp });

// Retry OTP
const response = await OTPWidget.retryOTP({ reqId, retryChannel });
```

### Backend (Farmacy API)

#### Verify Access Token
**POST** `/otp/verify-access-token`

```json
{
  "access_token": "jwt_token_from_msg91_widget"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Access token verified successfully",
  "phone_number": "+919876543210",
  "user_exists": true,
  "access_token": "farmacy_jwt_token",
  "refresh_token": "farmacy_refresh_token"
}
```

## Usage Flow

### 1. User Registration/Login

```typescript
// Step 1: Send OTP
const sendResult = await msg91OtpService.sendOTP(phoneNumber);

// Step 2: User enters OTP
// Step 3: Verify OTP and get access token
const verifyResult = await msg91OtpService.verifyOTP(reqId, otp);

// Step 4: Verify access token on server
const serverResult = await msg91OtpService.verifyAccessToken(accessToken);

// Step 5: Handle user authentication
if (serverResult.user_exists) {
  // Existing user - redirect to dashboard
} else {
  // New user - redirect to profile completion
}
```

### 2. OTP Retry

```typescript
// Retry on SMS channel
const retryResult = await msg91OtpService.retryOTP(reqId, MSG91_CHANNELS.SMS);

// Retry on WhatsApp channel
const retryResult = await msg91OtpService.retryOTP(reqId, MSG91_CHANNELS.WHATSAPP);
```

## Error Handling

### Common Error Scenarios

1. **Network Errors**:
   ```typescript
   catch (error) {
     if (error.message.includes('network')) {
       // Handle network connectivity issues
     }
   }
   ```

2. **Rate Limiting**:
   ```typescript
   catch (error) {
     if (error.message.includes('too many requests')) {
       // Handle rate limiting
     }
   }
   ```

3. **Invalid OTP**:
   ```typescript
   catch (error) {
     if (error.message.includes('invalid')) {
       // Handle invalid OTP
     }
   }
   ```

### Error Messages

The service provides predefined error messages in `config/msg91.ts`:

```typescript
export const MSG91_ERRORS = {
  INITIALIZATION_FAILED: 'Failed to initialize OTP service',
  SEND_FAILED: 'Failed to send OTP',
  VERIFY_FAILED: 'Failed to verify OTP',
  RETRY_FAILED: 'Failed to resend OTP',
  NETWORK_ERROR: 'Network error. Please check your connection',
  INVALID_PHONE: 'Invalid phone number format',
  TOO_MANY_REQUESTS: 'Too many requests. Please try again later',
  QUOTA_EXCEEDED: 'SMS quota exceeded. Please try again later',
};
```

## Security Features

1. **Access Token Verification**: All OTP verifications are validated server-side
2. **JWT Token Generation**: Secure tokens for user authentication
3. **Rate Limiting**: Built-in protection against abuse
4. **Channel Selection**: Multiple communication channels for reliability
5. **Automatic Expiry**: OTPs expire automatically for security

## Testing

### Demo Credentials

Configure demo credentials in your MSG91 widget for testing:

- **Phone Number**: 9999999999
- **Email**: demo@msg91.com
- **OTP**: 123456

### Test Flow

1. Use demo phone number for testing
2. Enter the demo OTP (123456)
3. Verify the complete flow works
4. Test retry functionality
5. Test error scenarios

## Troubleshooting

### Common Issues

1. **Widget Initialization Failed**:
   - Check widget ID and auth token
   - Ensure mobile integration is enabled
   - Verify network connectivity

2. **OTP Not Received**:
   - Check phone number format
   - Verify SMS template configuration
   - Check MSG91 account balance

3. **Access Token Verification Failed**:
   - Verify auth key configuration
   - Check backend API connectivity
   - Ensure proper error handling

### Debug Logging

Enable debug logging to troubleshoot issues:

```typescript
// Frontend logging
console.log('MSG91 Send OTP response:', response);
console.log('MSG91 Verify OTP response:', response);

// Backend logging
logger.info(f"MSG91 API response: {msg91_data}");
logger.error(f"MSG91 verification failed: {error_msg}");
```

## Migration from Custom OTP

If migrating from the custom OTP system:

1. **Update Frontend**: Replace `otpService` with `msg91OtpService`
2. **Update Backend**: Add MSG91 access token verification endpoint
3. **Update Configuration**: Add MSG91 credentials
4. **Test Thoroughly**: Verify all flows work correctly
5. **Monitor**: Check logs for any issues

## Support

For MSG91-specific issues:
- MSG91 Documentation: https://msg91.com/help/sendotp/how-to-integrate-the-new-login-with-otp-widget
- MSG91 Support: support@msg91.com

For Farmacy-specific issues:
- Check application logs
- Review error messages
- Verify configuration settings