import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

export async function registerForPushNotificationsAsync() {
    if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
            sound: 'default',
        });
    }

    if (Device.isDevice) {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        if (finalStatus !== 'granted') {
            alert('Failed to get push token for push notification!');
            return;
        }

        const projectId = Constants.expoConfig?.extra?.projectId ?? Constants.easConfig?.projectId;
        if (!projectId) {
            console.warn('No project ID found in Expo config. Push notifications may not work as expected.');
        }

        try {
            const pushTokenString = (
                await Notifications.getExpoPushTokenAsync({
                    projectId: projectId,
                })
            ).data;
            const pushToken = await Notifications.getDevicePushTokenAsync();
            console.log('Device push token (FCM):', pushToken.data);
            console.log('Push token (Expo):', pushTokenString);

            return { expoPushToken: pushTokenString, fcmToken: pushToken.data };
        } catch (error: unknown) {
            console.error('Error getting push token:', error);
            throw new Error(`${error}`);
        }
    } else {
        throw new Error('Must use physical device for Push Notifications');
    }
}