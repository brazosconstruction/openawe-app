import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Linking,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';

import { EncryptionService } from '../services/encryption';
import { StorageService } from '../services/storage';
import { RelayService } from '../services/relay';
import {
  parsePairingCode,
  validatePairingPayload,
  formatRelayUrl,
} from '../utils/pairing';
import { darkTheme } from '../constants/theme';
import { useTheme } from '../contexts/ThemeContext';
import { useApp } from '../contexts/AppContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Use dark theme as static fallback for styled rings (they don't need reactivity)
const theme = darkTheme;

// Ambient background — slowly morphing rings
function AmbientBackground() {
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const ring3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const createRingAnimation = (anim: Animated.Value, delay: number, duration: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: duration / 2,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: duration / 2,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );
    };

    const a1 = createRingAnimation(ring1, 0, 8000);
    const a2 = createRingAnimation(ring2, 1500, 10000);
    const a3 = createRingAnimation(ring3, 3000, 12000);

    a1.start();
    a2.start();
    a3.start();

    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, []);

  const makeRingStyle = (
    anim: Animated.Value,
    baseSize: number,
    offset: { x: number; y: number },
  ) => {
    const scale = anim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.8, 1.2],
    });
    const opacity = anim.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [0.03, 0.06, 0.03],
    });
    return {
      transform: [{ scale }],
      opacity,
      left: offset.x - baseSize / 2,
      top: offset.y - baseSize / 2,
      width: baseSize,
      height: baseSize,
      borderRadius: baseSize / 2,
    };
  };

  const ring1Style = makeRingStyle(ring1, 300, {
    x: SCREEN_WIDTH * 0.3,
    y: SCREEN_HEIGHT * 0.2,
  });
  const ring2Style = makeRingStyle(ring2, 400, {
    x: SCREEN_WIDTH * 0.7,
    y: SCREEN_HEIGHT * 0.4,
  });
  const ring3Style = makeRingStyle(ring3, 250, {
    x: SCREEN_WIDTH * 0.4,
    y: SCREEN_HEIGHT * 0.7,
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[styles.ring, ring1Style]} />
      <Animated.View style={[styles.ring, ring2Style]} />
      <Animated.View style={[styles.ring, ring3Style]} />
    </View>
  );
}

