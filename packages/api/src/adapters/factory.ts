/**
 * Ledger store factory (layer: adapter / composition root).
 *
 * Single place that selects the LedgerStore implementation. Today it returns a
 * local-first in-memory store (optionally file-backed via LEDGER_FILE). A future
 * LEDGER_BACKEND switch will select a CRDT or cloud adapter here — with no change
 * to the domain service or the transport adapters.
 *
 * The store is a module-level singleton so in-memory state persists across requests.
 */

import type { LedgerStore } from "../ports/ledgerStore.ts";
import { LocalLedgerStore } from "./localLedgerStore.ts";

let store: LedgerStore | undefined;

export function createLedgerStore(): LedgerStore {
  if (!store) {
    store = new LocalLedgerStore(process.env.LEDGER_FILE);
  }
  return store;
}
