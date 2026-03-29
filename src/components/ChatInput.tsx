import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  Animated,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { MessageMetadata } from '../types';
import theme from '../constants/theme';

interface ChatInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: (text: string, metadata?: MessageMetadata) => void;
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
  const [isFocused, setIsFocused] = useState(false);
  const sendScale = useRef(new Animated.Value(1)).current;
  const focusProgress = useRef(new Animated.Value(0)).current;
  const canSendProgress = useRef(new Animated.Value(0)).current;

  const canSend = value.trim().length > 0 && !disabled;

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
    onSend(value.trim());
    Haptics.selectionAsync();
  };

  const handleVoiceRecord = async () => {
    Alert.alert('Coming Soon', 'Voice recording will be available in a future update.');
  };

  // Animated styles
  const inputBorderColor = focusProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.colors.border, theme.colors.borderFocus],
  });

  const sendButtonBg = canSendProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['transparent', theme.colors.accent],
  });

  const sendIconColor = canSend ? theme.colors.background : theme.colors.textTertiary;

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {/* Text input */}
        <Animated.View style={[styles.inputWrapper, { borderColor: inputBorderColor }]}>
          <TextInput
            style={styles.textInput}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={theme.colors.textMuted}
            multiline
            maxLength={2000}
            editable={!disabled}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            textAlignVertical="center"
            selectionColor={theme.colors.white40}
            keyboardAppearance="dark"
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
    backgroundColor: theme.colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 34 : 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  inputWrapper: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
  },
  textInput: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    fontWeight: '300',
    color: theme.colors.textPrimary,
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
