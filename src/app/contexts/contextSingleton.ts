export function getSingletonValue<T>(key: string, factory: () => T): T {
  const globalStore = globalThis as typeof globalThis & Record<string, unknown>;
  const existing = globalStore[key] as T | undefined;

  if (existing) {
    return existing;
  }

  const created = factory();
  globalStore[key] = created;
  return created;
}
