/**
 * Tool handlers — pure async functions that execute the business logic.
 *
 * These are called by BOTH:
 *   - src/mcp/adapter.ts   (when Claude calls a tool via MCP)
 *   - src/openapi/routes.ts (when ChatGPT calls a tool via HTTP POST)
 *
 * They receive validated input (already parsed by Zod), the local-first
 * LedgerStore port, and the acting user's id.
 *
 * Only add_expense is implemented on the ledger today. The other tools are
 * STUBS: they validate what they can and return empty or placeholder results
 * without persisting anything, until their slice of the local-first ledger
 * is designed (see spdd/).
 */

import { randomUUID } from "node:crypto";
import { access } from "node:fs/promises";
import { basename, extname } from "node:path";
import { pathToFileURL } from "node:url";
import type { z } from "zod";
import type {
  GetExpensesInput,
  GetExpensesOutput,
  AddExpenseInput,
  AddExpenseOutput,
  GetBalancesInput,
  GetBalancesOutput,
  SettleUpInput,
  SettleUpOutput,
  GetGroupsInput,
  GetGroupsOutput,
  AttachReceiptInput,
  AttachReceiptOutput,
  UploadReceiptFromPathInput,
  UploadReceiptFromPathOutput,
} from "./schemas.ts";
import type { LedgerStore } from "../ports/ledgerStore.ts";
import { RecordExpenseService } from "../domain/recordExpense.ts";

const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".pdf": "application/pdf",
  ".webp": "image/webp",
  ".heic": "image/heic",
};

type In<T extends z.ZodType> = z.infer<T>;
type Out<T extends z.ZodType> = z.infer<T>;

/**
 * Shape of a tool handler for the MCP/OpenAPI dispatch tables. Handlers have
 * heterogeneous input types, so the dispatch signature is intentionally loose;
 * inputs are already Zod-validated before a handler is invoked.
 */
// biome-ignore lint/suspicious/noExplicitAny: dynamic dispatch over handlers with differing input types
export type ToolHandler = (...args: any[]) => Promise<unknown>;

// ── get_expenses (STUB) ───────────────────────────────────────────────────

export async function getExpenses(
  _input: In<typeof GetExpensesInput>,
  _store: LedgerStore,
  _userId: string
): Promise<Out<typeof GetExpensesOutput>> {
  return { expenses: [], total_count: 0, you_owe: 0, you_lent: 0 };
}

// ── add_expense ───────────────────────────────────────────────────────────

export async function addExpense(
  input: In<typeof AddExpenseInput>,
  store: LedgerStore,
  userId: string
): Promise<Out<typeof AddExpenseOutput>> {
  return new RecordExpenseService(store).record(input, userId);
}

// ── get_balances (STUB) ───────────────────────────────────────────────────

export async function getBalances(
  _input: In<typeof GetBalancesInput>,
  _store: LedgerStore,
  _userId: string
): Promise<Out<typeof GetBalancesOutput>> {
  return { balances: [], your_net: 0, currency: "CAD" };
}

// ── settle_up (STUB) ──────────────────────────────────────────────────────

export async function settleUp(
  input: In<typeof SettleUpInput>,
  _store: LedgerStore,
  _userId: string
): Promise<Out<typeof SettleUpOutput>> {
  return {
    settlement_id: randomUUID(),
    message: `Settled $${input.amount.toFixed(2)} ${input.currency} (stub — not yet recorded on the local ledger).`,
  };
}

// ── get_groups (STUB) ─────────────────────────────────────────────────────

export async function getGroups(
  _input: In<typeof GetGroupsInput>,
  _store: LedgerStore,
  _userId: string
): Promise<Out<typeof GetGroupsOutput>> {
  return { groups: [] };
}

// ── attach_receipt (STUB) ─────────────────────────────────────────────────

export async function attachReceipt(
  input: In<typeof AttachReceiptInput>,
  _store: LedgerStore,
  _userId: string
): Promise<Out<typeof AttachReceiptOutput>> {
  const embedUrl = input.provider === "google_drive" ? toDriveEmbedUrl(input.url) : input.url;
  return {
    receipt_id: randomUUID(),
    embed_url: embedUrl,
    message: `Receipt link accepted (stub — not yet stored on the local ledger). Preview: ${embedUrl}`,
  };
}

/**
 * https://drive.google.com/file/d/FILE_ID/view → https://drive.google.com/file/d/FILE_ID/preview
 * Returns the original URL if it is not a Drive file link.
 */
function toDriveEmbedUrl(url: string): string {
  try {
    const segments = new URL(url).pathname.split("/");
    const fileIdx = segments.indexOf("d");
    if (fileIdx === -1) return url;
    return `https://drive.google.com/file/d/${segments[fileIdx + 1]}/preview`;
  } catch {
    return url;
  }
}

// ── upload_receipt_from_path (MCP / Claude Desktop only, STUB) ───────────────
// Receipts stay on the user's device: the file is referenced in place by a
// file:// URL rather than uploaded anywhere.

export async function uploadReceiptFromPath(
  input: In<typeof UploadReceiptFromPathInput>,
  _store: LedgerStore,
  _userId: string
): Promise<Out<typeof UploadReceiptFromPathOutput>> {
  const filename = basename(input.file_path);
  const ext = extname(input.file_path).toLowerCase();
  if (!MIME_TYPES[ext]) {
    throw new Error(
      `Unsupported file type "${ext}". Allowed: ${Object.keys(MIME_TYPES).join(", ")}`
    );
  }

  try {
    await access(input.file_path);
  } catch (err) {
    throw new Error(
      `Cannot read file "${input.file_path}": ${err instanceof Error ? err.message : String(err)}`
    );
  }

  const url = pathToFileURL(input.file_path).href;
  return {
    receipt_id: randomUUID(),
    url,
    message: `Receipt "${filename}" referenced at ${url} (stub — not yet stored on the local ledger).`,
  };
}
