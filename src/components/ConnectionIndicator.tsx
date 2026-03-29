import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { ConnectionState } from '../types';
import theme from '../constants/theme';

interface ConnectionIndicatorProps {
  connectionState: ConnectionState;
}

export default function ConnectionIndicator({ connectionState }: ConnectionIndicatorProps) {
  const pulse = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnimation = useRef<Animated.CompositeAnimation | null>(null);

  const isConnecting = connectionState.status === 'connecting' || connectionState.status === 'reconnecting';
  const isConnected = connectionState.status === 'connected';
  const isDisconnected = connectionState.status === 'disconnected';
  const partnerOnline = connectionState.partnerOnline ?? false;

  // Show the bar when: not connected, or connected but partner offline
  const shouldShow = !isConnected || (isConnected && !partnerOnline);

  useEffect(() => {
    if (isConnecting) {
      pulseAnimation.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 0.4,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
      );
      pulseAnimation.current.start();
    } else {
      pulseAnimation.current?.stop();
      Animated.timing(pulse, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }

    return () => {
      pulseAnimation.current?.stop();
    };
  }, [connectionState.status]);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: shouldShow ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [shouldShow]);

  if (!shouldShow) {
    return null;
  }

  const getStatusColor = () => {
    if (isConnecting) return theme.colors.connecting;
    if (isDisconnected) return theme.colors.disconnected;
    // Connected but partner offline
    if (isConnected && !partnerOnline) return theme.colors.connecting;
    return theme.colors.textTertiary;
  };

  const getStatusText = () => {
    if (connectionState.status === 'connecting') return 'Connecting';
    if (connectionState.status === 'reconnecting') return 'Reconnecting';
    if (connectionState.status === 'disconnected') {
      return connectionState.error || 'Disconnected';
    }
    // Connected but partner offline
    if (isConnected && !partnerOnline) return 'Host offline';
    return 'Unknown';
  };

  const statusColor = getStatusColor();

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <Animated.View
        style={[styles.dot, { backgroundColor: statusColor, opacity: pulse }]}
      />
      <Text style={[styles.text, { color: statusColor }]}>
        {getStatusText()}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 8,
  },
  text: {
    fontSize: 13,
    fontWeight: '300',
    letterSpacing: 0.5,
  },
});
