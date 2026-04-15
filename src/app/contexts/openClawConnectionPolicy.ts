import type { AuthMode } from './openClawStorage';

export interface GatewayErrorLike {
  category?: string | null;
  code?: string | null;
}

export interface GatewayConnectionSnapshotLike {
  isPaired?: boolean | null;
}

const LOCAL_GATEWAY_AUTH_FALLBACK_CODES = new Set([
  'PAIRING_REQUIRED',
  'AUTH_TOKEN_MISMATCH',
  'AUTH_PASSWORD_MISMATCH',
  'AUTH_DEVICE_TOKEN_MISMATCH',
]);

const LOCAL_GATEWAY_AUTH_FALLBACK_CATEGORIES = new Set(['auth', 'pairing']);

export function isLoopbackGatewayUrl(url: string) {
  try {
    const parsed = new URL(url.trim());
    const normalizedHost = parsed.hostname.trim().toLowerCase();
    return (
      normalizedHost === 'localhost' ||
      normalizedHost === '127.0.0.1' ||
      normalizedHost === '::1' ||
      normalizedHost === '[::1]'
    );
  } catch {
    return false;
  }
}

export function shouldRetryWithPairedDeviceOnLocalGateway(
  url: string,
  mode: AuthMode,
  error?: GatewayErrorLike | null,
) {
  if (mode === 'paired_device' || !isLoopbackGatewayUrl(url) || !error) {
    return false;
  }

  if (error.code && LOCAL_GATEWAY_AUTH_FALLBACK_CODES.has(error.code)) {
    return true;
  }

  return Boolean(error.category && LOCAL_GATEWAY_AUTH_FALLBACK_CATEGORIES.has(error.category));
}

export function resolvePersistedAuthModeAfterConnect(
  url: string,
  requestedMode: AuthMode,
  requestedSecret: string,
  snapshot?: GatewayConnectionSnapshotLike | null,
) {
  if (isLoopbackGatewayUrl(url) && requestedMode !== 'paired_device' && snapshot?.isPaired) {
    return {
      mode: 'paired_device' as const,
      secret: '',
    };
  }

  return {
    mode: requestedMode,
    secret: requestedMode === 'paired_device' ? '' : requestedSecret,
  };
}
