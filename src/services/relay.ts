import { EventEmitter } from 'events';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ConnectionState, RelayMessage, RelayConfig, KeyPair, Attachment } from '../types';

export class RelayService extends EventEmitter {
  private static instance: RelayService;
  private ws: WebSocket | null = null;
  private connectionState: ConnectionState = { status: 'disconnected' };
  private config: RelayConfig | null = null;
  private keyPair: KeyPair | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectInterval = 1000;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private partnerOnline = false;

  /** Push token registered with Expo — forwarded to host on first connect */
  private pushToken: string | null = null;
  private pushTokenSent = false;

  static getInstance(): RelayService {
    if (!RelayService.instance) {
      RelayService.instance = new RelayService();
    }
    return RelayService.instance;
  }

  constructor() {
    super();
  }

  async initialize(config: RelayConfig, keyPair: KeyPair): Promise<void> {
    this.config = config;
    this.keyPair = keyPair;
  }

  /** Called from App.tsx once the push token is obtained */
  setPushToken(token: string): void {
    this.pushToken = token;
    this.pushTokenSent = false; // force re-send on next connection
    // If already connected, send now
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendPushToken();
    }
  }

  /** If app was woken by a push notification, ensure we reconnect */
  reconnectIfNeeded(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.reconnectAttempts = 0;
      this.connect();
    }
  }

  async connect(): Promise<void> {
    if (!this.config || !this.keyPair) {
      throw new Error('RelayService not initialized');
    }

    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    this.setConnectionState({ status: 'connecting' });

    try {
      this.ws = new WebSocket(this.config.serverUrl);
      this.setupWebSocketHandlers();
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      this.setConnectionState({
        status: 'disconnected',
        error: error instanceof Error ? error.message : 'Connection failed',
      });
      this.scheduleReconnect();
    }
  }

  disconnect(): void {
    this.clearHeartbeat();
    if (this.ws) {
      this.ws.close(1000, 'User disconnect');
      this.ws = null;
    }
    this.setConnectionState({ status: 'disconnected', partnerOnline: false });
    this.partnerOnline = false;
    this.reconnectAttempts = 0;
  }

  /** Send a chat message, optionally with attachments */
  async sendMessage(text: string, attachments?: Attachment[]): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Not connected to relay');
    }

    const msg: RelayMessage & { attachments?: Attachment[] } = {
      type: 'chat',
      message: text,
    };

    if (attachments && attachments.length > 0) {
      msg.attachments = attachments;
    }

    this.ws.send(JSON.stringify(msg));
  }

  getConnectionState(): ConnectionState {
    return { ...this.connectionState };
  }

  isPartnerOnline(): boolean {
    return this.partnerOnline;
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private sendPushToken(): void {
    if (!this.pushToken || this.pushTokenSent) return;
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const msg = {
      type: 'push_token',
      token: this.pushToken,
    };

    try {
      this.ws.send(JSON.stringify(msg));
      this.pushTokenSent = true;
      console.log('[relay] Push token sent to host');
    } catch (err) {
      console.error('[relay] Failed to send push token:', err);
    }
  }

  private setupWebSocketHandlers(): void {
    if (!this.ws || !this.config) return;

    this.ws.onopen = () => {
      console.log('WebSocket connected to relay');
      this.reconnectAttempts = 0;

      // Register as client
      const registerMessage: RelayMessage = {
        type: 'register',
        role: 'client',
        relayId: this.config!.relayId,
      };
      this.ws!.send(JSON.stringify(registerMessage));
      this.startHeartbeat();

      this.setConnectionState({
        status: 'connected',
        lastConnected: Date.now(),
      });

      // Forward push token to host after a short delay (let handshake settle)
      setTimeout(() => this.sendPushToken(), 1000);
    };

    this.ws.onmessage = (event) => {
      try {
        const message: RelayMessage = JSON.parse(
          typeof event.data === 'string' ? event.data : ''
        );
        this.handleRelayMessage(message);
      } catch (error) {
        console.error('Failed to parse relay message:', error);
      }
    };

    this.ws.onclose = (event) => {
      console.log('WebSocket closed:', event.code, event.reason);
      this.clearHeartbeat();
      this.pushTokenSent = false; // re-send on next connect

      if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.setConnectionState({ status: 'reconnecting' });
        this.scheduleReconnect();
      } else {
        this.setConnectionState({ status: 'disconnected' });
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  private handleRelayMessage(message: RelayMessage): void {
    switch (message.type) {
      case 'data': {
        try {
          const inner = JSON.parse(
            typeof message.payload === 'string'
              ? message.payload
              : JSON.stringify(message.payload)
          );
          this.handleRelayMessage(inner);
        } catch {
          console.error('Failed to parse data payload:', message.payload);
        }
        break;
      }

      case 'chat':
        if (message.message) {
          this.emit('message', message.message);
        }
        break;

      case 'partner_status':
        this.partnerOnline = !!message.online;
        this.setConnectionState({ partnerOnline: this.partnerOnline });
        this.emit('partnerStatus', this.partnerOnline);
        break;

      case 'status':
        if (message.online || message.connected) {
          this.partnerOnline = true;
          this.setConnectionState({ partnerOnline: true });
          this.emit('partnerStatus', true);
          // Persist last connected timestamp so app can auto-reconnect on next launch
          const now = Date.now();
          AsyncStorage.setItem('openawe_last_connected_at', String(now)).catch(() => {});
          this.emit('hostOnline', { echoMode: !!message.echoMode });
        }
        console.log('Relay status:', message.online, message.connected, 'partnerRole:', message.partnerRole);
        break;

      case 'error':
        console.error('Relay error:', message.message);
        this.emit('relayError', message.message);
        break;

      case 'pong':
        break;

      default:
        console.log('Unknown relay message type:', message.type);
    }
  }

  private startHeartbeat(): void {
    this.clearHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 25000);
  }

  private clearHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private scheduleReconnect(): void {
    const delay = Math.min(
      this.reconnectInterval * Math.pow(2, this.reconnectAttempts),
      30000
    );
    setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }

  private setConnectionState(state: Partial<ConnectionState>): void {
    this.connectionState = { ...this.connectionState, ...state };
    this.emit('connectionStateChanged', this.connectionState);
  }
}
