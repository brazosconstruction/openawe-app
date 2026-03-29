import { PairingPayload } from '../types';

const RELAY_BASE_URL = 'https://relay.openawe.app';

// Base64 decode that works in React Native (Hermes)
function base64Decode(str: string): string {
  // Clean up the input - remove whitespace/newlines
  const cleaned = str.replace(/\s/g, '');
  
  // Try atob first (available in newer Hermes)
  if (typeof atob === 'function') {
    try {
      return atob(cleaned);
    } catch (e) {
      // fall through
    }
  }
  
  // Manual base64 decode fallback
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let output = '';
  let i = 0;
  const input = cleaned.replace(/[^A-Za-z0-9+/=]/g, '');
  
  while (i < input.length) {
    const enc1 = chars.indexOf(input.charAt(i++));
    const enc2 = chars.indexOf(input.charAt(i++));
    const enc3 = chars.indexOf(input.charAt(i++));
    const enc4 = chars.indexOf(input.charAt(i++));
    
    const chr1 = (enc1 << 2) | (enc2 >> 4);
    const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
    const chr3 = ((enc3 & 3) << 6) | enc4;
    
    output += String.fromCharCode(chr1);
    if (enc3 !== 64) output += String.fromCharCode(chr2);
    if (enc4 !== 64) output += String.fromCharCode(chr3);
  }
  
  return output;
}

/**
 * Check if input looks like a short code (e.g., "HDW6-CW5G" or "HDW6CW5G")
 */
function isShortCode(input: string): boolean {
  const cleaned = input.trim().replace(/-/g, '');
  // Short codes are 8 alphanumeric chars (uppercase letters + digits)
  return /^[A-Z0-9]{6,10}$/i.test(cleaned) && cleaned.length <= 10;
}

/**
 * Fetch the full pairing payload from the relay server using a short code
 */
async function fetchPayloadByShortCode(shortCode: string): Promise<string> {
  const cleaned = shortCode.trim();
  const url = `${RELAY_BASE_URL}/v1/pair/${encodeURIComponent(cleaned)}`;
  
  const response = await fetch(url);
  
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Short code not found. It may have expired.');
    }
    if (response.status === 410) {
      throw new Error('Short code has expired. Please generate a new one.');
    }
    throw new Error(`Failed to look up short code: HTTP ${response.status}`);
  }
  
  const data = await response.json();
  if (!data.payload) {
    throw new Error('Invalid response from relay server');
  }
  
  return data.payload;
}

/**
 * Parse a base64 pairing payload into a PairingPayload object
 */
function parseBase64Payload(payload: string): PairingPayload | null {
  try {
    // Strip any whitespace/newlines from paste
    const cleaned = payload.replace(/\s/g, '');

    // Decode from base64
    const json = base64Decode(cleaned);
    const data = JSON.parse(json);

    // Normalize field names (client uses relayServerUrl/oneTimeToken, app uses serverUrl/authToken)
    return {
      relayId: data.relayId,
      publicKey: data.publicKey,
      serverUrl: data.serverUrl || data.relayServerUrl || '',
      authToken: data.authToken || data.oneTimeToken || '',
      expiresAt: typeof data.expiresAt === 'string' ? new Date(data.expiresAt).getTime() : data.expiresAt,
    };
  } catch (error) {
    console.error('Failed to parse base64 payload:', error);
    return null;
  }
}

/**
 * Parse a pairing code (short code, manual entry, or deep link).
 * Now async because short codes require a network fetch.
 */
export async function parsePairingCode(code: string): Promise<PairingPayload | null> {
  try {
    let payload: string;
    
    // Check if it's a deep link
    if (code.startsWith('openawe://pair/')) {
      payload = code.replace('openawe://pair/', '');
      return parseBase64Payload(payload);
    }
    
    const trimmed = code.trim();
    
    // Check if it looks like a short code
    if (isShortCode(trimmed)) {
      console.log(`Detected short code: ${trimmed}, fetching payload from relay...`);
      const fullPayload = await fetchPayloadByShortCode(trimmed);
      return parseBase64Payload(fullPayload);
    }
    
    // Otherwise treat as full base64 payload
    return parseBase64Payload(trimmed);
  } catch (error) {
    console.error('Failed to parse pairing code:', error);
    return null;
  }
}

/**
 * Validate a pairing payload
 */
export function validatePairingPayload(payload: PairingPayload): boolean {
  if (!payload.relayId || !payload.publicKey || !payload.serverUrl || !payload.authToken) {
    return false;
  }

  const now = Date.now();
  if (payload.expiresAt && payload.expiresAt < now - 60000) {
    return false;
  }

  return true;
}

/**
 * Format relay server URL to ensure it's a WebSocket URL
 */
export function formatRelayUrl(url: string): string {
  let wsUrl = url;
  if (wsUrl.startsWith('http://')) wsUrl = wsUrl.replace('http://', 'ws://');
  else if (wsUrl.startsWith('https://')) wsUrl = wsUrl.replace('https://', 'wss://');
  else if (!wsUrl.startsWith('ws://') && !wsUrl.startsWith('wss://')) wsUrl = 'wss://' + wsUrl;
  
  // Ensure /v1/connect path is present
  if (!wsUrl.includes('/v1/connect')) {
    wsUrl = wsUrl.replace(/\/$/, '') + '/v1/connect';
  }
  
  return wsUrl;
}
