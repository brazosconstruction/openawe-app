import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image, Dimensions, Animated } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Message } from '../types';
import theme from '../constants/theme';

interface MessageBubbleProps {
  message: Message;
}

const screenWidth = Dimensions.get('window').width;
const maxWidth = screenWidth * theme.layout.maxMessageWidth;

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.isUser;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(isUser ? 20 : -20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        delay: 30,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 250,
        delay: 30,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderContent = () => {
    switch (message.type) {
      case 'image':
        return (
          <View>
            {message.metadata?.imageUri && (
              <Image
                source={{ uri: message.metadata.imageUri }}
                style={styles.messageImage}
                resizeMode="cover"
              />
            )}
            {message.text && message.text !== 'Photo' && (
              <Text style={[styles.messageText, isUser ? styles.userText : styles.aiText]}>
                {message.text}
              </Text>
            )}
          </View>
        );

      case 'audio':
        return (
          <View style={styles.audioRow}>
            <Feather name="volume-2" size={14} color={theme.colors.textTertiary} />
            <Text style={[styles.audioLabel, isUser ? styles.userText : styles.aiText]}>
              Voice message
            </Text>
          </View>
        );

      default:
        return (
          <Text style={[styles.messageText, isUser ? styles.userText : styles.aiText]}>
            {message.text}
          </Text>
        );
    }
  };

  return (
    <Animated.View
      style={[
        styles.container,
        isUser ? styles.userContainer : styles.aiContainer,
        { opacity: fadeAnim, transform: [{ translateX: slideAnim }] },
      ]}
    >
      <View
        style={[
          styles.messageBlock,
          isUser ? styles.userBlock : styles.aiBlock,
          { maxWidth },
        ]}
      >
        {renderContent()}

        <Text style={[styles.timestamp, isUser ? styles.timestampUser : styles.timestampAi]}>
          {formatTime(message.timestamp)}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 2,
    paddingHorizontal: theme.spacing.md,
  },
  userContainer: {
    alignItems: 'flex-end',
  },
  aiContainer: {
    alignItems: 'flex-start',
  },
  messageBlock: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: theme.radius.lg,
  },
  userBlock: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.radius.lg,
  },
  aiBlock: {
    backgroundColor: 'transparent',
    paddingHorizontal: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 24,
  },
  userText: {
    color: theme.colors.textPrimary,
    fontWeight: '400',
  },
  aiText: {
    color: theme.colors.textPrimary,
    fontWeight: '300',
  },
  messageImage: {
    width: 220,
    height: 165,
    borderRadius: theme.radius.md,
    marginBottom: 8,
  },
  audioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  audioLabel: {
    fontSize: 14,
    fontWeight: '300',
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
  },
  timestamp: {
    fontSize: 11,
    fontWeight: '300',
    marginTop: 4,
  },
  timestampUser: {
    color: theme.colors.textTertiary,
    textAlign: 'right',
  },
  timestampAi: {
    color: theme.colors.textTertiary,
  },
});
