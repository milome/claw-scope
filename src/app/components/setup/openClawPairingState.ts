import type { GatewayErrorSummary } from "../../contexts/OpenClawContext";

export type OpenClawPairingFollowupKind =
  | "none"
  | "awaiting_host_approval"
  | "connected_without_pairing"
  | "token_mismatch"
  | "token_required"
  | "request_not_queued";

interface ResolveOpenClawPairingFollowupInput {
  pairedReady: boolean;
  pairingAttempted: boolean;
  pairingCompletionPending: boolean;
  pairingSucceededWithoutDeviceToken?: boolean;
  lastError: Pick<GatewayErrorSummary, "code" | "category"> | null;
}

interface ResolveOpenClawStartPairingTransitionInput {
  connectSucceeded: boolean;
  pairedReady: boolean;
}

interface OpenClawStartPairingTransition {
  shouldAdvanceWizard: boolean;
  pairingCompletionPending: boolean;
  pairingSucceededWithoutDeviceToken: boolean;
}

export function resolveOpenClawPairingFollowup({
  pairedReady,
  pairingAttempted,
  pairingCompletionPending,
  pairingSucceededWithoutDeviceToken = false,
  lastError,
}: ResolveOpenClawPairingFollowupInput): OpenClawPairingFollowupKind {
  if (pairedReady || pairingCompletionPending || !pairingAttempted) {
    return "none";
  }

  if (pairingSucceededWithoutDeviceToken) {
    return "connected_without_pairing";
  }

  if (!lastError) {
    return "none";
  }

  switch (lastError.code) {
    case "PAIRING_REQUIRED":
      return "awaiting_host_approval";
    case "AUTH_TOKEN_MISMATCH":
      return "token_mismatch";
    case "AUTH_TOKEN_REQUIRED":
      return "token_required";
    default:
      return "request_not_queued";
  }
}

export function shouldShowNoPendingPairingHint(
  kind: OpenClawPairingFollowupKind,
) {
  return (
    kind === "connected_without_pairing" ||
    kind === "token_mismatch" ||
    kind === "token_required" ||
    kind === "request_not_queued"
  );
}

export function resolveOpenClawStartPairingTransition({
  connectSucceeded,
  pairedReady,
}: ResolveOpenClawStartPairingTransitionInput): OpenClawStartPairingTransition {
  if (!connectSucceeded) {
    return {
      shouldAdvanceWizard: false,
      pairingCompletionPending: false,
      pairingSucceededWithoutDeviceToken: false,
    };
  }

  if (pairedReady) {
    return {
      shouldAdvanceWizard: true,
      pairingCompletionPending: true,
      pairingSucceededWithoutDeviceToken: false,
    };
  }

  return {
    shouldAdvanceWizard: false,
    pairingCompletionPending: false,
    pairingSucceededWithoutDeviceToken: true,
  };
}
