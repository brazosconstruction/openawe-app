import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Animated,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { Message, ConnectionState, MessageMetadata, Attachment } from '../types';
import { RelayService } from '../services/relay';
import { StorageService } from '../services/storage';
import MessageBubble from '../components/MessageBubble';
import ConnectionIndicator from '../components/ConnectionIndicator';
import ChatInput from '../components/ChatInput';
import { useTheme } from '../contexts/ThemeContext';
import { darkTheme as theme } from '../constants/theme';

// Thinking wave animation — 3 bars that pulse in sequence
function ThinkingIndicator() {
  const bar1 = useRef(new Animated.Value(0.3)).current;
  const bar2 = useRef(new Animated.Value(0.3)).current;
  const bar3 = useRef(new Animated.Value(0.3)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const { theme } = useTheme();

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    const animateBar = (anim: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0.3,
            duration: 500,
            useNativeDriver: true,
          }),
        ]),
      );
    };

    const a1 = animateBar(bar1, 0);
    const a2 = animateBar(bar2, 150);
    const a3 = animateBar(bar3, 300);

    a1.start();
    a2.start();
    a3.start();

    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, []);

  return (
    <Animated.View style={[styles.thinkingContainer, { opacity: fadeAnim }]}>
      <View style={styles.thinkingRow}>
        <Animated.View style={[styles.thinkingBar, { backgroundColor: theme.colors.textTertiary, opacity: bar1, transform: [{ scaleY: bar1 }] }]} />
        <Animated.View style={[styles.thinkingBar, { backgroundColor: theme.colors.textTertiary, opacity: bar2, transform: [{ scaleY: bar2 }] }]} />
        <Animated.View style={[styles.thinkingBar, { backgroundColor: theme.colors.textTertiary, opacity: bar3, transform: [{ scaleY: bar3 }] }]} />
      </View>
    </Animated.View>
  );
}

// Empty state component
function EmptyChat() {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const { theme } = useTheme();

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      delay: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View style={[styles.emptyContainer, { opacity: fadeAnim }]}>
      <Text style={[styles.emptyTitle, { color: theme.colors.textTertiary }]}>OpenAwe</Text>
      <Text style={[styles.emptySubtitle, { color: theme.colors.textMuted }]}>Send a message to your OpenClaw</Text>
    </Animated.View>
  );
}

export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    status: 'disconnected',
  });
  const flatListRef = useRef<FlatList>(null);

  const relay = RelayService.getInstance();
  const storage = StorageService.getInstance();
  const { theme } = useTheme();

  useEffect(() => {
    initializeChat();
    return () => {
      relay.removeAllListeners();
    };
  }, []);

  // Auto-scroll on new messages or thinking state
  useEffect(() => {
    const timer = setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 150);
    return () => clearTimeout(timer);
  }, [messages.length, isThinking]);

  const initializeChat = async () => {
    try {
      const savedMessages = await storage.getMessages();
      setMessages(savedMessages);

      const relayConfig = await storage.getRelayConfig();
      const keyPair = await storage.getKeyPair();

      if (!relayConfig || !keyPair) {
        Alert.alert('Error', 'Pairing information not found. Please pair again.');
        return;
      }

      await relay.initialize(relayConfig, keyPair);

      relay.on('connectionStateChanged', handleConnectionStateChanged);
      relay.on('message', handleIncomingMessage);
      relay.on('partnerStatus', handlePartnerStatus);

      await relay.connect();
    } catch (error) {
      console.error('Failed to initialize chat:', error);
      Alert.alert('Connection Error', 'Failed to connect to relay server.');
    }
  };

  const handleConnectionStateChanged = (state: ConnectionState) => {
    setConnectionState(state);
  };

  const handlePartnerStatus = (online: boolean) => {
    setConnectionState((prev) => ({ ...prev, partnerOnline: online }));
  };

  const handleIncomingMessage = useCallback(async (messageText: string) => {
    try {
      const newMessage: Message = {
        id: `ai-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        text: messageText,
        timestamp: Date.now(),
        isUser: false,
        type: 'text',
      };

      setIsThinking(false);
      setMessages((prev) => {
        const updated = [...prev, newMessage];
        storage.storeMessages(updated);
        return updated;
      });

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Failed to process incoming message:', error);
      setIsThinking(false);
    }
  }, []);

  const sendMessage = async (text: string, metadata?: MessageMetadata, attachments?: Attachment[]) => {
    const hasAttachments = attachments && attachments.length > 0;
    if (!text.trim() && !hasAttachments) return;
    if (connectionState.status !== 'connected') return;

    try {
      const userMessage: Message = {
        id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        text: text.trim(),
        timestamp: Date.now(),
        isUser: true,
        type: hasAttachments ? 'image' : ((metadata?.type as Message['type']) || 'text'),
        metadata,
        attachments,
      };

      setMessages((prev) => {
        const updated = [...prev, userMessage];
        storage.storeMessages(updated);
        return updated;
      });

      setInputText('');
      setIsThinking(true);

      await relay.sendMessage(text.trim(), attachments);
      await Haptics.selectionAsync();
    } catch (error) {
      console.error('Failed to send message:', error);
      setIsThinking(false);
      Alert.alert('Send Failed', 'Failed to send message. Please try again.');
    }
  };

  const renderMessage = useCallback(({ item }: { item: Message }) => (
    <MessageBubble message={item} />
  ), []);

  const getPlaceholder = () => {
    if (connectionState.status !== 'connected') return 'Connecting...';
    if (!connectionState.partnerOnline) return 'Host offline...';
    return 'Message OpenClaw...';
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['bottom']}>
      <ConnectionIndicator connectionState={connectionState} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.chatContainer}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          style={styles.messagesList}
          contentContainerStyle={[
            styles.messagesContent,
            messages.length === 0 && styles.messagesEmpty,
          ]}
          ListEmptyComponent={<EmptyChat />}
          ListFooterComponent={isThinking ? <ThinkingIndicator /> : null}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => {
            flatListRef.current?.scrollToEnd({ animated: false });
          }}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
        />

        <ChatInput
          value={inputText}
          onChangeText={setInputText}
          onSend={sendMessage}
          disabled={connectionState.status !== 'connected'}
          placeholder={getPlaceholder()}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  chatContainer: {
    flex: 1,
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    paddingTop: 16,
    paddingBottom: 8,
  },
  messagesEmpty: {
    flex: 1,
    justifyContent: 'center',
  },

  // Empty state
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 28,
    fontWeight: '200',
    letterSpacing: 4,
    color: theme.colors.textTertiary,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    fontWeight: '300',
    color: theme.colors.textMuted,
    letterSpacing: 0.5,
  },

  // Thinking indicator
  thinkingContainer: {
    paddingHorizontal: theme.spacing.md + 4,
    paddingVertical: 12,
  },
  thinkingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 20,
  },
  thinkingBar: {
    width: 3,
    height: 16,
    borderRadius: 1.5,
    backgroundColor: theme.colors.textTertiary,
  },
});
