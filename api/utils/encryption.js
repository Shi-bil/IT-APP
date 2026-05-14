import crypto from 'crypto';

// Encryption key - should be stored in environment variables
// Generate a 32-byte key for AES-256
const getEncryptionKey = () => {
  const key = process.env.CREDENTIAL_ENCRYPTION_KEY;
  if (!key) {
    // Generate a default key if not set (for development only)
    // In production, this should always be set in environment variables
    console.warn('WARNING: CREDENTIAL_ENCRYPTION_KEY not set. Using default key. Set this in production!');
    return crypto.scryptSync('default-credential-key-change-in-production', 'salt', 32);
  }
  // If key is provided, derive a proper 32-byte key from it
  return crypto.scryptSync(key, 'credential-salt', 32);
};

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Encrypts a plaintext string
 * @param {string} plaintext - The text to encrypt
 * @returns {string} - The encrypted text in format: iv:authTag:encryptedData (all base64)
 */
export const encrypt = (plaintext) => {
  if (!plaintext) return plaintext;
  
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    const authTag = cipher.getAuthTag();
    
    // Combine IV, auth tag, and encrypted data
    return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
};

/**
 * Decrypts an encrypted string
 * @param {string} encryptedText - The encrypted text in format: iv:authTag:encryptedData
 * @returns {string} - The decrypted plaintext
 */
export const decrypt = (encryptedText) => {
  if (!encryptedText) return '';
  
  // Check if the text appears to be encrypted (contains our format)
  if (!encryptedText.includes(':')) {
    // Not encrypted (legacy data), return as-is
    return encryptedText;
  }
  
  try {
    const key = getEncryptionKey();
    const parts = encryptedText.split(':');
    
    if (parts.length !== 3) {
      // Not in expected format, return as-is (might be unencrypted legacy data)
      return encryptedText;
    }
    
    const iv = Buffer.from(parts[0], 'base64');
    const authTag = Buffer.from(parts[1], 'base64');
    const encrypted = parts[2];
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error.message);
    // If decryption fails, return empty string to prevent exposing encrypted data
    return '';
  }
};

/**
 * Checks if a string is encrypted
 * @param {string} text - The text to check
 * @returns {boolean} - True if the text appears to be encrypted
 */
export const isEncrypted = (text) => {
  if (!text) return false;
  const parts = text.split(':');
  return parts.length === 3;
};

export default {
  encrypt,
  decrypt,
  isEncrypted
};

