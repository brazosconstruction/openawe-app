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
import {
  cacheDirectory,
  writeAsStringAsync,
  EncodingType,
} from 'expo-file-system/legacy';
import { Video, ResizeMode } from 'expo-av';
import * as VideoThumbnails from 'expo-video-thumbnails';
import * as Sharing from 'expo-sharing';
import { Message, Attachment } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import staticTheme from '../constants/theme';

interface MessageBubbleProps {
  message: Message;
}

const screenWidth = Dimensions.get('window').width;
const maxWidth = screenWidth * staticTheme.layout.maxMessageWidth;
const MAX_THUMB_HEIGHT = 300;

/** Write base64 attachment data to a temp cache file, return the path */
async function writeToCache(attachment: Attachment): Promise<string> {
  const filename = attachment.filename || 'file';
  const tempPath = (cacheDirectory ?? '') + filename;
  await writeAsStringAsync(tempPath, attachment.data ?? '', {
    encoding: EncodingType.Base64,
  });
  return tempPath;
}

/** Open a file via expo-sharing (presents iOS share sheet with Quick Look at top) */
async function openFile(attachment: Attachment): Promise<void> {
  if (!attachment.data) return;
  const path = await writeToCache(attachment);
  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) return;
  await Sharing.shareAsync(path, {
    mimeType: attachment.mimeType || 'application/octet-stream',
    dialogTitle: attachment.filename || 'Open file',
  });
}

/** Video thumbnail with play-button overlay and tap-to-fullscreen */
function AttachmentVideo({ attachment }: { attachment: Attachment }) {
  const { theme } = useTheme();
  const [thumbUri, setThumbUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [cachedPath, setCachedPath] = useState<string | null>(null);
  const [videoModalVisible, setVideoModalVisible] = useState(false);
  const [videoUri, setVideoUri] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!attachment.data) return;
        const path = await writeToCache(attachment);
        if (!cancelled) setCachedPath(path);
        const { uri } = await VideoThumbnails.getThumbnailAsync(path, { time: 0 });
        if (!cancelled) setThumbUri(uri);
      } catch {
        // fall back to icon view
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [attachment]);

  const handlePress = async () => {
    try {
      let path = cachedPath;
      if (!path && attachment.data) {
        path = await writeToCache(attachment);
        setCachedPath(path);
      }
      if (path) {
        setVideoUri('file://' + path);
        setVideoModalVisible(true);
      }
    } catch {
      // ignore
    }
  };

  if (loading || !thumbUri) {
    return (
      <TouchableOpacity
        style={[styles.videoPlaceholder, { backgroundColor: theme.colors.surface }]}
        onPress={handlePress}
        activeOpacity={0.8}
      >
        <Feather name="video" size={24} color={theme.colors.textSecondary} />
        <Text style={[styles.videoLabel, { color: theme.colors.textSecondary }]}>
          {attachment.filename || 'video.mp4'}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <>
      <TouchableOpacity
        style={[styles.attachmentThumb, { backgroundColor: theme.colors.surface }]}
        onPress={handlePress}
        activeOpacity={0.8}
      >
        <Image source={{ uri: thumbUri }} style={styles.attachmentImage} resizeMode="cover" />
        <View style={styles.playOverlay}>
          <View style={styles.playButton}>
            <Feather name="play" size={28} color="#fff" />
          </View>
        </View>
      </TouchableOpacity>

      {/* Fullscreen video modal */}
      <Modal
        visible={videoModalVisible}
        transparent={false}
        animationType="fade"
        onRequestClose={() => setVideoModalVisible(false)}
        statusBarTranslucent
        supportedOrientations={['portrait', 'landscape']}
      >
        <TouchableOpacity
          style={styles.videoModalContainer}
          activeOpacity={1}
          onPress={() => setVideoModalVisible(false)}
        >
          <StatusBar barStyle="light-content" backgroundColor="#000" hidden />
          {/* X button */}
          <TouchableOpacity
            style={styles.videoModalClose}
            onPress={() => setVideoModalVisible(false)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Feather name="x" size={26} color="#fff" />
          </TouchableOpacity>
          {videoUri ? (
            <Video
              source={{ uri: videoUri }}
              style={styles.videoPlayer}
              resizeMode={ResizeMode.CONTAIN}
              shouldPlay
              useNativeControls
            />
          ) : null}
        </TouchableOpacity>
      </Modal>
    </>
  );
}

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
          <AttachmentVideo key={`vid-${idx}`} attachment={att} />
        ))}
        {fileAttachments.map((att, idx) => (
          <TouchableOpacity
            key={`file-${idx}`}
            style={[styles.videoPlaceholder, { backgroundColor: theme.colors.surface }]}
            onPress={() => openFile(att)}
            activeOpacity={0.8}
          >
            <Feather name="file-text" size={24} color={theme.colors.textSecondary} />
            <Text style={[styles.videoLabel, { color: theme.colors.textSecondary }]}>
              {att.filename || 'file'}
            </Text>
          </TouchableOpacity>
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
  // Video play overlay
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Fullscreen video modal
  videoModalContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoModalClose: {
    position: 'absolute',
    top: 52,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  videoPlayer: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
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
