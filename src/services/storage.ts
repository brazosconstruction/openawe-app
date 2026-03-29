import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { KeyPair, RelayConfig, Message } from '../types';

const KEYS = {
  KEY_PAIR: 'openawe_keypair',
  RELAY_CONFIG: 'openawe_relay_config',
  MESSAGES: 'openawe_messages',
  IS_PAIRED: 'openawe_is_paired',
  LAST_CONNECTED_AT: 'openawe_last_connected_at',
} as const;

export class StorageService {
  private static instance: StorageService;

  static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  /**
   * Store encryption keys securely in iOS Keychain
   */
  async storeKeyPair(keyPair: KeyPair): Promise<void> {
    await SecureStore.setItemAsync(KEYS.KEY_PAIR, JSON.stringify(keyPair));
  }

  /**
   * Retrieve encryption keys from secure storage
   */
  async getKeyPair(): Promise<KeyPair | null> {
    try {
      const stored = await SecureStore.getItemAsync(KEYS.KEY_PAIR);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('Failed to retrieve key pair:', error);
      return null;
    }
  }

  /**
   * Store relay configuration
   */
  async storeRelayConfig(config: RelayConfig): Promise<void> {
    await AsyncStorage.setItem(KEYS.RELAY_CONFIG, JSON.stringify(config));
    await AsyncStorage.setItem(KEYS.IS_PAIRED, 'true');
  }

  /**
   * Retrieve relay configuration
   */
  async getRelayConfig(): Promise<RelayConfig | null> {
    try {
      const stored = await AsyncStorage.getItem(KEYS.RELAY_CONFIG);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('Failed to retrieve relay config:', error);
      return null;
    }
  }

  /**
   * Check if device is paired
   */
  async isPaired(): Promise<boolean> {
    try {
      const paired = await AsyncStorage.getItem(KEYS.IS_PAIRED);
      return paired === 'true';
    } catch (error) {
      return false;
    }
  }

  /**
   * Store chat messages
   */
  async storeMessages(messages: Message[]): Promise<void> {
    await AsyncStorage.setItem(KEYS.MESSAGES, JSON.stringify(messages));
  }

  /**
   * Retrieve chat messages
   */
  async getMessages(): Promise<Message[]> {
    try {
      const stored = await AsyncStorage.getItem(KEYS.MESSAGES);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to retrieve messages:', error);
      return [];
    }
  }

  /**
   * Store the timestamp of the last successful connection
   */
  async storeLastConnectedAt(timestamp: number): Promise<void> {
    await AsyncStorage.setItem(KEYS.LAST_CONNECTED_AT, String(timestamp));
  }

  /**
   * Retrieve the last connected timestamp (ms). Returns null if never set.
   */
  async getLastConnectedAt(): Promise<number | null> {
    try {
      const val = await AsyncStorage.getItem(KEYS.LAST_CONNECTED_AT);
      return val ? parseInt(val, 10) : null;
    } catch {
      return null;
    }
  }

  /**
   * Clear all stored data (for logout/unpair)
   */
  async clearAll(): Promise<void> {
    await SecureStore.deleteItemAsync(KEYS.KEY_PAIR);
    await AsyncStorage.removeItem(KEYS.RELAY_CONFIG);
    await AsyncStorage.removeItem(KEYS.MESSAGES);
    await AsyncStorage.removeItem(KEYS.IS_PAIRED);
    await AsyncStorage.removeItem(KEYS.LAST_CONNECTED_AT);
  }
}