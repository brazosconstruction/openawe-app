import { EventEmitter } from 'events';
import { ConnectionState, RelayMessage, RelayConfig, KeyPair } from '../types';

export class RelayService extends EventEmitter {
  private static instance: RelayService;
  private ws: WebSocket | null = null;
  private connectionState: ConnectionState = { status: 'disconnected' };
  private config: RelayConfig | null = null;
  private keyPair: KeyPair | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectInterval = 5000;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private partnerOnline = false;

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
        error: error instanceof Error ? error.message : 'Connection failed' 
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

  async sendMessage(text: string): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Not connected to relay');
    }

    // Send as chat message per relay protocol
    const msg: RelayMessage = {
      type: 'chat',
      message: text,
    };

    this.ws.send(JSON.stringify(msg));
  }

  getConnectionState(): ConnectionState {
    return { ...this.connectionState };
  }

  isPartnerOnline(): boolean {
    return this.partnerOnline;
  }

  private setupWebSocketHandlers(): void {
    if (!this.ws || !this.config) return;

    this.ws.onopen = () => {
      console.log('WebSocket connected to relay');
      this.reconnectAttempts = 0;

      // Register with the relay as a client
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
        // Unwrap data envelope from host and re-process
        try {
          const inner = JSON.parse(
            typeof message.payload === 'string' ? message.payload : JSON.stringify(message.payload)
          );
          this.handleRelayMessage(inner);
        } catch {
          console.error('Failed to parse data payload:', message.payload);
        }
        break;
      }
      case 'chat':
        // Incoming chat message from the host
        if (message.message) {
          this.emit('message', message.message);
        }
        break;

      case 'partner_status':
        // Host online/offline status
        this.partnerOnline = !!message.online;
        this.setConnectionState({ partnerOnline: this.partnerOnline });
        this.emit('partnerStatus', this.partnerOnline);
        break;

      case 'status':
        if (message.online) {
          this.partnerOnline = true;
          this.setConnectionState({ partnerOnline: true });
          this.emit('partnerStatus', true);
        }
        // Connection status confirmation from relay
        console.log('Relay status:', message.online, 'partnerRole:', message.partnerRole);
        break;

      case 'error':
        console.error('Relay error:', message.message);
        this.emit('relayError', message.message);
        break;

      case 'pong':
        // Heartbeat response
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
