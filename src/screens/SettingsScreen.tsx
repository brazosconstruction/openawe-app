import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Switch,
  ScrollView,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { RelayConfig, ConnectionState } from '../types';
import { StorageService } from '../services/storage';
import { RelayService } from '../services/relay';
import { useTheme, ThemePreference } from '../contexts/ThemeContext';
import { useApp } from '../contexts/AppContext';

type FeatherIconName = React.ComponentProps<typeof Feather>['name'];

interface SettingRowProps {
  icon: FeatherIconName;
  label: string;
  description?: string;
  value?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  delay?: number;
  themeColors: ReturnType<typeof useTheme>['theme']['colors'];
}

function SettingRow({
  icon,
  label,
  description,
  value,
  right,
  onPress,
  delay = 0,
  themeColors,
}: SettingRowProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const rowStyle = [
    styles.settingRow,
    { borderBottomColor: themeColors.borderSubtle },
    { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
  ];

  const content = (
    <Animated.View style={rowStyle}>
      <Feather name={icon} size={18} color={themeColors.textTertiary} style={styles.settingIcon} />
      <View style={styles.settingInfo}>
        <Text style={[styles.settingLabel, { color: themeColors.textPrimary }]}>{label}</Text>
        {description ? (
          <Text style={[styles.settingDescription, { color: themeColors.textSecondary }]}>
            {description}
          </Text>
        ) : null}
        {value ? (
          <Text style={[styles.settingValue, { color: themeColors.textTertiary }]}>{value}</Text>
        ) : null}
      </View>
      {right}
    </Animated.View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.6}>
        {content}
      </TouchableOpacity>
    );
  }
  return content;
}

const THEME_OPTIONS: { label: string; value: ThemePreference; icon: FeatherIconName }[] = [
  { label: 'Dark', value: 'dark', icon: 'moon' },
  { label: 'Light', value: 'light', icon: 'sun' },
  { label: 'System', value: 'system', icon: 'smartphone' },
];

