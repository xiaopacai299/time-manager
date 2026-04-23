import os from 'os';
import { EventEmitter } from 'events';
import { powerMonitor } from 'electron';
import { getForegroundContext } from './foreground.js';
import { ActivityEngine } from './activity-engine.js';
import { APP_FILTER_CONFIG, normalizeProcessName } from './app-filter-config.js';
// import { debugLog } from './debug-log.js';


// 每隔一段时间（例如 1 秒）问一次：现在前台是谁？
// 如果这一秒里前台还是同一个应用，就给这个应用累加时间。
// 如果下一秒前台换了，就认为切换了应用，给新应用重新计时。
export class TimeMonitorService extends EventEmitter {
  constructor({ sampleIntervalMs = 1000, breakThresholdSeconds = 600 } = {}) {
    super();
    this.sampleIntervalMs = sampleIntervalMs;
    this.engine = new ActivityEngine({ breakThresholdSeconds });
    this.timer = null;
    this.latestSnapshot = this.engine.getSnapshot();
  }

  extractTitleAppName(windowTitle) {
    const title = String(windowTitle || '').trim();
    if (!title) return '';
    const parts = title.split(' - ').map((x) => x.trim()).filter(Boolean);
    return (parts.length > 1 ? parts[parts.length - 1] : parts[0]).toLowerCase();
  }

  resolveProcessName(processName, windowTitle) {
    const normalized = normalizeProcessName(processName);
    const shellHosts = new Set(['powershell', 'cmd', 'windowsterminal', 'conhost']);
    if (shellHosts.has(normalized)) {
      const titleApp = this.extractTitleAppName(windowTitle);
      if (titleApp) return titleApp;
    }
    return normalized || 'unknown';
  }

  buildAppId(processName, windowTitle, processId = 0) {
    const normalized = this.resolveProcessName(processName, windowTitle);
    const isInvalidProcessName =
      !normalized || normalized === 'unknown' || normalized === 'permissionorruntimeerror';

    if (!isInvalidProcessName) {
      return normalized;
    }
    if (Number(processId) > 0) {
      return `pid::${processId}`;
    }

    const safeTitle = String(windowTitle || 'Unknown').trim().toLowerCase() || 'unknown';
    return `unknown::${safeTitle}`;
  }

  isTrackerWindow(processName, windowTitle) {
    const p = normalizeProcessName(processName);
    const t = String(windowTitle || '').toLowerCase();
    return p === 'electron' || t.includes('time manager') || t.includes('time-manger');
  }

  shouldTrackApp(processName) {
    const app = normalizeProcessName(processName);
    const whitelist = APP_FILTER_CONFIG.whitelist.map(normalizeProcessName).filter(Boolean);
    const blacklist = APP_FILTER_CONFIG.blacklist.map(normalizeProcessName).filter(Boolean);
    if (blacklist.includes(app)) return false;
    if (whitelist.length === 0) return true;
    return whitelist.includes(app);
  }

  // 采集当前前台应用信息（进程名、窗口标题、idle 秒数等）
  async collectSample() {
    const now = Date.now();
    const idleSeconds = powerMonitor.getSystemIdleTime();
    const fg = await getForegroundContext();
    const effectiveProcessName = this.resolveProcessName(fg.processName, fg.windowTitle);
    const memLoad = 1 - os.freemem() / os.totalmem();
    const cpuLoad = os.platform() === 'win32' ? null : os.loadavg()[0] / os.cpus().length;
    return {
      timestamp: now,
      processName: effectiveProcessName,
      windowTitle: fg.windowTitle,
      appId: this.buildAppId(effectiveProcessName, fg.windowTitle, fg.processId),
      isTrackerApp: this.isTrackerWindow(effectiveProcessName, fg.windowTitle),
      isFilteredOut: !this.shouldTrackApp(effectiveProcessName),
      processId: fg.processId || 0,
      idleSeconds,
      cpuLoad,
      memoryLoad: Number.isFinite(memLoad) ? Number(memLoad.toFixed(3)) : null,
      isFullscreen: null,
    };
  }

  async tick() {
    const sample = await this.collectSample();
    // 交给engine算时长，切换应用，然后更新快照
    this.latestSnapshot = this.engine.ingest(sample);
    this.emit('update', this.latestSnapshot);
  }

  start() {
    if (this.timer) return;
    void this.tick().catch((err) => {
      console.error('[time-monitor-tick]', err);
    });
    this.timer = setInterval(() => {
      void this.tick().catch(() => {
        // Keep collector resilient against transient platform command failures.
      });
    }, this.sampleIntervalMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  getSnapshot() {
    return this.latestSnapshot;
  }
}
