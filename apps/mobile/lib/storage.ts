import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Defensive storage layer.
 * Avoids SecureStore crashes on web and when methods are missing
 * (common source of minified "a.s is not a function" style errors).
 */
type StorageBackend = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

const memory = new Map<string, string>();

const memoryBackend: StorageBackend = {
  async getItem(key) {
    return memory.has(key) ? memory.get(key)! : null;
  },
  async setItem(key, value) {
    memory.set(key, value);
  },
  async removeItem(key) {
    memory.delete(key);
  },
};

const webBackend: StorageBackend = {
  async getItem(key) {
    try {
      if (typeof localStorage === 'undefined') return memoryBackend.getItem(key);
      return localStorage.getItem(key);
    } catch {
      return memoryBackend.getItem(key);
    }
  },
  async setItem(key, value) {
    try {
      if (typeof localStorage === 'undefined') return memoryBackend.setItem(key, value);
      localStorage.setItem(key, value);
    } catch {
      await memoryBackend.setItem(key, value);
    }
  },
  async removeItem(key) {
    try {
      if (typeof localStorage === 'undefined') return memoryBackend.removeItem(key);
      localStorage.removeItem(key);
    } catch {
      await memoryBackend.removeItem(key);
    }
  },
};

function nativeBackend(): StorageBackend {
  const getItem = SecureStore?.getItemAsync;
  const setItem = SecureStore?.setItemAsync;
  const removeItem = SecureStore?.deleteItemAsync;
  if (
    typeof getItem !== 'function'
    || typeof setItem !== 'function'
    || typeof removeItem !== 'function'
  ) {
    return memoryBackend;
  }
  return {
    getItem: (key) => getItem(key),
    setItem: (key, value) => setItem(key, value),
    removeItem: (key) => removeItem(key),
  };
}

function backend(): StorageBackend {
  if (Platform.OS === 'web') return webBackend;
  try {
    return nativeBackend();
  } catch {
    return memoryBackend;
  }
}

export const storage = {
  async getItem(key: string): Promise<string | null> {
    try {
      return await backend().getItem(key);
    } catch {
      return memoryBackend.getItem(key);
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    try {
      await backend().setItem(key, value);
    } catch {
      await memoryBackend.setItem(key, value);
    }
  },
  async removeItem(key: string): Promise<void> {
    try {
      await backend().removeItem(key);
    } catch {
      await memoryBackend.removeItem(key);
    }
  },
};
