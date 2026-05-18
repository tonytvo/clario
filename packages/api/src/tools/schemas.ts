/**
 * Shared schemas — defined once with Zod, consumed by both:
 *   - MCP adapter (tool inputSchema)
 *   - OpenAPI adapter (request body validation + JSON schema generation)
 *
 * This is the key architectural decision: write the schema ONCE,
 * and let each adapter derive what it needs from it.
 */

import { z } from "zod";

// ── Primitive reusables ────────────────────────────────────────────────────

export const UUID = z.string().uuid();

export const Currency = z.string().length(3).default("CAD");

export const Category = z.enum([
  "Groceries",
  "Dining",
  "Utilities",
  "Transport",
  "Travel",
  "Entertainment",
  "Health",
  "Rent",
  "Other",
]);

export const SortOrder = z.enum(["asc", "desc"]).default("desc");

// ── get_expenses ──────────────────────────────────────────────────────────

export const GetExpensesInput = z.object({
  group_id: UUID.optional().describe(
    "Filter by group. Omit to query all groups the user belongs to."
  ),
  paid_by_me: z.boolean().optional().describe(
    "If true, return only expenses the authenticated user paid."
  ),
  settled: z.boolean().optional().describe(
    "Filter by settlement status. Omit to return both."
  ),
  has_receipt: z.boolean().optional().describe(
    "Filter to expenses that have (or lack) a receipt link."
  ),
  category: Category.optional().describe("Filter by expense category."),
  sort_by: z.enum(["date", "amount"]).default("date"),
  sort_order: SortOrder,
  limit: z.number().int().min(1).max(100).default(50),
});

export const ExpenseRow = z.object({
  id: UUID,
  title: z.string(),
  amount: z.number(),
  currency: z.string(),
  category: z.string().nullable(),
  paid_by_name: z.string(),
  date: z.string(),
  group_name: z.string(),
  my_share: z.number(),
  i_paid: z.boolean(),
  settled: z.boolean(),
  receipt_count: z.number().int(),
});

export const GetExpensesOutput = z.object({
  expenses: z.array(ExpenseRow),
  total_count: z.number().int(),
  you_owe: z.number().describe("Total you owe across filtered results."),
  you_lent: z.number().describe("Total others owe you across filtered results."),
});

// ── add_expense ───────────────────────────────────────────────────────────

export const AddExpenseInput = z.object({
  group_id: UUID.describe("The group this expense belongs to."),
  title: z.string().min(1).max(200).describe("Short description, e.g. 'Grocery run'."),
  amount: z.number().positive().describe("Total expense amount."),
  currency: Currency,
  category: Category.default("Other"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe(
    "ISO date (YYYY-MM-DD). Defaults to today."
  ),
  split_with: z.array(UUID).min(1).describe(
    "User IDs to split with (including yourself). Equal split assumed unless amounts provided."
  ),
  split_amounts: z.record(UUID, z.number().positive()).optional().describe(
    "Optional: custom split amounts keyed by user_id. Must sum to total amount."
  ),
  notes: z.string().max(1000).optional(),
});

export const AddExpenseOutput = z.object({
  expense_id: UUID,
  message: z.string(),
  splits: z.array(z.object({
    user_id: UUID,
    user_name: z.string(),
    amount: z.number(),
  })),
});

// ── get_balances ──────────────────────────────────────────────────────────

export const GetBalancesInput = z.object({
  group_id: UUID.optional().describe(
    "Get balances for a specific group. Omit for overall balance across all groups."
  ),
});

export const BalanceEntry = z.object({
  user_id: UUID,
  user_name: z.string(),
  net: z.number().describe("Positive = they owe you. Negative = you owe them."),
  currency: z.string(),
});

export const GetBalancesOutput = z.object({
  balances: z.array(BalanceEntry),
  your_net: z.number().describe("Your overall net. Positive = you are owed money."),
  currency: z.string(),
});

// ── settle_up ─────────────────────────────────────────────────────────────

export const SettleUpInput = z.object({
  group_id: UUID,
  to_user_id: UUID.describe("The user you are paying."),
  amount: z.number().positive().describe("Amount being settled."),
  currency: Currency,
  note: z.string().max(500).optional(),
});

export const SettleUpOutput = z.object({
  settlement_id: UUID,
  message: z.string(),
});

// ── get_groups ────────────────────────────────────────────────────────────

export const GetGroupsInput = z.object({}).describe("No parameters — returns all groups.");

export const GroupRow = z.object({
  id: UUID,
  name: z.string(),
  member_count: z.number().int(),
  your_balance: z.number(),
  currency: z.string(),
});

export const GetGroupsOutput = z.object({
  groups: z.array(GroupRow),
});

// ── attach_receipt ────────────────────────────────────────────────────────

export const AttachReceiptInput = z.object({
  expense_id: UUID,
  url: z.string().url().describe(
    "Google Drive or Dropbox shareable link. The file stays in the user's cloud storage — we only store this URL."
  ),
  filename: z.string().max(255).optional(),
  provider: z.enum(["google_drive", "dropbox", "url"]).default("url"),
});

export const AttachReceiptOutput = z.object({
  receipt_id: UUID,
  embed_url: z.string().url().describe("Preview URL suitable for iframe embedding."),
  message: z.string(),
});

// ── upload_receipt_from_path ──────────────────────────────────────────────────
// MCP-only (not in TOOL_REGISTRY — only registered in the MCP adapter).
// Claude Desktop reads the file from disk and uploads it to Supabase Storage,
// then stores only the resulting URL in the DB.

export const UploadReceiptFromPathInput = z.object({
  expense_id: UUID,
  file_path: z.string().describe(
    "Absolute path to the receipt file on the local machine. Supports JPEG, PNG, PDF, WebP."
  ),
});

export const UploadReceiptFromPathOutput = z.object({
  receipt_id: UUID,
  url: z.string().url().describe("Public URL of the uploaded receipt in Supabase Storage."),
  message: z.string(),
});

// ── Tool registry ─────────────────────────────────────────────────────────
// Single place to enumerate all tools. Both adapters iterate this.

export const TOOL_REGISTRY = [
  {
    name: "get_expenses",
    description:
      "Query and filter expenses. Returns a structured table with amounts, splits, settlement status, and receipt flags. Supports filtering by group, who paid, category, settlement status, and sorting.",
    inputSchema: GetExpensesInput,
    outputSchema: GetExpensesOutput,
  },
  {
    name: "add_expense",
    description:
      "Add a new expense to a group and split it among members. Supports equal splits or custom amounts per person.",
    inputSchema: AddExpenseInput,
    outputSchema: AddExpenseOutput,
  },
  {
    name: "get_balances",
    description:
      "Get who owes what. Returns net balances per person — positive means they owe you, negative means you owe them.",
    inputSchema: GetBalancesInput,
    outputSchema: GetBalancesOutput,
  },
  {
    name: "settle_up",
    description:
      "Record a payment between two group members, marking their shared splits as settled.",
    inputSchema: SettleUpInput,
    outputSchema: SettleUpOutput,
  },
  {
    name: "get_groups",
    description:
      "List all expense groups the authenticated user belongs to, with member counts and balances.",
    inputSchema: GetGroupsInput,
    outputSchema: GetGroupsOutput,
  },
  {
    name: "attach_receipt",
    description:
      "Attach a Google Drive or Dropbox link to an expense. The file stays in the user's own cloud storage — Clario only stores the URL.",
    inputSchema: AttachReceiptInput,
    outputSchema: AttachReceiptOutput,
  },
] as const;

export type ToolName = typeof TOOL_REGISTRY[number]["name"];