export default function SettingsScreen() {
  const [relayConfig, setRelayConfig] = useState<RelayConfig | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    status: 'disconnected',
  });
  const [voiceModeEnabled, setVoiceModeEnabled] = useState(true);

  const { theme, preference, setPreference } = useTheme();
  const { setIsPaired } = useApp();
  const colors = theme.colors;

  const sectionFade = useRef(new Animated.Value(0)).current;

  const storage = StorageService.getInstance();
  const relay = RelayService.getInstance();

  useEffect(() => {
    loadSettings();

    Animated.timing(sectionFade, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();

    const handleConnectionState = (state: ConnectionState) => {
      setConnectionState(state);
    };

    relay.on('connectionStateChanged', handleConnectionState);
    setConnectionState(relay.getConnectionState());

    return () => {
      relay.off('connectionStateChanged', handleConnectionState);
    };
  }, []);

  const loadSettings = async () => {
    try {
      const config = await storage.getRelayConfig();
      setRelayConfig(config);
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const handleDisconnect = () => {
    Alert.alert(
      'Disconnect Device',
      "This will unpair your device from OpenClaw. You'll need to pair again to reconnect.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Disconnect', style: 'destructive', onPress: performDisconnect },
      ],
    );
  };

  const performDisconnect = async () => {
    try {
      relay.disconnect();
      await storage.clearAll();
      // Signal the navigator that we're no longer paired — it will swap to Pairing screen
      setIsPaired(false);
    } catch (error) {
      console.error('Failed to disconnect:', error);
      Alert.alert('Error', 'Failed to disconnect. Please try again.');
    }
  };

  const handleReconnect = async () => {
    try {
      relay.disconnect();
      setTimeout(() => {
        relay.connect();
      }, 1000);
    } catch (error) {
      console.error('Failed to reconnect:', error);
      Alert.alert('Error', 'Failed to reconnect. Please try again.');
    }
  };

  const getStatusText = () => {
    switch (connectionState.status) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return 'Connecting...';
      case 'reconnecting':
        return 'Reconnecting...';
      case 'disconnected':
        return 'Disconnected';
      default:
        return 'Unknown';
    }
  };

  const getStatusColor = () => {
    switch (connectionState.status) {
      case 'connected':
        return colors.connected;
      case 'connecting':
      case 'reconnecting':
        return colors.connecting;
      case 'disconnected':
        return colors.disconnected;
      default:
        return colors.textTertiary;
    }
  };

  const formatLastConnected = () => {
    if (!connectionState.lastConnected) return 'Never';
    const date = new Date(connectionState.lastConnected);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  const switchTrackColor = { false: colors.white10, true: colors.white20 };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Connection */}
        <Animated.View style={[styles.section, { opacity: sectionFade }]}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>CONNECTION</Text>

          <SettingRow
            icon="wifi"
            label="Status"
            description={getStatusText()}
            delay={100}
            themeColors={colors}
            right={
              <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
            }
          />

          {connectionState.status === 'disconnected' && (
            <SettingRow
              icon="refresh-cw"
              label="Reconnect"
              description="Try connecting again"
              onPress={handleReconnect}
              delay={150}
              themeColors={colors}
              right={
                <Feather name="chevron-right" size={16} color={colors.textMuted} />
              }
            />
          )}

          <SettingRow
            icon="clock"
            label="Last connected"
            value={formatLastConnected()}
            delay={200}
            themeColors={colors}
          />

          {relayConfig && (
            <SettingRow
              icon="hash"
              label="Relay ID"
              value={relayConfig.relayId}
              delay={250}
              themeColors={colors}
            />
          )}
        </Animated.View>

        {/* Appearance */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>APPEARANCE</Text>
          <View style={[styles.themeSelector, { borderColor: colors.border }]}>
            {THEME_OPTIONS.map((opt) => {
              const active = preference === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.themeOption,
                    active && [styles.themeOptionActive, { backgroundColor: colors.surfaceElevated, borderColor: colors.borderFocus }],
                  ]}
                  onPress={() => setPreference(opt.value)}
                  activeOpacity={0.7}
                >
                  <Feather
                    name={opt.icon}
                    size={15}
                    color={active ? colors.textPrimary : colors.textTertiary}
                    style={styles.themeOptionIcon}
                  />
                  <Text
                    style={[
                      styles.themeOptionLabel,
                      { color: active ? colors.textPrimary : colors.textTertiary },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Voice */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>VOICE</Text>
          <SettingRow
            icon="mic"
            label="Voice mode"
            description="Enable voice input and audio responses"
            delay={300}
            themeColors={colors}
            right={
              <Switch
                value={voiceModeEnabled}
                onValueChange={setVoiceModeEnabled}
                trackColor={switchTrackColor}
                thumbColor={voiceModeEnabled ? colors.textPrimary : colors.textTertiary}
                ios_backgroundColor={colors.white10}
              />
            }
          />
        </View>

        {/* About */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>ABOUT</Text>
          <SettingRow icon="info" label="Version" value="1.0.0" delay={400} themeColors={colors} />
          <SettingRow
            icon="shield"
            label="Privacy Policy"
            onPress={() => {}}
            delay={450}
            themeColors={colors}
            right={
              <Feather name="external-link" size={14} color={colors.textMuted} />
            }
          />
          <SettingRow
            icon="code"
            label="Open Source Licenses"
            onPress={() => {}}
            delay={500}
            themeColors={colors}
            right={
              <Feather name="external-link" size={14} color={colors.textMuted} />
            }
          />
        </View>

        {/* Device */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>DEVICE</Text>
          <TouchableOpacity
            style={[styles.disconnectButton, { borderColor: 'rgba(248, 113, 113, 0.2)' }]}
            onPress={handleDisconnect}
            activeOpacity={0.6}
          >
            <Feather name="log-out" size={16} color={colors.disconnected} />
            <Text style={[styles.disconnectText, { color: colors.disconnected }]}>
              Disconnect Device
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 48 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },

  section: {
    marginTop: 32,
    paddingHorizontal: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '400',
    letterSpacing: 2,
    marginBottom: 16,
  },

  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  settingIcon: {
    marginRight: 14,
    width: 20,
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '400',
  },
  settingDescription: {
    fontSize: 13,
    fontWeight: '300',
    marginTop: 2,
  },
  settingValue: {
    fontSize: 14,
    fontWeight: '400',
    fontFamily: 'monospace',
    marginTop: 2,
  },

  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // Theme selector
  themeSelector: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  themeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  themeOptionActive: {
    borderWidth: 1,
    borderRadius: 8,
    margin: 3,
  },
  themeOptionIcon: {
    // just spacing via gap in parent
  },
  themeOptionLabel: {
    fontSize: 14,
    fontWeight: '400',
    letterSpacing: 0.5,
  },

  disconnectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderWidth: 1,
    borderRadius: 12,
    marginTop: 8,
  },
  disconnectText: {
    fontSize: 15,
    fontWeight: '400',
  },
});
