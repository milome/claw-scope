export type AuthMode = 'paired_device' | 'token' | 'password';

export const OPENCLAW_STORAGE_KEYS = {
  configured: 'oc_configured',
  skipped: 'oc_skipped',
  url: 'oc_url',
  authMode: 'oc_auth_mode',
  authSecret: 'oc_auth_secret',
} as const;

type StorageReader = Pick<Storage, 'getItem'>;

export function readStoredAuthMode(storage: StorageReader): AuthMode {
  const value = storage.getItem(OPENCLAW_STORAGE_KEYS.authMode);
  if (value === 'paired_device' || value === 'token' || value === 'password') {
    return value;
  }

  if (value === 'none') {
    return 'paired_device';
  }

  return 'paired_device';
}

export function readStoredAuthSecret(storage: StorageReader): string {
  const mode = storage.getItem(OPENCLAW_STORAGE_KEYS.authMode);
  if (mode === 'token' || mode === 'password' || mode === 'paired_device') {
    return storage.getItem(OPENCLAW_STORAGE_KEYS.authSecret) || '';
  }

  return '';
}

export function normalizeAuthSecret(_mode: AuthMode, secret: string): string | null {
  const trimmedSecret = secret.trim();
  return trimmedSecret.length > 0 ? trimmedSecret : null;
}
