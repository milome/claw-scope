import { describe, expect, it } from 'vitest';

import { getSingletonValue } from './contextSingleton';

describe('getSingletonValue', () => {
  it('returns the same instance for the same key', () => {
    const first = getSingletonValue('__test_singleton_context__', () => ({ id: 1 }));
    const second = getSingletonValue('__test_singleton_context__', () => ({ id: 2 }));

    expect(second).toBe(first);
    expect(second).toEqual({ id: 1 });
  });

  it('returns different instances for different keys', () => {
    const first = getSingletonValue('__test_singleton_context_a__', () => ({ id: 'a' }));
    const second = getSingletonValue('__test_singleton_context_b__', () => ({ id: 'b' }));

    expect(first).not.toBe(second);
    expect(first).toEqual({ id: 'a' });
    expect(second).toEqual({ id: 'b' });
  });
});
