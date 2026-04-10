import { app } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { prisma as db } from '../db'; // Assuming standard db import

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

// The master key is derived from a system-specific string (e.g., machine GUID or user-defined passphrase).
// For now, we'll store a random master key securely or use a fixed seed mixed with machine info, 
// but saving a generated master key in an OS-level keychain is optimal.
// Since we are not using keytar immediately, let's store a master key file in userData (restricted access)
// or just use a derived key from something stable.

let ENCRYPTION_KEY: Buffer | null = null;

async function getEncryptionKey(): Promise<Buffer> {
  if (ENCRYPTION_KEY) return ENCRYPTION_KEY;

  const keyPath = path.join(app.getPath('userData'), 'master.key');
  try {
    const keyData = await fs.readFile(keyPath);
    ENCRYPTION_KEY = keyData;
    return ENCRYPTION_KEY;
  } catch {
    // If not exists, generate a new one
    ENCRYPTION_KEY = crypto.randomBytes(KEY_LENGTH);
    await fs.writeFile(keyPath, ENCRYPTION_KEY, { mode: 0o600 }); // Restrict file permissions
    return ENCRYPTION_KEY;
  }
}

export async function encryptText(text: string): Promise<string> {
  const key = await getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Format: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export async function decryptText(encryptedText: string): Promise<string> {
  const key = await getEncryptionKey();
  const parts = encryptedText.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted text format');
  
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

// ----------------------------------------------------------------------------
// Directories
// ----------------------------------------------------------------------------

export async function getCredentialsDirectory(): Promise<string> {
  const credPath = path.join(app.getPath('userData'), 'credentials');
  try {
    await fs.mkdir(credPath, { recursive: true });
  } catch (e) {
    // ignore
  }
  return credPath;
}

// ----------------------------------------------------------------------------
// API
// ----------------------------------------------------------------------------

export interface CredentialInput {
  key: string;
  name: string;
  type: 'string' | 'file';
  value?: string;           // plaintext string value (will be encrypted)
  fileName?: string;        // original file name
  fileContent?: string;     // base64 encoded or utf-8 string content for the file
}

/**
 * Creates or updates a credential.
 */
export async function saveCredential(input: CredentialInput) {
  let fileRelativePath: string | null = null;
  let encryptedValue: string | null = null;

  if (input.type === 'string' && input.value) {
    encryptedValue = await encryptText(input.value);
  } else if (input.type === 'file' && input.fileName && input.fileContent) {
    const credDir = await getCredentialsDirectory();
    // Use the key or a sanitize version as the subfolder/filename to ensure uniqueness, 
    // or just use a timestamp.
    const fileBaseName = `${input.key}_${input.fileName}`;
    const fullPath = path.join(credDir, fileBaseName);
    
    // Convert base64 to buffer if needed, but let's assume it's utf8 generic string for JSON/text files
    // or binary. For simplicity, we assume frontend passes a string (UTF-8).
    await fs.writeFile(fullPath, input.fileContent, { encoding: 'utf-8' });
    fileRelativePath = fileBaseName;
  } else {
    throw new Error('Invalid credential input');
  }

  // Save to Database
  return await db.credential.upsert({
    where: { key: input.key },
    update: {
      name: input.name,
      type: input.type,
      value: encryptedValue,
      filePath: fileRelativePath,
    },
    create: {
      key: input.key,
      name: input.name,
      type: input.type,
      value: encryptedValue,
      filePath: fileRelativePath,
    }
  });
}

/**
 * Lists all credentials (omits the secret values).
 */
export async function listCredentials() {
  const creds = await db.credential.findMany({
    select: {
      id: true,
      key: true,
      name: true,
      type: true,
      filePath: true, // We can return the path maybe, or just type
      updatedAt: true,
    }
  });
  return creds;
}

/**
 * Gets a credential securely (decrypts strings or returns the absolute path of the file).
 */
export async function getCredential(key: string) {
  const cred = await db.credential.findUnique({ where: { key } });
  if (!cred) return null;

  if (cred.type === 'string' && cred.value) {
    const decrypted = await decryptText(cred.value);
    return { ...cred, decryptedValue: decrypted };
  } else if (cred.type === 'file' && cred.filePath) {
    const credDir = await getCredentialsDirectory();
    const absolutePath = path.join(credDir, cred.filePath);
    return { ...cred, absoluteFilePath: absolutePath };
  }

  return cred;
}

/**
 * Removes a credential.
 */
export async function deleteCredential(key: string) {
  const cred = await db.credential.findUnique({ where: { key } });
  if (cred) {
    if (cred.type === 'file' && cred.filePath) {
      const credDir = await getCredentialsDirectory();
      try {
        await fs.unlink(path.join(credDir, cred.filePath));
      } catch (e) {
        console.error('Failed to delete credential file:', e);
      }
    }
    await db.credential.delete({ where: { key } });
  }
}

/**
 * 驗證實體檔案憑證的健康度 (檢查檔案是否被手動刪除)
 * 如果檔案不見了，就清空 DB 該筆紀錄
 * 返回: 是否 google-oauth-secret 被刪除了
 */
export async function verifyCredentialsHealth(): Promise<boolean> {
  // 1. Check if mandatory oauth-secret exists in DB
  const oauthSecret = await db.credential.findUnique({ where: { key: 'google-oauth-secret' } });
  if (!oauthSecret) {
    return true; // Missing mandatory credential
  }

  const creds = await db.credential.findMany({ where: { type: 'file' } });
  const credDir = await getCredentialsDirectory();
  let secretDeleted = false;
  
  for (const cred of creds) {
    if (cred.filePath) {
      const fullPath = path.join(credDir, cred.filePath);
      try {
        await fs.access(fullPath);
      } catch {
        await db.credential.delete({ where: { key: cred.key } });
        console.warn(`[CredentialService] 發現實體檔案遺失 ${cred.key}，已從資料庫移除。`);
        if (cred.key === 'google-oauth-secret') secretDeleted = true;
      }
    }
  }
  return secretDeleted;
}
