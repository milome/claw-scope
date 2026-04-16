import { describe, expect, it } from "vitest";

import {
  resolveOpenClawPairingFollowup,
  resolveOpenClawStartPairingTransition,
  shouldShowNoPendingPairingHint,
} from "./openClawPairingState";

describe("openClawPairingState", () => {
  it("returns none before a pairing attempt is made", () => {
    expect(
      resolveOpenClawPairingFollowup({
        pairedReady: false,
        pairingAttempted: false,
        pairingCompletionPending: false,
        lastError: { code: "PAIRING_REQUIRED", category: "pairing" },
      }),
    ).toBe("none");
  });

  it("returns awaiting_host_approval when pairing is pending host approval", () => {
    expect(
      resolveOpenClawPairingFollowup({
        pairedReady: false,
        pairingAttempted: true,
        pairingCompletionPending: false,
        lastError: { code: "PAIRING_REQUIRED", category: "pairing" },
      }),
    ).toBe("awaiting_host_approval");
  });

  it("returns token_mismatch when the bootstrap token is rejected", () => {
    expect(
      resolveOpenClawPairingFollowup({
        pairedReady: false,
        pairingAttempted: true,
        pairingCompletionPending: false,
        lastError: { code: "AUTH_TOKEN_MISMATCH", category: "auth" },
      }),
    ).toBe("token_mismatch");
  });

  it("returns token_required when the bootstrap token is missing", () => {
    expect(
      resolveOpenClawPairingFollowup({
        pairedReady: false,
        pairingAttempted: true,
        pairingCompletionPending: false,
        lastError: { code: "AUTH_TOKEN_REQUIRED", category: "auth" },
      }),
    ).toBe("token_required");
  });

  it("treats other failures as request_not_queued", () => {
    expect(
      resolveOpenClawPairingFollowup({
        pairedReady: false,
        pairingAttempted: true,
        pairingCompletionPending: false,
        lastError: { code: "SOCKET_ERROR", category: "transport" },
      }),
    ).toBe("request_not_queued");
  });

  it("suppresses follow-up prompts once device token persistence is pending", () => {
    expect(
      resolveOpenClawPairingFollowup({
        pairedReady: false,
        pairingAttempted: true,
        pairingCompletionPending: true,
        lastError: { code: "PAIRING_REQUIRED", category: "pairing" },
      }),
    ).toBe("none");
  });

  it("returns connected_without_pairing when start pairing only establishes a shared-token connection", () => {
    expect(
      resolveOpenClawPairingFollowup({
        pairedReady: false,
        pairingAttempted: true,
        pairingCompletionPending: false,
        pairingSucceededWithoutDeviceToken: true,
        lastError: null,
      }),
    ).toBe("connected_without_pairing");
  });

  it("marks only non-approval failures as no-pending-pairing hints", () => {
    expect(shouldShowNoPendingPairingHint("none")).toBe(false);
    expect(shouldShowNoPendingPairingHint("awaiting_host_approval")).toBe(false);
    expect(shouldShowNoPendingPairingHint("connected_without_pairing")).toBe(true);
    expect(shouldShowNoPendingPairingHint("token_mismatch")).toBe(true);
    expect(shouldShowNoPendingPairingHint("token_required")).toBe(true);
    expect(shouldShowNoPendingPairingHint("request_not_queued")).toBe(true);
  });

  it("keeps the wizard on the pairing step when start pairing succeeds without device token issuance", () => {
    expect(
      resolveOpenClawStartPairingTransition({
        connectSucceeded: true,
        pairedReady: false,
      }),
    ).toEqual({
      shouldAdvanceWizard: false,
      pairingCompletionPending: false,
      pairingSucceededWithoutDeviceToken: true,
    });
  });

  it("advances the wizard only when start pairing actually finishes and device token is ready", () => {
    expect(
      resolveOpenClawStartPairingTransition({
        connectSucceeded: true,
        pairedReady: true,
      }),
    ).toEqual({
      shouldAdvanceWizard: true,
      pairingCompletionPending: true,
      pairingSucceededWithoutDeviceToken: false,
    });
  });
});
