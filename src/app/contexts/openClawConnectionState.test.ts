import { describe, expect, it } from 'vitest';

import { shouldShowSkippedConnectionReminder } from './openClawConnectionState';

describe('shouldShowSkippedConnectionReminder', () => {
  it('returns false before startup hydration completes', () => {
    expect(
      shouldShowSkippedConnectionReminder({
        hasSkippedSetup: true,
        isConfigured: false,
        isSetupWizardOpen: false,
        isConnected: false,
        hasHydratedGatewayState: false,
      }),
    ).toBe(false);
  });

  it('returns false when connection recovery already succeeded', () => {
    expect(
      shouldShowSkippedConnectionReminder({
        hasSkippedSetup: true,
        isConfigured: false,
        isSetupWizardOpen: false,
        isConnected: true,
        hasHydratedGatewayState: true,
      }),
    ).toBe(false);
  });

  it('returns true only for skipped and still-disconnected users after hydration', () => {
    expect(
      shouldShowSkippedConnectionReminder({
        hasSkippedSetup: true,
        isConfigured: false,
        isSetupWizardOpen: false,
        isConnected: false,
        hasHydratedGatewayState: true,
      }),
    ).toBe(true);
  });
});
