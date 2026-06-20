// Domain types — mirrored from packages/api/src/tools/schemas.ts (Zod source of truth).
// Keep in sync manually until we add a codegen step.

export type Category =
  | "Groceries"
  | "Dining"
  | "Utilities"
  | "Transport"
  | "Travel"
  | "Entertainment"
  | "Health"
  | "Rent"
  | "Other";

// ── Expenses ──────────────────────────────────────────────────────────────────

export type ExpenseRow = {
  id: string;
  title: string;
  amount: number;
  currency: string;
  category: string | null;
  paid_by_name: string;
  date: string;
  group_name: string;
  my_share: number;
  i_paid: boolean;
  settled: boolean;
  receipt_count: number;
};

export type AddExpenseInput = {
  group_id: string;
  title: string;
  amount: number;
  currency: string;
  category: Category;
  date?: string;
  split_with: string[];
  split_amounts?: Record<string, number>;
  notes?: string;
};

export type AddExpenseSplit = {
  user_id: string;
  user_name: string;
  amount: number;
};

export type AddExpenseOutput = {
  expense_id: string;
  message: string;
  splits: AddExpenseSplit[];
};

// ── Groups ────────────────────────────────────────────────────────────────────

export type GroupRow = {
  id: string;
  name: string;
  member_count: number;
  your_balance: number;
  currency: string;
};

export type GetGroupsOutput = {
  groups: GroupRow[];
};

// ── Balances ──────────────────────────────────────────────────────────────────

export type BalanceEntry = {
  user_id: string;
  user_name: string;
  net: number;
  currency: string;
};

export type GetBalancesOutput = {
  balances: BalanceEntry[];
  your_net: number;
  currency: string;
};
