import { describe, expect, it } from 'vitest';

import {
  isLoopbackGatewayUrl,
  shouldRetryWithPairedDeviceOnLocalGateway,
} from './openClawConnectionPolicy';

describe('openClawConnectionPolicy', () => {
  it('recognizes loopback gateway urls', () => {
    expect(isLoopbackGatewayUrl('http://127.0.0.1:18789')).toBe(true);
    expect(isLoopbackGatewayUrl('http://localhost:18789')).toBe(true);
    expect(isLoopbackGatewayUrl('http://[::1]:18789')).toBe(true);
  });

  it('rejects non-loopback gateway urls', () => {
    expect(isLoopbackGatewayUrl('http://192.168.1.23:18789')).toBe(false);
    expect(isLoopbackGatewayUrl('not-a-url')).toBe(false);
  });

  it('retries local token auth mismatches with paired device mode', () => {
    expect(
      shouldRetryWithPairedDeviceOnLocalGateway('http://127.0.0.1:18789', 'token', {
        code: 'AUTH_TOKEN_MISMATCH',
        category: 'auth',
      }),
    ).toBe(true);
  });

  it('retries local pairing failures with paired device mode', () => {
    expect(
      shouldRetryWithPairedDeviceOnLocalGateway('http://localhost:18789', 'password', {
        category: 'pairing',
      }),
    ).toBe(true);
  });

  it('does not retry remote or already paired connections', () => {
    expect(
      shouldRetryWithPairedDeviceOnLocalGateway('http://192.168.1.23:18789', 'token', {
        code: 'AUTH_TOKEN_MISMATCH',
        category: 'auth',
      }),
    ).toBe(false);
    expect(
      shouldRetryWithPairedDeviceOnLocalGateway('http://127.0.0.1:18789', 'paired_device', {
        code: 'PAIRING_REQUIRED',
        category: 'pairing',
      }),
    ).toBe(false);
  });
});
