"use client";

import { useMintStore } from "./mintStore";
import { usePolicyStore } from "./policyStore";
import { useVaultStore } from "./vaultStore";

let bound = false;

/**
 * Wire cross-store reactions once at app boot:
 * - vault summary change → sync policy drafts + mint asset selection
 */
export function bindAdminStores(): void {
  if (bound) return;
  bound = true;

  useVaultStore.subscribe((state, prev) => {
    if (state.summary === prev.summary) return;
    usePolicyStore.getState().syncFromSummary(state.summary);
    useMintStore.getState().syncFromSummary(state.summary);
  });
}

export function bootstrapAdminStores(): void {
  bindAdminStores();
  void useVaultStore.getState().hydrate();
}
