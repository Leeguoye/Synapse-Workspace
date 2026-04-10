// src/electron/services/PluginContextBridge.ts

import { google } from 'googleapis';
import { getDriveAuth } from '../utils/googleAuth';
import { getCredential } from './CredentialService';
import { prisma as db } from '../db';
import { URL } from 'node:url';

/** 節點插件執行的上下文介面 */
export interface PluginContext {
  pluginId: string;
  nodeType: string;
  inputs: Record<string, unknown>;

  // --- 核心通用層 ---
  log(msg: unknown): void;
  http(url: string, options?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    json?: any;
  }): Promise<any>;

  credentials: {
    get(key: string): Promise<string | null>;
  };

  sqlite: {
    query(sql: string, params?: unknown[]): Promise<unknown[]>;
    run(sql: string, params?: unknown[]): Promise<void>;
  };

  output(data: unknown): void;

  // --- Google 授權層 (僅提供通行證，業務邏輯由插件自行透過 http 實作) ---
  google: {
    getAccessToken(): Promise<string>;
  };
}

/** SSRF 防範：檢查 URL 是否安全 */
function isSafeUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    const host = url.hostname.toLowerCase();
    
    // 阻擋 localhost / 內網 IP
    const blockedHosts = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];
    if (blockedHosts.includes(host)) return false;

    // 阻擋特定的私有網段 (簡易實作)
    if (host.startsWith('192.168.') || host.startsWith('10.') || host.startsWith('172.')) return false;
    
    // 阻擋 Cloud Metadata API
    if (host === '169.254.169.254') return false;

    return true;
  } catch {
    return false;
  }
}

/** 建立一個特定插件節點執行的 Context */
export function createPluginContext(
  pluginId: string,
  nodeType: string,
  inputs: Record<string, unknown>
): { ctx: PluginContext; getOutput: () => unknown } {
  let _output: unknown = null;

  const ctx: PluginContext = {
    pluginId,
    nodeType,
    inputs,

    log(msg) {
      console.log(`[Plugin:${pluginId}:${nodeType}]`, msg);
    },

    async http(url, options = {}) {
      if (!isSafeUrl(url)) throw new Error(`[SSRF] 禁止存取非安全 URL: ${url}`);
      
      console.log(`[PluginContext] http: ${options.method || 'GET'} ${url}`);
      const method = options.method || 'GET';
      const headers = options.headers || {};
      let body = options.body;

      if (options.json) {
        body = JSON.stringify(options.json);
        headers['Content-Type'] = 'application/json';
      }

      const response = await fetch(url, { method, headers, body });
      const text = await response.text();
      
      return {
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        text: () => text,
        json: () => {
          try {
            return JSON.parse(text);
          } catch (e) {
            if (text.trim().startsWith('<')) {
              throw new Error(`回傳內容不是有效的 JSON (可能是 HTML/XML 錯誤頁面)。開頭內容: ${text.slice(0, 100).replace(/\n/g, ' ')}...`);
            }
            throw e;
          }
        },
      };
    },

    credentials: {
      async get(key) {
        const cred = await getCredential(key);
        if (!cred) return null;
        if (cred.type === 'string' && 'decryptedValue' in cred) {
          return (cred as any).decryptedValue;
        }
        return null;
      }
    },

    sqlite: {
      async query(sql, params = []) {
        console.log(`[PluginContext] sqlite.query: ${sql} | Params: ${JSON.stringify(params)}`);
        // 暫時使用 Prisma 的原始查詢，未來應導入 PluginStore table 限制
        return await db.$queryRawUnsafe(sql, ...params);
      },
      async run(sql, params = []) {
        console.log(`[PluginContext] sqlite.run: ${sql} | Params: ${JSON.stringify(params)}`);
        await db.$executeRawUnsafe(sql, ...params);
      }
    },

    output(data) {
      _output = data;
    },

    google: {
      async getAccessToken() {
        console.log(`[PluginContext] google.getAccessToken`);
        const auth = await getDriveAuth();
        if (!auth) throw new Error('Google OAuth 尚未授權或已失效');
        
        const tokens = await auth.getAccessToken();
        if (!tokens || !tokens.token) throw new Error('無法取得 Access Token');
        
        return tokens.token;
      }
    }
  };

  return { ctx, getOutput: () => _output };
}
