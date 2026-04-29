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
  // 便签等排障：首参为 debug-bug 时始终打到主进程控制台（不依赖 DEBUG_LOG），便于 pnpm desktop:dev 直接看终端
  if (parts.length > 0 && parts[0] === 'debug-bug') {
    try {
      console.log('[debug-bug]', ...parts.slice(1));
    } catch {
      /* ignore */
    }
  }
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
