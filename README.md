# OpenAwe iOS App

OpenAwe is a mobile app that provides a native, voice-first interface to your self-hosted OpenClaw instance through an E2E encrypted relay.

## Features

### Phase 1 - MVP (Current)
- **Pairing Flow**: Connect to OpenClaw using pairing codes or deep links (`openawe://pair/<code>`)
- **E2E Encryption**: X25519 key exchange + XChaCha20-Poly1305 encryption
- **Text Chat**: iMessage-style chat interface with OpenClaw
- **WebSocket Relay**: Auto-reconnecting connection with heartbeat
- **Photo Sharing**: Camera capture and photo library integration
- **Secure Storage**: Keys stored in iOS Keychain, messages in AsyncStorage

### Phase 2 - Voice (Coming Soon)
- Voice input with Voice Activity Detection
- TTS streaming audio playback
- Audio-first response mode

## Architecture

The app connects to OpenClaw through a relay server using end-to-end encryption:

1. **Mobile App** (React Native/Expo) ↔️ **Relay Server** ↔️ **OpenClaw Instance**
2. All messages are encrypted client-side before being sent through the relay
3. The relay server cannot read message content - it only routes encrypted data
4. Keys are generated on-device and stored securely

## Tech Stack

- **React Native + Expo SDK 55**
- **TypeScript**
- **Encryption**: libsodium-wrappers (X25519 + XChaCha20-Poly1305)
- **Storage**: expo-secure-store (iOS Keychain) + AsyncStorage
- **Navigation**: React Navigation 6
- **Media**: expo-image-picker, expo-av (future voice features)

## Development

### Prerequisites
- Node.js 25+
- Expo CLI
- iOS Simulator (Xcode) or physical iOS device
- EAS Account: brazostx

### Setup
```bash
cd /Users/sawyerkemp/openawe-app
npm install
npx expo start --port 8085
```

### Bundle Configuration
- **App Name**: OpenAwe
- **Bundle ID**: com.openawe.app
- **Deep Link Scheme**: openawe://
- **EAS Owner**: brazostx

### Key Files
- `src/services/encryption.ts` - E2E encryption implementation
- `src/services/relay.ts` - WebSocket connection management
- `src/services/storage.ts` - Secure key and data storage
- `src/screens/PairingScreen.tsx` - Initial device pairing flow
- `src/screens/ChatScreen.tsx` - Main chat interface

## Pairing Flow

1. User texts OpenClaw: "What's my relay code?"
2. OpenClaw generates pairing payload with relay ID, public key, server URL, auth token
3. OpenClaw responds with deep link: `openawe://pair/<base64-payload>`
4. User taps link or manually enters code in app
5. App generates keypair, connects to relay, sends pairing request
6. OpenClaw stores app's public key, pairing complete
7. All future messages are E2E encrypted between app and OpenClaw

## Security

- **Zero Knowledge**: Relay server cannot decrypt messages
- **Forward Secrecy**: New session keys for each connection
- **Secure Storage**: Private keys never leave iOS Keychain
- **Expiring Codes**: Pairing codes expire in 10 minutes
- **No API Keys**: App has no cloud service dependencies

## Building

### Development Build
```bash
npx expo start --port 8085
```

### Production Build (DO NOT RUN - per requirements)
```bash
# This would be the command, but don't run it:
# eas build --platform=ios --profile=production
```

## Project Status

- ✅ Expo project setup with TypeScript
- ✅ E2E encryption implementation
- ✅ WebSocket relay service with auto-reconnection
- ✅ Secure storage for keys and config
- ✅ Pairing flow with deep link support
- ✅ Chat interface with message bubbles
- ✅ Photo/camera integration
- ✅ Settings screen with connection management
- ✅ Navigation and routing
- ✅ Connection status indicators
- ⏳ Voice recording/playback (Phase 2)
- ⏳ Push notifications
- ⏳ App Store submission

## Dependencies

### Core
- expo (~55.0.8)
- react-native (0.83.2)
- typescript (~5.9.2)

### Encryption & Storage
- libsodium-wrappers (E2E encryption)
- expo-secure-store (iOS Keychain)
- @react-native-async-storage/async-storage

### Navigation & UI
- @react-navigation/native
- @react-navigation/stack
- react-native-screens
- react-native-safe-area-context

### Media & Interaction
- expo-image-picker (photos/camera)
- expo-haptics (tactile feedback)
- expo-av (future audio features)

## Notes

This is Phase 4 of the OpenAwe project. The relay server (Phase 1), crypto library (Phase 2), and OpenClaw client (Phase 3) are separate components that need to be running for the app to function.

The app is designed to work completely offline once paired, with all AI processing happening on the user's OpenClaw instance using their own API keys or local models.
