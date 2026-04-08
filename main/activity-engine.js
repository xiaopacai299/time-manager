import { debugLog } from './debug-log.js';

function toDayKey(timestamp) {
  return new Date(timestamp).toLocaleDateString('sv-SE');
}

function ensureAppBucket(map, appId, processName, windowTitle) {
  if (!map[appId]) {
    map[appId] = {
      appId,
      processName,
      windowTitle,
      durationMs: 0,
    };
  }
}

export class ActivityEngine {
  constructor({ breakThresholdSeconds = 300, transitionHistoryLimit = 30 } = {}) {
    this.breakThresholdSeconds = breakThresholdSeconds;
    this.transitionHistoryLimit = transitionHistoryLimit;
    this.reset();
  }

  reset(dayKey = toDayKey(Date.now())) {
    this.dayKey = dayKey;
    this.perAppToday = {};
    this.transitions = [];
    this.breakCompletedMs = 0;
    this.currentSession = null;
    this.isOnBreak = false;
    this.continuousStartTs = null;
    this.lastTimestamp = null;
  }

  rolloverIfNeeded(timestamp) {
    const nextKey = toDayKey(timestamp);
    if (this.dayKey !== nextKey) {
      this.reset(nextKey);
    }
  }

  ingest(sample) {
    const timestamp = sample.timestamp;
    this.rolloverIfNeeded(timestamp);
    const isTrackerApp = Boolean(sample.isTrackerApp);
    const isFilteredOut = Boolean(sample.isFilteredOut);

    if (!this.currentSession) {
      if (!isTrackerApp && !isFilteredOut) {
        this.currentSession = {
          appId: sample.appId,
          processName: sample.processName,
          windowTitle: sample.windowTitle,
          processId: sample.processId || 0,
          enteredAt: timestamp,
        };
        ensureAppBucket(
          this.perAppToday,
          this.currentSession.appId,
          this.currentSession.processName,
          this.currentSession.windowTitle,
        );
      }
      this.continuousStartTs =
        !isTrackerApp && !isFilteredOut && sample.idleSeconds < this.breakThresholdSeconds
          ? timestamp
          : null;
      this.isOnBreak = sample.idleSeconds >= this.breakThresholdSeconds;
      this.lastTimestamp = timestamp;
      return this.getSnapshot(sample);
    }

    const deltaMs = Math.max(0, timestamp - (this.lastTimestamp ?? timestamp));
    const nowOnBreak = sample.idleSeconds >= this.breakThresholdSeconds;
    const shouldPauseTracking = nowOnBreak || isTrackerApp || isFilteredOut;

    if (nowOnBreak) {
      this.breakCompletedMs += deltaMs;
      this.continuousStartTs = null;
    } else if (isTrackerApp || isFilteredOut) {
      this.continuousStartTs = null;
    } else if (!this.continuousStartTs) {
      this.continuousStartTs = timestamp;
    }

    if (!shouldPauseTracking && this.currentSession?.appId) {
      ensureAppBucket(
        this.perAppToday,
        this.currentSession.appId,
        this.currentSession.processName,
        this.currentSession.windowTitle,
      );
      this.perAppToday[this.currentSession.appId].windowTitle = this.currentSession.windowTitle;
      this.perAppToday[this.currentSession.appId].durationMs += deltaMs;
    }

    const hasAppSwitch = !isTrackerApp && !isFilteredOut && sample.appId !== this.currentSession.appId;

    if (hasAppSwitch) {
      this.transitions.push({
        fromAppId: this.currentSession.appId,
        toAppId: sample.appId,
        leftAt: timestamp,
        enteredAt: timestamp,
      });
      debugLog('历史记录添加了', this.transitions);
      if (this.transitions.length > this.transitionHistoryLimit) {
        this.transitions.shift();
      }

      this.currentSession = {
        appId: sample.appId,
        processName: sample.processName,
        windowTitle: sample.windowTitle,
        processId: sample.processId || 0,
        enteredAt: timestamp,
      };
      ensureAppBucket(
        this.perAppToday,
        this.currentSession.appId,
        this.currentSession.processName,
        this.currentSession.windowTitle,
      );
    } else if (!isTrackerApp && !isFilteredOut) {
      this.currentSession = {
        ...this.currentSession,
        processName: sample.processName,
        windowTitle: sample.windowTitle,
        processId: sample.processId || this.currentSession.processId || 0,
      };
    }

    this.isOnBreak = shouldPauseTracking;
    this.lastTimestamp = timestamp;
    return this.getSnapshot(sample);
  }

  getSnapshot(sample) {
    const now = sample?.timestamp ?? this.lastTimestamp ?? Date.now();
    const continuousUseMs =
      this.continuousStartTs && !this.isOnBreak ? Math.max(0, now - this.continuousStartTs) : 0;

    return {
      timestamp: now,
      dayKey: this.dayKey,
      current: {
        appId: this.currentSession?.appId ?? 'Unknown',
        processName: this.currentSession?.processName ?? 'Unknown',
        windowTitle: this.currentSession?.windowTitle ?? 'Unknown',
        enteredAt: this.currentSession?.enteredAt ?? now,
        idleSeconds: sample?.idleSeconds ?? 0,
        isOnBreak: this.isOnBreak,
      },
      perAppToday: Object.values(this.perAppToday).sort((a, b) => b.durationMs - a.durationMs),
      continuousUseMs,
      breakCompletedMs: this.breakCompletedMs,
      transitions: this.transitions,
      optionalMetrics: {
        cpuLoad: sample?.cpuLoad ?? null,
        memoryLoad: sample?.memoryLoad ?? null,
        isFullscreen: sample?.isFullscreen ?? null,
      },
    };
  }
}