export default function PairingScreen() {
  const [pairingCode, setPairingCode] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const navigation = useNavigation();
  const { theme: liveTheme } = useTheme();
  const { setIsPaired } = useApp();

  // Fade-in animations
  const brandFade = useRef(new Animated.Value(0)).current;
  const inputSectionFade = useRef(new Animated.Value(0)).current;
  const inputSectionSlide = useRef(new Animated.Value(30)).current;
  const infoFade = useRef(new Animated.Value(0)).current;
  const infoSlide = useRef(new Animated.Value(30)).current;
  const statusFade = useRef(new Animated.Value(0)).current;

  // Input glow
  const inputGlow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Staggered entrance animations
    Animated.sequence([
      Animated.delay(200),
      Animated.timing(brandFade, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      }),
    ]).start();

    Animated.parallel([
      Animated.timing(inputSectionFade, {
        toValue: 1,
        duration: 800,
        delay: 600,
        useNativeDriver: true,
      }),
      Animated.timing(inputSectionSlide, {
        toValue: 0,
        duration: 800,
        delay: 600,
        useNativeDriver: true,
      }),
    ]).start();

    Animated.parallel([
      Animated.timing(infoFade, {
        toValue: 1,
        duration: 800,
        delay: 900,
        useNativeDriver: true,
      }),
      Animated.timing(infoSlide, {
        toValue: 0,
        duration: 800,
        delay: 900,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    Animated.timing(inputGlow, {
      toValue: isFocused ? 1 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [isFocused]);

  const inputBorderColor = inputGlow.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0.25)'],
  });

  useEffect(() => {
    if (connectionStatus) {
      statusFade.setValue(0);
      Animated.timing(statusFade, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [connectionStatus]);

  useEffect(() => {
    const handleDeepLink = (url: string) => {
      if (url.startsWith('openawe://pair/')) {
        setPairingCode(url);
      }
    };

    const linkingSubscription = Linking.addEventListener('url', ({ url }) => {
      handleDeepLink(url);
    });

    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink(url);
    });

    return () => {
      linkingSubscription?.remove();
    };
  }, []);

  const handleDevMode = async () => {
    setIsConnecting(true);
    setConnectionStatus('Setting up dev mode...');

    try {
      const encryption = EncryptionService.getInstance();
      await encryption.initialize();
      const keyPair = encryption.generateKeyPair();

      const relayConfig = {
        relayId: '98ae6059-b123-4911-bdd0-42bd32e727df',
        serverUrl: 'wss://relay.openawe.app/v1/connect',
        pairedDevicePublicKey: '',
      };

      const storage = StorageService.getInstance();
      await storage.storeKeyPair(keyPair);
      await storage.storeRelayConfig(relayConfig);

      await Haptics.selectionAsync();
      setConnectionStatus('Dev mode ready!');

      // Navigate by updating app context (no reload needed)
      setTimeout(() => {
        setIsPaired(true);
      }, 800);
    } catch (error) {
      console.error('Dev mode setup failed:', error);
      Alert.alert('Error', 'Failed to set up dev mode');
      setIsConnecting(false);
      setConnectionStatus('');
    }
  };

  const handlePairing = async () => {
    if (!pairingCode.trim()) {
      Alert.alert('Error', 'Please enter a pairing code');
      return;
    }

    setIsConnecting(true);
    setConnectionStatus('Looking up pairing code...');

    try {
      const pairingPayload = await parsePairingCode(pairingCode.trim());

      if (!pairingPayload) {
        throw new Error('Invalid pairing code format');
      }

      if (!validatePairingPayload(pairingPayload)) {
        throw new Error('Pairing code is invalid or expired');
      }

      setConnectionStatus('Generating encryption keys...');

      const encryption = EncryptionService.getInstance();
      await encryption.initialize();
      const keyPair = encryption.generateKeyPair();

      setConnectionStatus('Saving pairing info...');

      const relayConfig = {
        relayId: pairingPayload.relayId,
        serverUrl: formatRelayUrl(pairingPayload.serverUrl),
        pairedDevicePublicKey: pairingPayload.publicKey,
      };

      const storage = StorageService.getInstance();
      await storage.storeKeyPair(keyPair);
      await storage.storeRelayConfig(relayConfig);

      await Haptics.selectionAsync();
      setConnectionStatus('Paired successfully!');

      // Navigate by updating app context (no reload needed)
      setTimeout(() => {
        setIsPaired(true);
      }, 1000);
    } catch (error) {
      console.error('Pairing failed:', error);
      Alert.alert(
        'Pairing Failed',
        error instanceof Error ? error.message : 'An unknown error occurred',
      );
      setIsConnecting(false);
      setConnectionStatus('');
    }
  };

  const canConnect = pairingCode.trim().length > 0 && !isConnecting;
  const lc = liveTheme.colors;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: lc.background }]}>
      <AmbientBackground />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        <View style={styles.content}>
          {/* Brand */}
          <Animated.View
            style={[styles.brandContainer, { opacity: brandFade }]}
          >
            <Text style={[styles.brandName, { color: lc.textPrimary }]}>OPENAWE</Text>
            <View style={[styles.brandDivider, { backgroundColor: lc.white20 }]} />
            <Text style={[styles.brandSubtitle, { color: lc.textTertiary }]}>
              Connect to your OpenClaw instance
            </Text>
          </Animated.View>

          {/* Input */}
          <Animated.View
            style={[
              styles.inputSection,
              {
                opacity: inputSectionFade,
                transform: [{ translateY: inputSectionSlide }],
              },
            ]}
          >
            <Animated.View style={[styles.inputWrapper, { borderColor: inputBorderColor }]}>
              <TextInput
                style={[styles.input, { color: lc.textPrimary, backgroundColor: lc.surface }]}
                value={pairingCode}
                onChangeText={setPairingCode}
                placeholder="Enter pairing code"
                placeholderTextColor={lc.textMuted}
                multiline={true}
                numberOfLines={2}
                textAlignVertical="center"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isConnecting}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                selectionColor={lc.white40}
                keyboardAppearance={liveTheme === darkTheme ? 'dark' : 'light'}
              />
            </Animated.View>

            {connectionStatus ? (
              <Animated.View style={[styles.statusRow, { opacity: statusFade }]}>
                <ActivityIndicator size="small" color={lc.textSecondary} />
                <Text style={[styles.statusText, { color: lc.textSecondary }]}>{connectionStatus}</Text>
              </Animated.View>
            ) : null}

            <TouchableOpacity
              style={[
                styles.connectButton,
                { borderColor: lc.white20 },
                !canConnect && [styles.connectButtonDisabled, { borderColor: lc.border }],
              ]}
              onPress={handlePairing}
              disabled={!canConnect}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.connectButtonText,
                  { color: lc.textPrimary },
                  !canConnect && [styles.connectButtonTextDisabled, { color: lc.textMuted }],
                ]}
              >
                {isConnecting ? 'Connecting...' : 'Connect'}
              </Text>
            </TouchableOpacity>

            {/* Dev Mode Button */}
            {__DEV__ && (
              <TouchableOpacity
                style={[styles.devButton, { borderColor: lc.borderSubtle }]}
                onPress={handleDevMode}
                disabled={isConnecting}
                activeOpacity={0.7}
              >
                <Text style={[styles.devButtonText, { color: lc.textTertiary }]}>Dev Mode (Tailscale)</Text>
              </TouchableOpacity>
            )}
          </Animated.View>

          {/* Instructions */}
          <Animated.View
            style={[
              styles.infoBlock,
              {
                opacity: infoFade,
                transform: [{ translateY: infoSlide }],
              },
            ]}
          >
            <Text style={[styles.infoLabel, { color: lc.textTertiary }]}>How to pair</Text>
            <Text style={[styles.infoStep, { color: lc.textTertiary }]}>
              1. Ask your OpenClaw for a relay code
            </Text>
            <Text style={[styles.infoStep, { color: lc.textTertiary }]}>
              2. Enter the short code (e.g. HDW6-CW5G) above
            </Text>
            <Text style={[styles.infoStep, { color: lc.textTertiary }]}>
              3. Codes expire in 10 minutes
            </Text>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  keyboardAvoid: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing.xl,
    justifyContent: 'center',
  },

  // Ambient rings
  ring: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: theme.colors.white20,
    backgroundColor: 'transparent',
  },

  // Brand
  brandContainer: {
    alignItems: 'center',
    marginBottom: 56,
  },
  brandName: {
    ...theme.typography.display,
    letterSpacing: 8,
  },
  brandDivider: {
    width: 32,
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.white20,
    marginVertical: 16,
  },
  brandSubtitle: {
    ...theme.typography.subtitle,
    color: theme.colors.textTertiary,
  },

  // Input section
  inputSection: {
    marginBottom: 48,
  },
  inputWrapper: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
    marginBottom: 20,
  },
  input: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    fontSize: 16,
    fontWeight: '300',
    color: theme.colors.textPrimary,
    minHeight: 56,
    textAlign: 'center',
    letterSpacing: 1,
    borderRadius: theme.radius.lg,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    gap: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '300',
    color: theme.colors.textSecondary,
  },
  connectButton: {
    borderWidth: 1,
    borderColor: theme.colors.white20,
    borderRadius: theme.radius.lg,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  connectButtonDisabled: {
    borderColor: theme.colors.border,
  },
  connectButtonText: {
    fontSize: 16,
    fontWeight: '400',
    letterSpacing: 2,
    color: theme.colors.textPrimary,
  },
  connectButtonTextDisabled: {
    color: theme.colors.textMuted,
  },

  // Dev mode button
  devButton: {
    marginTop: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    borderStyle: 'dashed',
  },
  devButtonText: {
    fontSize: 13,
    fontWeight: '300',
    letterSpacing: 1,
    color: theme.colors.textTertiary,
  },

  // Info
  infoBlock: {
    paddingHorizontal: 8,
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: '400',
    letterSpacing: 1,
    color: theme.colors.textTertiary,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  infoStep: {
    fontSize: 14,
    fontWeight: '300',
    color: theme.colors.textTertiary,
    lineHeight: 22,
    marginBottom: 2,
  },
});
