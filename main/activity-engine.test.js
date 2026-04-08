import test from 'node:test';
import assert from 'node:assert/strict';
import { ActivityEngine } from './activity-engine.js';

function sample({ t, appId = 'A', processName = 'AppA', idleSeconds = 0 }) {
  return {
    timestamp: t,
    appId,
    processName,
    windowTitle: appId,
    idleSeconds,
    cpuLoad: null,
    memoryLoad: null,
    isFullscreen: null,
  };
}

test('accumulates per-app duration and transition', () => {
  const engine = new ActivityEngine({ breakThresholdSeconds: 300 });
  engine.ingest(sample({ t: 1000, appId: 'A' }));
  engine.ingest(sample({ t: 3000, appId: 'A' }));
  const out = engine.ingest(sample({ t: 5000, appId: 'B', processName: 'AppB' }));

  const appA = out.perAppToday.find((x) => x.appId === 'A');
  assert.equal(appA.durationMs, 4000);
  assert.equal(out.transitions.length, 1);
  assert.equal(out.transitions[0].fromAppId, 'A');
  assert.equal(out.transitions[0].toAppId, 'B');
});

test('counts breakCompletedMs when idle above threshold', () => {
  const engine = new ActivityEngine({ breakThresholdSeconds: 300 });
  engine.ingest(sample({ t: 1000, idleSeconds: 0 }));
  engine.ingest(sample({ t: 6000, idleSeconds: 301 }));
  const out = engine.ingest(sample({ t: 11000, idleSeconds: 302 }));
  assert.equal(out.breakCompletedMs, 10000);
  assert.equal(out.continuousUseMs, 0);
});

test('resets day aggregates on day rollover', () => {
  const engine = new ActivityEngine({ breakThresholdSeconds: 300 });
  engine.reset('1999-01-01');
  const now = Date.now();
  const out = engine.ingest(sample({ t: now, appId: 'A' }));
  assert.equal(out.perAppToday.length, 1);
  assert.ok(out.dayKey.length > 0);
  assert.notEqual(out.dayKey, '1999-01-01');
});
