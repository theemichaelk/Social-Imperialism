import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { storage } from '@/lib/storage';
import { apiFetch } from '@/lib/api';

const TOKEN_KEY = 'si_push_token';
const ENABLED_KEY = 'si_push_enabled';

export type PushRegistration = {
  token: string | null;
  enabled: boolean;
  permission: 'granted' | 'denied' | 'undetermined' | 'unsupported' | 'error';
  message?: string;
};

function isNativePushSupported(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

export async function getPushEnabled(): Promise<boolean> {
  const v = await storage.getItem(ENABLED_KEY);
  return v !== '0';
}

export async function setPushEnabled(enabled: boolean): Promise<void> {
  await storage.setItem(ENABLED_KEY, enabled ? '1' : '0');
}

export async function getStoredPushToken(): Promise<string | null> {
  return storage.getItem(TOKEN_KEY);
}

/**
 * Configure notification handler + request permission + register Expo push token.
 * Safe on web (returns unsupported for remote; local browser notifications still work).
 */
export async function registerForPushNotifications(): Promise<PushRegistration> {
  if (!isNativePushSupported()) {
    return {
      token: null,
      enabled: false,
      permission: 'unsupported',
      message: 'Push is available on iOS/Android builds (not Expo web).',
    };
  }

  try {
    if (typeof Notifications.setNotificationHandler === 'function') {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });
    }

    if (!Device.isDevice) {
      return {
        token: null,
        enabled: false,
        permission: 'unsupported',
        message: 'Push requires a physical device (not simulator).',
      };
    }

    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      finalStatus = req.status;
    }

    if (finalStatus !== 'granted') {
      await setPushEnabled(false);
      return {
        token: null,
        enabled: false,
        permission: 'denied',
        message: 'Notification permission denied.',
      };
    }

    if (Platform.OS === 'android' && typeof Notifications.setNotificationChannelAsync === 'function') {
      await Notifications.setNotificationChannelAsync('mission', {
        name: 'Mission alerts',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#00d4ff',
      });
      await Notifications.setNotificationChannelAsync('replies', {
        name: 'AI replies',
        importance: Notifications.AndroidImportance.HIGH,
        lightColor: '#b44aff',
      });
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId
      || (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId
      || process.env.EXPO_PUBLIC_EAS_PROJECT_ID
      || undefined;

    let token: string | null = null;
    try {
      const tokenResponse = projectId
        ? await Notifications.getExpoPushTokenAsync({ projectId })
        : await Notifications.getExpoPushTokenAsync();
      token = tokenResponse?.data || null;
    } catch (e) {
      return {
        token: null,
        enabled: false,
        permission: 'error',
        message: (e as Error).message || 'Could not obtain Expo push token (set EAS projectId for production).',
      };
    }

    if (token) {
      await storage.setItem(TOKEN_KEY, token);
      await setPushEnabled(true);
      try {
        await registerTokenWithApi(token);
      } catch {
        /* offline — token still stored locally */
      }
    }

    return {
      token,
      enabled: !!token,
      permission: 'granted',
      message: token ? 'Push enabled.' : 'Could not obtain push token.',
    };
  } catch (e) {
    return {
      token: null,
      enabled: false,
      permission: 'error',
      message: (e as Error).message || 'Push registration failed',
    };
  }
}

/** Persist Expo push token on API for server-side sends later. */
export async function registerTokenWithApi(token: string): Promise<void> {
  if (!token) return;
  await apiFetch('/api/mobile/device-token', {
    method: 'POST',
    body: JSON.stringify({
      token,
      platform: Platform.OS,
      appVersion: Constants.expoConfig?.version || '2.2.0',
    }),
  });
}

export async function unregisterPush(): Promise<void> {
  await setPushEnabled(false);
  const token = await getStoredPushToken();
  if (token) {
    try {
      await apiFetch('/api/mobile/device-token', {
        method: 'DELETE',
        body: JSON.stringify({ token }),
      });
    } catch {
      /* still clear local */
    }
  }
  await storage.removeItem(TOKEN_KEY);
}

/**
 * Local notification — works without remote FCM when app is open / backgrounded on native.
 * Web: uses Notification API when available.
 */
export async function notifyLocal(title: string, body: string, data?: Record<string, unknown>): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      if (typeof Notification !== 'undefined') {
        if (Notification.permission === 'default') {
          await Notification.requestPermission();
        }
        if (Notification.permission === 'granted') {
          // eslint-disable-next-line no-new
          new Notification(title, { body, data: data as NotificationOptions['data'] });
        }
      }
    } catch {
      /* ignore */
    }
    return;
  }

  try {
    if (typeof Notifications.scheduleNotificationAsync !== 'function') return;
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data || {},
        sound: true,
      },
      trigger: null,
    });
  } catch {
    /* ignore scheduling failures */
  }
}
