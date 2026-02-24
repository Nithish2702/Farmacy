import { getApp } from '@react-native-firebase/app';
import { getMessaging, onMessage, setBackgroundMessageHandler } from '@react-native-firebase/messaging';
import * as Notifications from 'expo-notifications';

// Initialize Firebase app if not already initialized
const app = getApp();

// Get messaging instance
const messaging = getMessaging(app);

// Register background handler
setBackgroundMessageHandler(messaging, async remoteMessage => {
  console.log('Message handled in the background!', remoteMessage);
  
  // Show the notification
  await Notifications.scheduleNotificationAsync({
    content: {
      title: remoteMessage.notification?.title || 'New Notification',
      body: remoteMessage.notification?.body || '',
      data: remoteMessage.data || {},
    },
    trigger: null,
  });
});

// Register foreground handler
onMessage(messaging, async remoteMessage => {
  console.log('Received foreground message:', remoteMessage);
  
  // Show the notification
  await Notifications.scheduleNotificationAsync({
    content: {
      title: remoteMessage.notification?.title || 'New Notification',
      body: remoteMessage.notification?.body || '',
      data: remoteMessage.data || {},
    },
    trigger: null,
  });
}); 