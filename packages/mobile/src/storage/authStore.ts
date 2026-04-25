import * as SecureStore from "expo-secure-store";

const KEY_ACCESS_TOKEN = "tm_access_token";
const KEY_REFRESH_TOKEN = "tm_refresh_token";
const KEY_DEVICE_ID = "tm_device_id";
const KEY_API_BASE = "tm_api_base";
const KEY_USER_JSON = "tm_user_json";

export type AuthUser = { id: string; email: string };

export async function saveTokens(
  accessToken: string,
  refreshToken: string
): Promise<void> {
  await SecureStore.setItemAsync(KEY_ACCESS_TOKEN, accessToken);
  await SecureStore.setItemAsync(KEY_REFRESH_TOKEN, refreshToken);
}

export async function saveAccessToken(accessToken: string): Promise<void> {
  await SecureStore.setItemAsync(KEY_ACCESS_TOKEN, accessToken);
}

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(KEY_ACCESS_TOKEN);
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(KEY_REFRESH_TOKEN);
}

export async function saveUser(user: AuthUser): Promise<void> {
  await SecureStore.setItemAsync(KEY_USER_JSON, JSON.stringify(user));
}

export async function getUser(): Promise<AuthUser | null> {
  const raw = await SecureStore.getItemAsync(KEY_USER_JSON);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export async function getOrCreateDeviceId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(KEY_DEVICE_ID);
  if (existing) return existing;
  const newId = generateUUID();
  await SecureStore.setItemAsync(KEY_DEVICE_ID, newId);
  return newId;
}

export async function saveApiBase(url: string): Promise<void> {
  await SecureStore.setItemAsync(KEY_API_BASE, url);
}

export async function getApiBase(): Promise<string | null> {
  return SecureStore.getItemAsync(KEY_API_BASE);
}

export async function clearAuth(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(KEY_ACCESS_TOKEN),
    SecureStore.deleteItemAsync(KEY_REFRESH_TOKEN),
    SecureStore.deleteItemAsync(KEY_USER_JSON),
  ]);
}

function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
