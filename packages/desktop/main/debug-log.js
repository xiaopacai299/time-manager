import fs from 'fs';
import path from 'path';

const DEBUG_ENABLED = String(process.env.DEBUG_LOG || '').toLowerCase() === 'true';
const LOG_FILE = path.resolve(process.cwd(), 'app.log');

function stringifyPart(part) {
  if (typeof part === 'string') return part;
  try {
    return JSON.stringify(part);
  } catch {
    return String(part);
  }
}

export function debugLog(...parts) {
  if (!DEBUG_ENABLED) return;
  const line = `[${new Date().toISOString()}] ${parts.map(stringifyPart).join(' ')}\n`;
  try {
    fs.appendFileSync(LOG_FILE, line, 'utf8');
  } catch {
    // Ignore logging failures to avoid impacting app runtime behavior.
  }
}

export function isDebugLogEnabled() {
  return DEBUG_ENABLED;
}
