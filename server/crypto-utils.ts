import { createCipher, createDecipher, randomBytes, scryptSync, createCipheriv, createDecipheriv } from 'crypto';

// Use environment variable for encryption key in production
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-dev-key-change-in-production';
const ALGORITHM = 'aes-256-gcm';

/**
 * Derives a key from the encryption secret using scrypt
 */
function deriveKey(secret: string, salt: Buffer): Buffer {
  return scryptSync(secret, salt, 32);
}

/**
 * Encrypts sensitive PII data
 */
export function encryptPII(text: string): string {
  if (!text) return text;
  
  try {
    const salt = randomBytes(16);
    const iv = randomBytes(16);
    const key = deriveKey(ENCRYPTION_KEY, salt);
    
    const cipher = createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Combine salt, iv, authTag, and encrypted data
    const result = salt.toString('hex') + ':' + iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
    return result;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypts sensitive PII data
 */
export function decryptPII(encryptedText: string): string {
  if (!encryptedText || !encryptedText.includes(':')) return encryptedText;
  
  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 4) {
      // Handle legacy unencrypted data
      return encryptedText;
    }
    
    const [saltHex, ivHex, authTagHex, encrypted] = parts;
    const salt = Buffer.from(saltHex, 'hex');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const key = deriveKey(ENCRYPTION_KEY, salt);
    
    // Validate auth tag length for GCM mode (should be 16 bytes)
    if (authTag.length !== 16) {
      throw new Error('Invalid authentication tag length');
    }
    
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    // Return original data if decryption fails (for backward compatibility)
    return encryptedText;
  }
}

/**
 * Hashes phone numbers for secure searching (one-way)
 */
export function hashPhoneNumber(phoneNumber: string): string {
  if (!phoneNumber) return phoneNumber;
  
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(phoneNumber + ENCRYPTION_KEY).digest('hex');
}

/**
 * Encrypts user data for storage
 */
export function encryptUserData(userData: {
  phoneNumber?: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
}) {
  return {
    ...userData,
    phoneNumber: userData.phoneNumber ? encryptPII(userData.phoneNumber) : userData.phoneNumber,
    firstName: userData.firstName ? encryptPII(userData.firstName) : userData.firstName,
    lastName: userData.lastName ? encryptPII(userData.lastName) : userData.lastName,
    displayName: userData.displayName ? encryptPII(userData.displayName) : userData.displayName,
  };
}

/**
 * Decrypts user data for display
 */
export function decryptUserData(userData: {
  phoneNumber?: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
}) {
  return {
    ...userData,
    phoneNumber: userData.phoneNumber ? decryptPII(userData.phoneNumber) : userData.phoneNumber,
    firstName: userData.firstName ? decryptPII(userData.firstName) : userData.firstName,
    lastName: userData.lastName ? decryptPII(userData.lastName) : userData.lastName,
    displayName: userData.displayName ? decryptPII(userData.displayName) : userData.displayName,
  };
}