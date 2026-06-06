import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { ENV } from '../config/env';

/**
 * Storage adapter that keeps the Supabase session in the device secure
 * enclave/keystore via expo-secure-store. SecureStore caps each value at ~2KB,
 * and Supabase session blobs (with JWTs) can exceed that, so we transparently
 * chunk large values across multiple keys. A small index key records the chunk
 * count for reassembly.
 *
 * On web (where SecureStore is unavailable) we fall back to AsyncStorage.
 */
const CHUNK_SIZE = 1800;

const SecureStoreAdapter = {
  async getItem(key: string): Promise<string | null> {
    const head = await SecureStore.getItemAsync(key);
    if (head === null) return null;
    // Not chunked: a plain value.
    if (!head.startsWith('__chunks__:')) return head;

    const count = parseInt(head.slice('__chunks__:'.length), 10);
    let out = '';
    for (let i = 0; i < count; i++) {
      const part = await SecureStore.getItemAsync(`${key}__${i}`);
      if (part === null) return null; // corrupted; treat as missing
      out += part;
    }
    return out;
  },

  async setItem(key: string, value: string): Promise<void> {
    if (value.length <= CHUNK_SIZE) {
      await SecureStore.setItemAsync(key, value);
      return;
    }
    const count = Math.ceil(value.length / CHUNK_SIZE);
    await SecureStore.setItemAsync(key, `__chunks__:${count}`);
    for (let i = 0; i < count; i++) {
      const slice = value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      await SecureStore.setItemAsync(`${key}__${i}`, slice);
    }
  },

  async removeItem(key: string): Promise<void> {
    const head = await SecureStore.getItemAsync(key);
    if (head?.startsWith('__chunks__:')) {
      const count = parseInt(head.slice('__chunks__:'.length), 10);
      for (let i = 0; i < count; i++) {
        await SecureStore.deleteItemAsync(`${key}__${i}`);
      }
    }
    await SecureStore.deleteItemAsync(key);
  },
};

const storage = Platform.OS === 'web' ? AsyncStorage : SecureStoreAdapter;

export const supabase: SupabaseClient = createClient(
  ENV.SUPABASE_URL,
  ENV.SUPABASE_ANON_KEY,
  {
    auth: {
      storage,
      autoRefreshToken: true,
      persistSession: true,
      // Email OTP / magic-link is not a redirect flow on native.
      detectSessionInUrl: false,
    },
  },
);
