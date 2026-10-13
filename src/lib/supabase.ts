import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';
import * as aesjs from 'aes-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL as string;
const key = process.env.EXPO_PUBLIC_SUPABASE_KEY as string;

if (!url || !key) {
  throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_KEY. Copy .env.example to .env.');
}

/**
 * Session storage that encrypts the (large) auth session with AES and keeps only the
 * 256-bit key in the device keystore (SecureStore). Mitigates plain-text token storage
 * flagged in the security audit (token handling on device).
 */
class LargeSecureStore {
  private async encrypt(storageKey: string, value: string) {
    const encryptionKey = crypto.getRandomValues(new Uint8Array(256 / 8));
    const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(1));
    const encrypted = cipher.encrypt(aesjs.utils.utf8.toBytes(value));
    await SecureStore.setItemAsync(storageKey, aesjs.utils.hex.fromBytes(encryptionKey));
    return aesjs.utils.hex.fromBytes(encrypted);
  }
  private async decrypt(storageKey: string, value: string) {
    const keyHex = await SecureStore.getItemAsync(storageKey);
    if (!keyHex) return null;
    const cipher = new aesjs.ModeOfOperation.ctr(aesjs.utils.hex.toBytes(keyHex), new aesjs.Counter(1));
    return aesjs.utils.utf8.fromBytes(cipher.decrypt(aesjs.utils.hex.toBytes(value)));
  }
  async getItem(k: string) {
    const enc = await AsyncStorage.getItem(k);
    if (!enc) return null;
    try {
      return await this.decrypt(k, enc);
    } catch {
      return null;
    }
  }
  async removeItem(k: string) {
    await AsyncStorage.removeItem(k);
    await SecureStore.deleteItemAsync(k);
  }
  async setItem(k: string, v: string) {
    const enc = await this.encrypt(k, v);
    await AsyncStorage.setItem(k, enc);
  }
}

const isWeb = Platform.OS === 'web';

export const supabase = createClient(url, key, {
  auth: {
    ...(isWeb ? {} : { storage: new LargeSecureStore() as any }),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: isWeb,
  },
});

export const SUPABASE_URL = url;
