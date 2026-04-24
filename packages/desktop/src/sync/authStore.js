// packages/desktop/src/sync/authStore.js
const api = () => window.timeManagerAPI?.sync;

export async function getAuthState() {
  return api()?.getAuthState() ?? null;
}

export async function saveAuthState({ accessToken, refreshToken, userId, email, apiBase, deviceId }) {
  return api()?.saveAuthState({ accessToken, refreshToken, userId, email, apiBase, deviceId });
}

export async function clearAuthState() {
  return api()?.clearAuth();
}

let _cachedDeviceId = null;

/**
 * 应用启动时调用一次，从主进程读取并缓存 deviceId。
 * 若 sync-state 中尚无 deviceId，生成新 UUID 并存入主进程。
 */
export async function initDeviceId() {
  const state = await api()?.getState();
  if (state?.deviceId) {
    _cachedDeviceId = state.deviceId;
    return state.deviceId;
  }
  const newId = _generateUUID();
  _cachedDeviceId = newId;
  await api()?.setState({ deviceId: newId });
  return newId;
}

/** 返回缓存的 deviceId（需先调用过 initDeviceId）*/
export function getCachedDeviceId() {
  return _cachedDeviceId;
}

function _generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
