import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  isExcludedStatsAppKey,
  isExcludedStatsAppName,
  resolvePerAppDisplayName,
  shouldExcludePerAppTodayItem,
} from './stats-app-name.js';

test('isExcludedStatsAppName matches unknown case-insensitively', () => {
  assert.equal(isExcludedStatsAppName('UNKNOWN'), true);
  assert.equal(isExcludedStatsAppName('unknown'), true);
  assert.equal(isExcludedStatsAppName('Unknown'), true);
  assert.equal(isExcludedStatsAppName(' VS Code '), false);
});

test('isExcludedStatsAppKey matches unknown buckets', () => {
  assert.equal(isExcludedStatsAppKey('unknown'), true);
  assert.equal(isExcludedStatsAppKey('unknown::notepad'), true);
  assert.equal(isExcludedStatsAppKey('chrome'), false);
});

test('shouldExcludePerAppTodayItem uses display name from title', () => {
  assert.equal(
    shouldExcludePerAppTodayItem({
      appId: 'pid::99',
      processName: 'powershell',
      windowTitle: 'foo - UNKNOWN',
    }),
    true,
  );
  assert.equal(
    shouldExcludePerAppTodayItem({
      appId: 'chrome',
      processName: 'chrome',
      windowTitle: 'Page - Google',
    }),
    false,
  );
});

test('resolvePerAppDisplayName picks suffix after dash', () => {
  assert.equal(resolvePerAppDisplayName({ windowTitle: 'a - b - Chrome' }), 'Chrome');
});
