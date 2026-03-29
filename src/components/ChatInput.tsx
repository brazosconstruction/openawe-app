import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  Animated,
  ActionSheetIOS,
  ScrollView,
  Image,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { Attachment, MessageMetadata } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import staticTheme from '../constants/theme';

interface ChatInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: (text: string, metadata?: MessageMetadata, attachments?: Attachment[]) => void;
  disabled?: boolean;
  placeholder?: string;
}

export default function ChatInput({
  value,
  onChangeText,
  onSend,
  disabled = false,
  placeholder = 'Message...',
}: ChatInputProps) {
  const { theme, isDark } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const sendScale = useRef(new Animated.Value(1)).current;
  const focusProgress = useRef(new Animated.Value(0)).current;
  const canSendProgress = useRef(new Animated.Value(0)).current;

  const canSend = (value.trim().length > 0 || pendingAttachments.length > 0) && !disabled;

  useEffect(() => {
    Animated.timing(focusProgress, {
      toValue: isFocused ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [isFocused]);

  useEffect(() => {
    Animated.timing(canSendProgress, {
      toValue: canSend ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [canSend]);

  const handleSend = () => {
    if (!canSend) return;
    Animated.sequence([
      Animated.spring(sendScale, {
        toValue: 0.85,
        useNativeDriver: false,
        speed: 50,
        bounciness: 4,
      }),
      Animated.spring(sendScale, {
        toValue: 1,
        useNativeDriver: false,
        speed: 30,
        bounciness: 6,
      }),
    ]).start();
    onSend(value.trim(), undefined, pendingAttachments.length > 0 ? pendingAttachments : undefined);
    setPendingAttachments([]);
    Haptics.selectionAsync();
  };

  const handleVoiceRecord = async () => {
    Alert.alert('Coming Soon', 'Voice recording will be available in a future update.');
  };

  const compressAndEncodeImage = async (uri: string): Promise<Attachment> => {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 800 } }],
      {
        compress: 0.7,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true,
      }
    );
    return {
      type: 'image',
      data: result.base64 ?? '',
      mimeType: 'image/jpeg',
      filename: 'photo.jpg',
    };
  };

  const pickFromLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Please allow access to your photo library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 1,
    });
    if (!result.canceled && result.assets.length > 0) {
      try {
        const attachment = await compressAndEncodeImage(result.assets[0].uri);
        setPendingAttachments((prev) => [...prev, attachment]);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {
        Alert.alert('Error', 'Could not process the image.');
      }
    }
  };

  const pickFromCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Please allow camera access.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 1,
    });
    if (!result.canceled && result.assets.length > 0) {
      try {
        const attachment = await compressAndEncodeImage(result.assets[0].uri);
        setPendingAttachments((prev) => [...prev, attachment]);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {
        Alert.alert('Error', 'Could not process the image.');
      }
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets.length > 0) {
        const asset = result.assets[0];
        // Read file as base64 so client bridge can save and pass to OpenClaw
        let base64Data = '';
        try {
          base64Data = await FileSystem.readAsStringAsync(asset.uri, {
            encoding: 'base64',
          });
        } catch (e) {
          console.warn('Could not read file as base64:', e);
        }
        const attachment: Attachment = {
          type: 'file',
          mimeType: asset.mimeType ?? 'application/octet-stream',
          filename: asset.name,
          url: asset.uri,
          data: base64Data,
        };
        setPendingAttachments((prev) => [...prev, attachment]);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {
      Alert.alert('Error', 'Could not pick the document.');
    }
  };

  const pickVideo = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Please allow access to your photo library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: false,
      quality: 1,
    });
    if (!result.canceled && result.assets.length > 0) {
      const uri = result.assets[0].uri;
      let base64Data = '';
      try {
        base64Data = await FileSystem.readAsStringAsync(uri, {
          encoding: 'base64',
        });
      } catch (e) {
        console.warn('Could not read video as base64:', e);
      }
      const attachment: Attachment = {
        type: 'video',
        mimeType: 'video/mp4',
        filename: 'video.mp4',
        data: base64Data,
      };
      setPendingAttachments((prev) => [...prev, attachment]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const showAttachmentPicker = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Camera', 'Photo Library', 'Video', 'File'],
          cancelButtonIndex: 0,
          tintColor: theme.colors.textPrimary,
        },
        (index) => {
          if (index === 1) pickFromCamera();
          else if (index === 2) pickFromLibrary();
          else if (index === 3) pickVideo();
          else if (index === 4) pickDocument();
        }
      );
    } else {
      Alert.alert('Attach', 'Choose an attachment type', [
        { text: 'Camera', onPress: pickFromCamera },
        { text: 'Photo Library', onPress: pickFromLibrary },
        { text: 'Video', onPress: pickVideo },
        { text: 'File', onPress: pickDocument },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  // Animated styles — use live theme colors
  const inputBorderColor = focusProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.colors.border, theme.colors.borderFocus],
  });

  const sendButtonBg = canSendProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['transparent', theme.colors.accent],
  });

  const sendIconColor = canSend ? theme.colors.background : theme.colors.textTertiary;
  const attachIconColor = pendingAttachments.length > 0
    ? theme.colors.accent
    : theme.colors.textTertiary;

  return (
    <View style={[
      styles.container,
      {
        backgroundColor: theme.colors.background,
        borderTopColor: theme.colors.border,
      },
    ]}>
      {pendingAttachments.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.previewStrip}
          contentContainerStyle={styles.previewStripContent}
        >
          {pendingAttachments.map((att, idx) => (
            <View key={idx} style={[styles.previewItem, { backgroundColor: theme.colors.surface }]}>
              {att.type === 'image' && att.data ? (
                <Image
                  source={{ uri: `data:${att.mimeType};base64,${att.data}` }}
                  style={styles.previewImage}
                  resizeMode="cover"
                />
              ) : att.type === 'video' ? (
                <View style={[styles.previewFilePlaceholder, { backgroundColor: theme.colors.surfaceElevated }]}>
                  <Feather name="video" size={20} color={theme.colors.textTertiary} />
                </View>
              ) : (
                <View style={[styles.previewFilePlaceholder, { backgroundColor: theme.colors.surfaceElevated }]}>
                  <Feather name="file" size={20} color={theme.colors.textTertiary} />
                </View>
              )}
              <TouchableOpacity
                style={[styles.previewRemove, { backgroundColor: theme.colors.textSecondary }]}
                onPress={() => setPendingAttachments((prev) => prev.filter((_, i) => i !== idx))}
                hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              >
                <Feather name="x" size={10} color={theme.colors.background} />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}
      <View style={styles.row}>
        {/* Attachment button */}
        <TouchableOpacity
          onPress={showAttachmentPicker}
          disabled={disabled}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
          style={styles.attachButton}
        >
          <Feather name="paperclip" size={18} color={attachIconColor} />
        </TouchableOpacity>

        {/* Text input */}
        <Animated.View style={[
          styles.inputWrapper,
          {
            borderColor: inputBorderColor,
            backgroundColor: theme.colors.surface,
          },
        ]}>
          <TextInput
            style={[
              styles.textInput,
              { color: theme.colors.textPrimary },
            ]}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={theme.colors.textTertiary}
            multiline
            maxLength={2000}
            editable={!disabled}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            textAlignVertical="center"
            selectionColor={theme.colors.white40}
            keyboardAppearance={isDark ? 'dark' : 'light'}
          />
        </Animated.View>

        {/* Send / Voice button */}
        <TouchableOpacity
          onPress={canSend ? handleSend : handleVoiceRecord}
          disabled={disabled}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
        >
          <Animated.View
            style={[
              styles.sendButton,
              { transform: [{ scale: sendScale }], backgroundColor: sendButtonBg },
            ]}
          >
            <Feather
              name={canSend ? 'arrow-up' : 'mic'}
              size={18}
              color={sendIconColor}
            />
          </Animated.View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 34 : 12,
  },
  previewStrip: {
    marginBottom: 8,
  },
  previewStripContent: {
    gap: 8,
    paddingHorizontal: 2,
  },
  previewItem: {
    width: 64,
    height: 64,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  previewImage: {
    width: 64,
    height: 64,
  },
  previewFilePlaceholder: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewRemove: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  attachButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputWrapper: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
  },
  textInput: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    fontWeight: '300',
    maxHeight: 100,
    minHeight: 36,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
