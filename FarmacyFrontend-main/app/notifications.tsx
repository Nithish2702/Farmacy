import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RFValue } from 'react-native-responsive-fontsize';
import { heightPercentageToDP as hp, widthPercentageToDP as wp } from 'react-native-responsive-screen';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/theme';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { fcmService, NotificationResponse } from '@/api/fcmService';
import { useNotification } from '@/context/NotificationsContext';

const NotificationHistoryScreen: React.FC = () => {
  const { colors, isDarkMode } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  
  // Use global notification context for marking as read
  const { markNotificationAsRead: globalMarkAsRead, markAllNotificationsAsRead: globalMarkAllAsRead } = useNotification();

  const [notifications, setNotifications] = useState<NotificationResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [markingAsRead, setMarkingAsRead] = useState<number | null>(null);
  const [markingAllAsRead, setMarkingAllAsRead] = useState(false);
  const [showReadNotifications, setShowReadNotifications] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreNotifications, setHasMoreNotifications] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);

  const loadNotifications = useCallback(async (isRefresh = false, loadMore = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
        setCurrentPage(0);
        setHasMoreNotifications(true);
      } else if (loadMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      const pageToLoad = isRefresh ? 0 : (loadMore ? currentPage + 1 : 0);
      const skip = pageToLoad * 10;
      const limit = 10;
      
      // Only fetch unread by default unless user explicitly wants to see read notifications
      const unreadOnly = !showReadNotifications;
      
      const data = await fcmService.getNotifications(skip, limit, undefined, unreadOnly);
      
      if (isRefresh || !loadMore) {
        setNotifications(data);
        setCurrentPage(0);
      } else {
        // Load more - append to existing notifications
        setNotifications(prev => [...prev, ...data]);
        setCurrentPage(pageToLoad);
      }
      
      // Check if we have more notifications to load
      setHasMoreNotifications(data.length === limit);
      
    } catch (error) {
      console.error('Error loading notifications:', error);
      Alert.alert('Error', 'Failed to load notifications');
      if (!loadMore) {
        setNotifications([]);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [showReadNotifications, currentPage]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Reload notifications when toggle changes
  useEffect(() => {
    if (notifications.length > 0) {
      loadNotifications(true); // Refresh when switching between read/unread
    }
  }, [showReadNotifications]);

  const markAsRead = async (notificationId: number) => {
    try {
      setMarkingAsRead(notificationId);
      // Use global context to mark as read
      await globalMarkAsRead(notificationId);
      
      // Update local state for this screen
      setNotifications(prev => 
        prev.map(notif => 
          notif.id === notificationId 
            ? { ...notif, is_read: true, read_at: new Date().toISOString() }
            : notif
        )
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
      Alert.alert('Error', 'Failed to mark notification as read');
    } finally {
      setMarkingAsRead(null);
    }
  };

  const markAllAsRead = async () => {
    try {
      setMarkingAllAsRead(true);
      // Use global context to mark all as read
      await globalMarkAllAsRead();
      
      // Update local state for this screen
      setNotifications(prev => 
        prev.map(notif => ({ 
          ...notif, 
          is_read: true, 
          read_at: notif.read_at || new Date().toISOString() 
        }))
      );
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      Alert.alert('Error', 'Failed to mark all notifications as read');
    } finally {
      setMarkingAllAsRead(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 1) {
      const diffInMins = Math.floor(diffInHours * 60);
      return diffInMins <= 1 ? 'Just now' : `${diffInMins} mins ago`;
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)} hours ago`;
    } else if (diffInHours < 168) { // 7 days
      const diffInDays = Math.floor(diffInHours / 24);
      return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'WEATHER_ALERT':
        return 'thunderstorm-outline';
      case 'DISEASE_ALERT':
        return 'medical-outline';
      case 'MARKET_UPDATE':
        return 'stats-chart-outline';
      case 'DAILY_UPDATE':
        return 'today-outline';
      case 'NEWS_ALERT':
        return 'newspaper-outline';
      case 'SYSTEM_ALERT':
        return 'settings-outline';
      case 'CROP_ALERT':
        return 'leaf-outline';
      default:
        return 'notifications-outline';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT':
        return colors.error;
      case 'HIGH':
        return colors.warning;
      case 'MEDIUM':
        return colors.info;
      case 'LOW':
        return colors.success;
      default:
        return colors.textSecondary;
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: insets.top,
      paddingHorizontal: wp('4%'),
      paddingVertical: hp('2%'),
      backgroundColor: colors.background,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    backButton: {
      marginRight: wp('3%'),
      padding: wp('2%'),
    },
    headerTitle: {
      fontSize: RFValue(20),
      fontWeight: '700',
      color: colors.text,
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    markAllButton: {
      paddingHorizontal: wp('3%'),
      paddingVertical: hp('1%'),
      backgroundColor: colors.primary,
      borderRadius: wp('2%'),
    },
    markAllButtonText: {
      fontSize: RFValue(12),
      fontWeight: '600',
      color: colors.white,
    },
    content: {
      flex: 1,
    },
    filterContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: wp('4%'),
      paddingVertical: hp('1.5%'),
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    filterLabel: {
      fontSize: RFValue(14),
      fontWeight: '600',
      marginRight: wp('3%'),
    },
    filterButtons: {
      flexDirection: 'row',
      gap: wp('2%'),
    },
    filterButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: wp('3%'),
      paddingVertical: hp('1%'),
      borderRadius: wp('2%'),
      borderWidth: 1,
      gap: wp('1.5%'),
    },
    filterButtonText: {
      fontSize: RFValue(12),
      fontWeight: '600',
    },
    statsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: wp('4%'),
      paddingVertical: hp('2%'),
      backgroundColor: colors.card,
      marginHorizontal: wp('4%'),
      marginTop: hp('2%'),
      borderRadius: wp('3%'),
      borderWidth: 1,
      borderColor: colors.border,
    },
    statsText: {
      fontSize: RFValue(14),
      fontWeight: '600',
      color: colors.text,
    },
    unreadBadge: {
      backgroundColor: colors.accent,
      paddingHorizontal: wp('3%'),
      paddingVertical: hp('0.5%'),
      borderRadius: wp('4%'),
    },
    unreadBadgeText: {
      fontSize: RFValue(12),
      fontWeight: '600',
      color: colors.white,
    },
    notificationsList: {
      paddingHorizontal: wp('4%'),
      paddingTop: hp('2%'),
    },
    notificationItem: {
      backgroundColor: colors.card,
      borderRadius: wp('3%'),
      padding: wp('4%'),
      marginBottom: hp('2%'),
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: 'row',
    },
    unreadNotification: {
      borderLeftWidth: wp('1%'),
      borderLeftColor: colors.accent,
    },
    notificationIcon: {
      width: wp('12%'),
      height: wp('12%'),
      borderRadius: wp('6%'),
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: wp('3%'),
      borderWidth: 2,
      borderColor: colors.border,
      shadowColor: colors.text,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    notificationContent: {
      flex: 1,
    },
    notificationHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: hp('1%'),
    },
    notificationTitle: {
      fontSize: RFValue(14),
      fontWeight: '600',
      color: colors.text,
      flex: 1,
      marginRight: wp('2%'),
    },
    priorityBadge: {
      paddingHorizontal: wp('2.5%'),
      paddingVertical: hp('0.4%'),
      borderRadius: wp('2%'),
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 2,
      elevation: 2,
    },
    priorityText: {
      fontSize: RFValue(9),
      fontWeight: '700',
      color: colors.white,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    notificationMessage: {
      fontSize: RFValue(13),
      color: colors.textSecondary,
      lineHeight: RFValue(18),
      marginBottom: hp('1%'),
    },
    notificationFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    notificationTime: {
      fontSize: RFValue(11),
      color: colors.textSecondary,
    },
    markReadButton: {
      paddingHorizontal: wp('3.5%'),
      paddingVertical: hp('0.7%'),
      backgroundColor: colors.primary,
      borderRadius: wp('2%'),
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 3,
      elevation: 3,
    },
    markReadButtonText: {
      fontSize: RFValue(10),
      fontWeight: '700',
      color: colors.white,
      textAlign: 'center',
    },
    readIndicator: {
      fontSize: RFValue(10),
      color: colors.success,
      fontWeight: '600',
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: wp('4%'),
    },
    emptyIcon: {
      marginBottom: hp('2%'),
    },
    emptyTitle: {
      fontSize: RFValue(18),
      fontWeight: '600',
      color: colors.text,
      marginBottom: hp('1%'),
      textAlign: 'center',
    },
    emptyMessage: {
      fontSize: RFValue(14),
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: RFValue(20),
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    listLoadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: hp('10%'),
      minHeight: hp('40%'),
    },
    loadingText: {
      fontSize: RFValue(14),
      color: colors.textSecondary,
      marginTop: hp('2%'),
    },
    loadMoreContainer: {
      paddingVertical: hp('2%'),
      paddingHorizontal: wp('4%'),
      alignItems: 'center',
    },
    loadMoreButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: wp('6%'),
      paddingVertical: hp('1.5%'),
      backgroundColor: colors.background,
      borderRadius: wp('3%'),
      borderWidth: 1,
      borderColor: colors.border,
      gap: wp('2%'),
    },
    loadMoreButtonText: {
      fontSize: RFValue(13),
      fontWeight: '600',
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={RFValue(24)} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifications</Text>
        </View>
        
        {!showReadNotifications && unreadCount > 0 && (
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.markAllButton}
              onPress={markAllAsRead}
              disabled={markingAllAsRead}
            >
              {markingAllAsRead ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.markAllButtonText}>Mark All Read</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Filter Section */}
      <View style={styles.filterContainer}>
        <Text style={[styles.filterLabel, { color: colors.text }]}>Show:</Text>
        <View style={styles.filterButtons}>
          <TouchableOpacity
            style={[styles.filterButton, { 
              backgroundColor: !showReadNotifications ? colors.primary : colors.background,
              borderColor: !showReadNotifications ? colors.primary : colors.border,
              opacity: loading ? 0.6 : 1
            }]}
            onPress={() => setShowReadNotifications(false)}
            disabled={loading}
          >
            <Ionicons 
              name="mail-unread-outline" 
              size={RFValue(14)} 
              color={!showReadNotifications ? colors.white : colors.textSecondary} 
            />
            <Text style={[styles.filterButtonText, { 
              color: !showReadNotifications ? colors.white : colors.textSecondary 
            }]}>
              Unread Only
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.filterButton, { 
              backgroundColor: showReadNotifications ? colors.primary : colors.background,
              borderColor: showReadNotifications ? colors.primary : colors.border,
              opacity: loading ? 0.6 : 1
            }]}
            onPress={() => setShowReadNotifications(true)}
            disabled={loading}
          >
            <Ionicons 
              name="mail-outline" 
              size={RFValue(14)} 
              color={showReadNotifications ? colors.white : colors.textSecondary} 
            />
            <Text style={[styles.filterButtonText, { 
              color: showReadNotifications ? colors.white : colors.textSecondary 
            }]}>
              All Notifications
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadNotifications(true)}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {loading ? (
          <View style={styles.listLoadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading notifications...</Text>
          </View>
        ) : (
          <>
            {notifications.length > 0 && (
              <View style={styles.statsContainer}>
                <Text style={styles.statsText}>
                  {notifications.length} {showReadNotifications ? 'Total' : 'Unread'} Notification{notifications.length !== 1 ? 's' : ''}
                </Text>
                {showReadNotifications && unreadCount > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadBadgeText}>
                      {unreadCount} Unread
                    </Text>
                  </View>
                )}
              </View>
            )}

            {notifications.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons 
              name={showReadNotifications ? "notifications-off-outline" : "checkmark-circle-outline"} 
              size={RFValue(64)} 
              color={showReadNotifications ? colors.textSecondary : colors.success}
              style={styles.emptyIcon}
            />
            <Text style={styles.emptyTitle}>
              {showReadNotifications ? t('notifications.noNotifications') : t('notifications.allCaughtUp')}
            </Text>
            <Text style={styles.emptyMessage}>
              {showReadNotifications 
                ? t('notifications.emptyState.message')
                : t('notifications.emptyState.message')
              }
            </Text>
          </View>
        ) : (
          <View style={styles.notificationsList}>
            {notifications.map((notification) => (
              <View
                key={notification.id}
                style={[
                  styles.notificationItem,
                  !notification.is_read && styles.unreadNotification,
                ]}
              >
                <View style={styles.notificationIcon}>
                  <Ionicons
                    name={getNotificationIcon(notification.type)}
                    size={RFValue(20)}
                    color={getPriorityColor(notification.priority)}
                  />
                </View>
                
                <View style={styles.notificationContent}>
                  <View style={styles.notificationHeader}>
                    <Text style={styles.notificationTitle}>
                      {notification.title}
                    </Text>
                    <View
                      style={[
                        styles.priorityBadge,
                        { backgroundColor: getPriorityColor(notification.priority) },
                      ]}
                    >
                      <Text style={styles.priorityText}>
                        {notification.priority}
                      </Text>
                    </View>
                  </View>

                  {/* Show image if present */}
                  {notification.data?.image_url && notification.data.image_url !== 'None' && notification.data.image_url !== '' && (
                    <Image
                      source={{ uri: notification.data.image_url }}
                      style={{ width: '100%', height: 120, borderRadius: 12, marginBottom: 8, backgroundColor: '#eee' }}
                      resizeMode="cover"
                    />
                  )}

                  <Text style={styles.notificationMessage}>
                    {notification.message}
                  </Text>
                  
                  <View style={styles.notificationFooter}>
                    <Text style={styles.notificationTime}>
                      {formatDate(notification.created_at)}
                    </Text>
                    
                    {!notification.is_read ? (
                      <TouchableOpacity
                        style={styles.markReadButton}
                        onPress={() => markAsRead(notification.id)}
                        disabled={markingAsRead === notification.id}
                      >
                        {markingAsRead === notification.id ? (
                          <ActivityIndicator size="small" color={colors.white} />
                        ) : (
                          <Text style={styles.markReadButtonText}>Mark Read</Text>
                        )}
                      </TouchableOpacity>
                    ) : (
                      <Text style={styles.readIndicator}>✓ Read</Text>
                    )}
                  </View>
                </View>
              </View>
                         ))}
             
             {/* Load More Button */}
             {hasMoreNotifications && notifications.length > 0 && (
               <View style={styles.loadMoreContainer}>
                 <TouchableOpacity
                   style={styles.loadMoreButton}
                   onPress={() => loadNotifications(false, true)}
                   disabled={loadingMore}
                 >
                   {loadingMore ? (
                     <ActivityIndicator size="small" color={colors.primary} />
                   ) : (
                     <>
                       <Ionicons name="chevron-down" size={RFValue(16)} color={colors.primary} />
                       <Text style={[styles.loadMoreButtonText, { color: colors.primary }]}>
                         Load More Notifications
                       </Text>
                     </>
                   )}
                 </TouchableOpacity>
               </View>
                          )}
           </View>
         )}
         </>
       )}
       </ScrollView>
     </View>
   );
 };

export default NotificationHistoryScreen; 