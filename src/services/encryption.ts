import sodium from 'libsodium-wrappers';
import { KeyPair, PairingPayload } from '../types';

export class EncryptionService {
  private static instance: EncryptionService;
  private initialized = false;

  static getInstance(): EncryptionService {
    if (!EncryptionService.instance) {
      EncryptionService.instance = new EncryptionService();
    }
    return EncryptionService.instance;
  }

  async initialize(): Promise<void> {
    if (!this.initialized) {
      await sodium.ready;
      this.initialized = true;
    }
  }

  /**
   * Generate a new X25519 key pair
   */
  generateKeyPair(): KeyPair {
    this.ensureInitialized();
    
    const keyPair = sodium.crypto_kx_keypair();
    return {
      publicKey: sodium.to_base64(keyPair.publicKey),
      privateKey: sodium.to_base64(keyPair.privateKey)
    };
  }

  /**
   * Encrypt a message using XChaCha20-Poly1305
   */
  encrypt(message: string, recipientPublicKey: string, senderPrivateKey: string): string {
    this.ensureInitialized();

    // Generate a random nonce
    const nonce = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
    
    // Convert keys from base64
    const recipientPubKeyBytes = sodium.from_base64(recipientPublicKey);
    const senderPrivKeyBytes = sodium.from_base64(senderPrivateKey);
    
    // Derive sender's public key from private key
    const senderPubKeyBytes = sodium.crypto_scalarmult_base(senderPrivKeyBytes.slice(0, 32));
    
    // Derive shared secret using X25519
    const sharedSecret = sodium.crypto_kx_client_session_keys(
      senderPubKeyBytes,
      senderPrivKeyBytes.slice(0, 32),
      recipientPubKeyBytes
    );
    
    // Encrypt using XChaCha20-Poly1305
    const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
      message,
      null, // no additional data
      null, // no secret nonce
      nonce,
      sharedSecret.sharedTx
    );

    // Combine nonce + ciphertext and encode as base64
    const combined = new Uint8Array(nonce.length + ciphertext.length);
    combined.set(nonce);
    combined.set(ciphertext, nonce.length);
    
    return sodium.to_base64(combined);
  }

  /**
   * Decrypt a message using XChaCha20-Poly1305
   */
  decrypt(encryptedMessage: string, senderPublicKey: string, recipientPrivateKey: string): string {
    this.ensureInitialized();

    // Decode from base64
    const combined = sodium.from_base64(encryptedMessage);
    
    // Extract nonce and ciphertext
    const nonceLength = sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES;
    const nonce = combined.slice(0, nonceLength);
    const ciphertext = combined.slice(nonceLength);
    
    // Convert keys from base64
    const senderPubKeyBytes = sodium.from_base64(senderPublicKey);
    const recipientPrivKeyBytes = sodium.from_base64(recipientPrivateKey);
    
    // Derive recipient's public key from private key
    const recipientPubKeyBytes = sodium.crypto_scalarmult_base(recipientPrivKeyBytes.slice(0, 32));
    
    // Derive shared secret using X25519
    const sharedSecret = sodium.crypto_kx_server_session_keys(
      recipientPubKeyBytes,
      recipientPrivKeyBytes.slice(0, 32),
      senderPubKeyBytes
    );
    
    // Decrypt using XChaCha20-Poly1305
    const plaintext = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
      null, // no secret nonce
      ciphertext,
      null, // no additional data
      nonce,
      sharedSecret.sharedRx
    );
    
    return sodium.to_string(plaintext);
  }

  /**
   * Encode pairing payload to base64
   */
  encodePairingPayload(payload: PairingPayload): string {
    return Buffer.from(JSON.stringify(payload)).toString('base64');
  }

  /**
   * Decode pairing payload from base64
   */
  decodePairingPayload(encoded: string): PairingPayload {
    const json = Buffer.from(encoded, 'base64').toString();
    return JSON.parse(json);
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('EncryptionService not initialized. Call initialize() first.');
    }
  }
}
