export interface KeyPair {
  publicKey: string;
  privateKey: string;
}

export interface RelayConfig {
  relayId: string;
  serverUrl: string;
  pairedDevicePublicKey: string;
}

export interface PairingPayload {
  relayId: string;
  publicKey: string;
  serverUrl: string;
  authToken: string;
  expiresAt: number;
}

export interface MessageMetadata {
  imageUri?: string;
  imageBase64?: string;
  audioUri?: string;
  fileSize?: number;
  type?: string;
}

export interface Attachment {
  type: 'image' | 'file' | 'video';
  data?: string;       // base64-encoded content
  url?: string;        // remote URL
  mimeType: string;
  filename?: string;
}

export interface Message {
  id: string;
  text: string;
  timestamp: number;
  isUser: boolean;
  type: 'text' | 'image' | 'audio';
  metadata?: MessageMetadata;
  attachments?: Attachment[];
}

export interface ConnectionState {
  status: 'disconnected' | 'connecting' | 'connected' | 'reconnecting';
  lastConnected?: number;
  error?: string;
  partnerOnline?: boolean;
}

export interface RelayMessage {
  type: 'register' | 'chat' | 'ping' | 'pong' | 'status' | 'partner_status' | 'error' | 'data';
  relayId?: string;
  role?: 'client' | 'host';
  message?: string;
  online?: boolean;
  connected?: boolean;
  echoMode?: boolean;
  error?: string;
  payload?: string;
  partnerRole?: string;
}
