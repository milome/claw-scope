export interface SkippedReminderGateInput {
  hasSkippedSetup: boolean;
  isConfigured: boolean;
  isSetupWizardOpen: boolean;
  isConnected: boolean;
  hasHydratedGatewayState: boolean;
}

export function shouldShowSkippedConnectionReminder(
  input: SkippedReminderGateInput,
) {
  return (
    input.hasHydratedGatewayState &&
    input.hasSkippedSetup &&
    !input.isConfigured &&
    !input.isSetupWizardOpen &&
    !input.isConnected
  );
}
