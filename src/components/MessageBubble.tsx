import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Dimensions,
  Animated,
  TouchableOpacity,
  Modal,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Message, Attachment } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import staticTheme from '../constants/theme';

interface MessageBubbleProps {
  message: Message;
}

const screenWidth = Dimensions.get('window').width;
const maxWidth = screenWidth * staticTheme.layout.maxMessageWidth;
const MAX_THUMB_HEIGHT = 300;

/** Render a single attachment image thumbnail with tap-to-fullscreen */
function AttachmentImage({ attachment }: { attachment: Attachment }) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const { theme } = useTheme();

  const imageSource = attachment.data
    ? { uri: `data:${attachment.mimeType};base64,${attachment.data}` }
    : attachment.url
    ? { uri: attachment.url }
    : null;

  if (!imageSource) return null;

  return (
    <>
      <TouchableOpacity
        onPress={() => setLightboxOpen(true)}
        activeOpacity={0.85}
        style={[styles.attachmentThumb, { backgroundColor: theme.colors.surface }]}
      >
        <Image
          source={imageSource}
          style={styles.attachmentImage}
          resizeMode="contain"
        />
      </TouchableOpacity>

      <Modal
        visible={lightboxOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setLightboxOpen(false)}
        statusBarTranslucent
      >
        <SafeAreaView style={styles.lightboxContainer}>
          <StatusBar barStyle="light-content" backgroundColor="#000" />
          <TouchableOpacity
            style={[styles.lightboxClose, { backgroundColor: theme.colors.surface }]}
            onPress={() => setLightboxOpen(false)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="x" size={22} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <Image
            source={imageSource}
            style={styles.lightboxImage}
            resizeMode="contain"
          />
        </SafeAreaView>
      </Modal>
    </>
  );
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.isUser;
  const { theme, isDark } = useTheme();
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

  const imageAttachments =
    message.attachments?.filter((a) => a.type === 'image') ?? [];
  const videoAttachments =
    message.attachments?.filter((a) => a.type === 'video') ?? [];
  const fileAttachments =
    message.attachments?.filter((a) => a.type === 'file') ?? [];

  // Dynamic bubble colors based on live theme
  const userBubbleBg = theme.colors.surfaceElevated;
  const aiBubbleBg = isDark ? 'transparent' : '#F0F0F0';
  const userBubblePadding = { paddingHorizontal: 16 as const, paddingVertical: 10 as const };
  const aiBubblePadding = { paddingHorizontal: isDark ? 4 : 16, paddingVertical: isDark ? 10 : 10 };

  const renderAttachments = () => {
    if (imageAttachments.length === 0 && videoAttachments.length === 0 && fileAttachments.length === 0) return null;
    return (
      <View style={styles.attachmentsContainer}>
        {imageAttachments.map((att, idx) => (
          <AttachmentImage key={`img-${idx}`} attachment={att} />
        ))}
        {videoAttachments.map((att, idx) => (
          <View key={`vid-${idx}`} style={[styles.videoPlaceholder, { backgroundColor: theme.colors.surface }]}>
            <Feather name="video" size={24} color={theme.colors.textSecondary} />
            <Text style={[styles.videoLabel, { color: theme.colors.textSecondary }]}>
              {att.filename || 'video.mp4'}
            </Text>
          </View>
        ))}
        {fileAttachments.map((att, idx) => (
          <View key={`file-${idx}`} style={[styles.videoPlaceholder, { backgroundColor: theme.colors.surface }]}>
            <Feather name="file-text" size={24} color={theme.colors.textSecondary} />
            <Text style={[styles.videoLabel, { color: theme.colors.textSecondary }]}>
              {att.filename || 'file'}
            </Text>
          </View>
        ))}
      </View>
    );
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
              <Text style={[styles.messageText, { color: theme.colors.textPrimary }, !isUser && styles.aiTextWeight]}>
                {message.text}
              </Text>
            )}
          </View>
        );

      case 'audio':
        return (
          <View style={styles.audioRow}>
            <Feather name="volume-2" size={14} color={theme.colors.textTertiary} />
            <Text style={[styles.audioLabel, { color: theme.colors.textSecondary }]}>
              Voice message
            </Text>
          </View>
        );

      default:
        return (
          <View>
            {renderAttachments()}
            {message.text ? (
              <Text style={[
                styles.messageText,
                { color: theme.colors.textPrimary },
                !isUser && styles.aiTextWeight,
              ]}>
                {message.text}
              </Text>
            ) : null}
          </View>
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
          isUser ? userBubblePadding : aiBubblePadding,
          {
            backgroundColor: isUser ? userBubbleBg : aiBubbleBg,
            borderRadius: staticTheme.radius.lg,
            maxWidth,
          },
        ]}
      >
        {renderContent()}

        <Text style={[
          styles.timestamp,
          isUser ? styles.timestampUser : styles.timestampAi,
          { color: theme.colors.textMuted },
        ]}>
          {formatTime(message.timestamp)}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 2,
    paddingHorizontal: staticTheme.spacing.md,
  },
  userContainer: {
    alignItems: 'flex-end',
  },
  aiContainer: {
    alignItems: 'flex-start',
  },
  messageBlock: {
    borderRadius: staticTheme.radius.lg,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400',
  },
  aiTextWeight: {
    fontWeight: '300',
  },
  messageImage: {
    width: 220,
    height: 165,
    borderRadius: staticTheme.radius.md,
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
    fontStyle: 'italic',
  },
  timestamp: {
    fontSize: 11,
    fontWeight: '300',
    marginTop: 4,
  },
  timestampUser: {
    textAlign: 'right',
  },
  timestampAi: {
    textAlign: 'left',
  },
  // Attachment styles
  attachmentsContainer: {
    gap: 6,
    marginBottom: 6,
  },
  attachmentThumb: {
    borderRadius: staticTheme.radius.md,
    overflow: 'hidden',
    width: maxWidth - 32,
    maxHeight: MAX_THUMB_HEIGHT,
  },
  attachmentImage: {
    width: maxWidth - 32,
    height: MAX_THUMB_HEIGHT,
  },
  // Video placeholder
  videoPlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: staticTheme.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  videoLabel: {
    fontSize: 14,
    fontWeight: '300',
  },
  // Lightbox
  lightboxContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lightboxClose: {
    position: 'absolute',
    top: 52,
    right: 20,
    zIndex: 10,
    padding: 8,
    borderRadius: staticTheme.radius.round,
  },
  lightboxImage: {
    width: screenWidth,
    height: Dimensions.get('window').height * 0.85,
  },
});
