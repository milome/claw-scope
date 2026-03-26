// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';

import {
  OPENCLAW_STORAGE_KEYS,
  normalizeAuthSecret,
  readStoredAuthMode,
  readStoredAuthSecret,
} from './openClawStorage';

describe('openClawStorage migration', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('maps legacy none auth mode to paired_device', () => {
    localStorage.setItem(OPENCLAW_STORAGE_KEYS.authMode, 'none');

    expect(readStoredAuthMode(localStorage)).toBe('paired_device');
  });

  it('drops stale auth secret when legacy none mode is loaded', () => {
    localStorage.setItem(OPENCLAW_STORAGE_KEYS.authMode, 'none');
    localStorage.setItem(OPENCLAW_STORAGE_KEYS.authSecret, 'legacy-token');

    expect(readStoredAuthSecret(localStorage)).toBe('');
  });

  it('restores token secret when token mode is selected', () => {
    localStorage.setItem(OPENCLAW_STORAGE_KEYS.authMode, 'token');
    localStorage.setItem(OPENCLAW_STORAGE_KEYS.authSecret, 'gateway-token');

    expect(readStoredAuthSecret(localStorage)).toBe('gateway-token');
  });

  it('restores password secret when password mode is selected', () => {
    localStorage.setItem(OPENCLAW_STORAGE_KEYS.authMode, 'password');
    localStorage.setItem(OPENCLAW_STORAGE_KEYS.authSecret, 'gateway-password');

    expect(readStoredAuthSecret(localStorage)).toBe('gateway-password');
  });

  it('normalizes paired_device secret to null', () => {
    expect(normalizeAuthSecret('paired_device', '  should-be-ignored  ')).toBeNull();
  });
});
