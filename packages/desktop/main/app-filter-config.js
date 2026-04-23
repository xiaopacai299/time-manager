export const APP_FILTER_CONFIG = {
  // If non-empty, only apps in this whitelist are tracked.
  whitelist: [],
  // Apps in blacklist are never tracked.
  blacklist: ['electron', 'time-manger'],
};

export function normalizeProcessName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/\.exe$/i, '')
    .trim();
}
