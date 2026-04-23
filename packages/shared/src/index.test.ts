import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VERSION } from './index.ts';

test('shared: VERSION is a semver-like string', () => {
  assert.ok(typeof VERSION === 'string', 'VERSION should be a string');
  assert.match(VERSION, /^\d+\.\d+\.\d+$/, 'VERSION should be semver-like');
});
