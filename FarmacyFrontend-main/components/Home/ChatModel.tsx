import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  FlatList,
  Modal,
  StyleSheet,
  Platform,
  Keyboard,
  KeyboardAvoidingView,
  StatusBar,
  Dimensions,
  PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import { RFValue } from 'react-native-responsive-fontsize';
import { heightPercentageToDP as hp, widthPercentageToDP as wp } from 'react-native-responsive-screen';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import chatbotService, { ChatMessage } from '@/api/chatbotService';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ChatModalProps {
  isChatOpen: boolean;
  setChatOpen: (open: boolean) => void;
  chatInput: string;
  setChatInput: (input: string) => void;
  sendMessage: (message: ChatMessage) => void;
  chatHistory: ChatMessage[];
  colors: {
    card: string;
    text: string;
    primary: string;
    background: string;
    border: string;
    secondary: string;
  };
}

const ChatModal: React.FC<ChatModalProps> = ({
  isChatOpen,
  setChatOpen,
  chatInput,
  setChatInput,
  sendMessage,
  chatHistory,
  colors,
}) => {
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [isSending, setIsSending] = useState(false);
  
  // Animation values
  const translateY = useSharedValue(SCREEN_HEIGHT * 0.85);
  const backdropOpacity = useSharedValue(0);

  // Smooth open/close animations
  useEffect(() => {
    if (isChatOpen) {
      translateY.value = withSpring(0, {
        damping: 20,
        stiffness: 250,
        mass: 0.8,
        overshootClamping: false,
        restDisplacementThreshold: 0.01,
        restSpeedThreshold: 2,
      });
      backdropOpacity.value = withTiming(1, { duration: 300 });
    } else {
      translateY.value = withSpring(SCREEN_HEIGHT * 0.85, {
        damping: 25,
        stiffness: 200,
        mass: 1,
      });
      backdropOpacity.value = withTiming(0, { duration: 250 });
    }
  }, [isChatOpen]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (chatHistory.length > 0 && flatListRef.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [chatHistory]);

  // Function to remove emojis from text
  const removeEmojis = (text: string): string => {
    // Remove emoji characters using regex
    return text.replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F018}-\u{1F270}]|[\u{238C}-\u{2454}]|[\u{20D0}-\u{20FF}]|[\u{FE00}-\u{FE0F}]|[\u{1F900}-\u{1F9FF}]|[\u{1F018}-\u{1F270}]|[\u{238C}-\u{2454}]|[\u{20D0}-\u{20FF}]|[\u{FE00}-\u{FE0F}]|[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '');
  };

  const closeChat = () => {
    setChatOpen(false);
    Keyboard.dismiss();
  };

  // PanResponder ONLY for the drag handle area
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false, // Don't capture by default
      onMoveShouldSetPanResponder: () => false,  // Don't capture by default
      onPanResponderTerminationRequest: () => true,
      onShouldBlockNativeResponder: () => false,
    })
  ).current;

  // Separate PanResponder for ONLY the drag handle
  const handlePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return Math.abs(gestureState.dy) > 5;
      },
      onPanResponderGrant: () => {
        Keyboard.dismiss();
      },
      onPanResponderMove: (evt, gestureState) => {
        const dy = Math.max(0, gestureState.dy);
        translateY.value = dy;
        
        const progress = Math.min(dy / 200, 1);
        backdropOpacity.value = Math.max(1 - progress * 0.7, 0.3);
      },
      onPanResponderRelease: (evt, gestureState) => {
        const shouldClose = gestureState.dy > 100 || gestureState.vy > 0.5;
        
        if (shouldClose) {
          const modalHeight = SCREEN_HEIGHT * 0.85;
          translateY.value = withSpring(modalHeight);
          backdropOpacity.value = withTiming(0);
          setTimeout(closeChat, 200);
        } else {
          translateY.value = withSpring(0);
          backdropOpacity.value = withTiming(1);
        }
      },
    })
  ).current;

  // Animated styles
  const modalAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.value }],
    };
  });

  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  // Header animation based on scroll
  const headerAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      translateY.value,
      [0, 50],
      [1, 0.8],
      Extrapolate.CLAMP
    );
    return {
      opacity,
    };
  });

  const handleSendMessage = () => {
    if (chatInput.trim()) {
      // Create user message
      const userMessage: ChatMessage = {
        id: Date.now(),
        type: 'user',
        message: chatInput.trim(),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      // Send message through parent component
      sendMessage(userMessage);
      
      // Clear input
      setChatInput('');
      
      // Show typing indicator
      setIsTyping(true);
      
      // Hide typing indicator after a delay
      setTimeout(() => {
        setIsTyping(false);
      }, 3000);
    }
  };

  const renderMessage = ({ item: chat }: { item: ChatMessage }) => (
    <Animated.View
      style={[
        styles.chatMessage,
        chat.type === 'user' ? styles.userMessage : styles.assistantMessage,
      ]}
    >
      {chat.type === 'assistant' && (
        <View style={[styles.avatarContainer, { 
          backgroundColor: colors.primary + '15',
          shadowColor: colors.primary,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.2,
          shadowRadius: 3,
          elevation: 3,
        }]}>
          <Ionicons name="leaf" size={RFValue(16)} color={colors.primary} />
        </View>
      )}
      
      <View
        style={[
          styles.messageContainer,
          chat.type === 'user' 
            ? [styles.userMessageContainer, { 
                backgroundColor: colors.primary,
                shadowColor: colors.primary,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.3,
                shadowRadius: 4,
                elevation: 4,
              }]
            : [styles.assistantMessageContainer, { 
                backgroundColor: colors.background,
                borderColor: colors.border + '30',
                borderWidth: 1,
                shadowColor: colors.text,
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.1,
                shadowRadius: 2,
                elevation: 2,
              }]
        ]}
      >
        <Text
          style={[
            styles.chatMessageText,
            { color: chat.type === 'user' ? 'white' : colors.text }
          ]}
        >
          {chat.message}
        </Text>
        {chat.timestamp && (
          <Text
            style={[
              styles.messageTime,
              { color: chat.type === 'user' ? 'rgba(255,255,255,0.8)' : colors.text + '60' }
            ]}
          >
            {chat.timestamp}
          </Text>
        )}
      </View>
    </Animated.View>
  );

  const renderTypingIndicator = () => (
    <View style={[styles.chatMessage, styles.assistantMessage]}>
      <View style={[styles.avatarContainer, { 
        backgroundColor: colors.primary + '15',
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
        elevation: 3,
      }]}>
        <Ionicons name="leaf" size={RFValue(16)} color={colors.primary} />
      </View>
      <View style={[styles.messageContainer, styles.assistantMessageContainer, { 
        backgroundColor: colors.background,
        borderColor: colors.border + '30',
        borderWidth: 1,
        shadowColor: colors.text,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
      }]}>
        <View style={styles.typingDots}>
          <Animated.View style={[styles.dot, { backgroundColor: colors.primary + '60' }]} />
          <Animated.View style={[styles.dot, { backgroundColor: colors.primary + '60' }]} />
          <Animated.View style={[styles.dot, { backgroundColor: colors.primary + '60' }]} />
        </View>
      </View>
    </View>
  );

  return (
    <Modal
      visible={isChatOpen}
      transparent
      animationType="none"
      onRequestClose={closeChat}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalContainer}
        keyboardVerticalOffset={0}
      >
        {/* Backdrop */}
        <Animated.View style={[styles.backdrop, backdropAnimatedStyle]} />
        
        {/* Beautiful Chat Modal */}
        <Animated.View
          style={[
            styles.chatModal,
            {
              backgroundColor: colors.card,
              paddingTop: hp('1%'),
              paddingBottom: insets.bottom || hp('2%'),
            },
            modalAnimatedStyle,
          ]}
        >
          {/* Drag Handle - ONLY this area can drag */}
          <Animated.View 
            style={[styles.dragIndicatorContainer, headerAnimatedStyle]}
            {...handlePanResponder.panHandlers}
          >
            <View style={[styles.dragIndicator, { backgroundColor: colors.text + '30' }]} />
          </Animated.View>

          {/* Enhanced Header */}
          <Animated.View style={[styles.chatHeader, { borderBottomColor: colors.border + '50' }, headerAnimatedStyle]}>
            <View style={styles.chatHeaderContent}>
              <View style={[styles.headerAvatar, { backgroundColor: colors.primary + '15' }]}>
                <Ionicons name="leaf" size={RFValue(24)} color={colors.primary} />
              </View>
              <View style={styles.headerTextContainer}>
                <Text style={[styles.chatTitle, { color: colors.text }]}>
                  Farmacy AI Assistant
                </Text>
                <View style={styles.statusContainer}>
                  <View style={[styles.onlineIndicator, { backgroundColor: '#4CAF50' }]} />
                  <Text style={[styles.chatSubtitle, { color: colors.text + '70' }]}>
                    {isTyping ? 'Typing...' : 'Online'}
                  </Text>
                </View>
              </View>
            </View>
            <TouchableOpacity 
              onPress={closeChat}
              style={[styles.closeButton, { backgroundColor: colors.background + '80' }]}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={RFValue(20)} color={colors.text + '80'} />
            </TouchableOpacity>
          </Animated.View>

          {/* Chat Messages - This can scroll freely */}
          <FlatList
            ref={flatListRef}
            data={chatHistory}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id.toString()}
            style={styles.chatListContainer}
            contentContainerStyle={styles.chatListContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            ListFooterComponent={isTyping ? renderTypingIndicator : null}
            onContentSizeChange={() => {
              flatListRef.current?.scrollToEnd({ animated: true });
            }}
          />

          {/* Enhanced Input Area */}
          <View style={[styles.chatInputContainer, { 
            backgroundColor: colors.background + '90',
            borderTopColor: colors.border + '30',
            borderTopWidth: 1,
          }]}>
            <View style={[styles.inputWrapper, { 
              backgroundColor: colors.card, 
              borderColor: colors.border + '50',
              shadowColor: colors.text,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 3,
            }]}>
              <TextInput
                style={[styles.chatTextInput, { color: colors.text }]}
                placeholder="Ask about your crops or farming..."
                placeholderTextColor={colors.text + '50'}
                value={chatInput}
                onChangeText={(text) => setChatInput(removeEmojis(text))}
                multiline
                maxLength={500}
                returnKeyType="send"
                onSubmitEditing={handleSendMessage}
                blurOnSubmit={false}
              />
            </View>
            
            <TouchableOpacity 
              style={[
                styles.sendButton, 
                { 
                  backgroundColor: chatInput.trim() ? colors.primary : colors.background + '60',
                  shadowColor: chatInput.trim() ? colors.primary : 'transparent',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: chatInput.trim() ? 0.3 : 0,
                  shadowRadius: 4,
                  elevation: chatInput.trim() ? 4 : 0,
                }
              ]}
              onPress={handleSendMessage}
              disabled={!chatInput.trim()}
              activeOpacity={0.8}
            >
              <Ionicons 
                name="send" 
                size={RFValue(18)} 
                color={chatInput.trim() ? 'white' : colors.text + '40'} 
              />
            </TouchableOpacity>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  chatModal: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '85%',
    borderTopLeftRadius: wp('6%'),
    borderTopRightRadius: wp('6%'),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 25,
  },
  dragIndicatorContainer: {
    alignItems: 'center',
    paddingVertical: hp('2%'),
    paddingTop: hp('2.5%'),
  },
  dragIndicator: {
    width: wp('12%'),
    height: hp('0.6%'),
    borderRadius: wp('3%'),
    opacity: 0.6,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('2.5%'),
    borderBottomWidth: 1,
  },
  chatHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerAvatar: {
    width: wp('12%'),
    height: wp('12%'),
    borderRadius: wp('6%'),
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: wp('3%'),
  },
  headerTextContainer: {
    flexDirection: 'column',
    justifyContent: 'center',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  onlineIndicator: {
    width: wp('2%'),
    height: wp('2%'),
    borderRadius: wp('1%'),
    marginRight: wp('2%'),
  },
  chatTitle: {
    fontSize: RFValue(18),
    fontWeight: '700',
  },
  chatSubtitle: {
    fontSize: RFValue(13),
    marginTop: hp('0.2%'),
  },
  closeButton: {
    padding: wp('2.5%'),
    borderRadius: wp('6%'),
  },
  chatListContainer: {
    flex: 1,
  },
  chatListContent: {
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('2%'),
    flexGrow: 1,
  },
  chatMessage: {
    flexDirection: 'row',
    marginVertical: hp('1%'),
    maxWidth: '85%',
  },
  userMessage: {
    alignSelf: 'flex-end',
    justifyContent: 'flex-end',
  },
  assistantMessage: {
    alignSelf: 'flex-start',
    justifyContent: 'flex-start',
  },
  avatarContainer: {
    width: wp('8%'),
    height: wp('8%'),
    borderRadius: wp('4%'),
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: wp('2%'),
  },
  messageContainer: {
    borderRadius: wp('4%'),
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('1.5%'),
    flex: 1,
  },
  userMessageContainer: {
    alignSelf: 'flex-end',
  },
  assistantMessageContainer: {
    alignSelf: 'flex-start',
  },
  chatMessageText: {
    fontSize: RFValue(14),
    lineHeight: RFValue(20),
  },
  messageTime: {
    fontSize: RFValue(10),
    marginTop: hp('0.5%'),
  },
  typingDots: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: wp('2%'),
    height: wp('2%'),
    borderRadius: wp('1%'),
    marginHorizontal: wp('0.5%'),
  },
  chatInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('2%'),
  },
  inputWrapper: {
    flex: 1,
    borderRadius: wp('6%'),
    borderWidth: 1,
    marginRight: wp('2%'),
  },
  chatTextInput: {
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('1.5%'),
    fontSize: RFValue(14),
    maxHeight: hp('12%'),
    minHeight: hp('5%'),
  },
  sendButton: {
    width: wp('12%'),
    height: wp('12%'),
    borderRadius: wp('6%'),
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default ChatModal;