/**
 * Tool handlers — pure async functions that execute the business logic.
 *
 * These are called by BOTH:
 *   - src/mcp/adapter.ts   (when Claude calls a tool via MCP)
 *   - src/openapi/routes.ts (when ChatGPT calls a tool via HTTP POST)
 *
 * They receive validated input (already parsed by Zod) and a Supabase client
 * scoped to the authenticated user.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
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
} from "./schemas.ts";

type In<T extends z.ZodType> = z.infer<T>;
type Out<T extends z.ZodType> = z.infer<T>;

// ── get_expenses ──────────────────────────────────────────────────────────

export async function getExpenses(
  input: In<typeof GetExpensesInput>,
  supabase: SupabaseClient,
  userId: string
): Promise<Out<typeof GetExpensesOutput>> {
  let query = supabase
    .from("expenses")
    .select(`
      id, title, amount, currency, category, date, notes,
      paid_by:profiles!expenses_paid_by_fkey(id, display_name),
      groups(id, name),
      expense_splits!inner(user_id, amount, settled),
      receipt_links(id)
    `)
    .eq("expense_splits.user_id", userId)
    .order(input.sort_by, { ascending: input.sort_order === "asc" })
    .limit(input.limit);

  if (input.group_id) query = query.eq("group_id", input.group_id);
  if (input.category) query = query.eq("category", input.category);
  if (input.settled !== undefined)
    query = query.eq("expense_splits.settled", input.settled);
  if (input.has_receipt !== undefined) {
    query = input.has_receipt
      ? query.not("receipt_links", "is", null)
      : query.is("receipt_links", null);
  }

  const { data, error } = await query;
  if (error) throw new Error(`DB error: ${error.message}`);

  const expenses = (data ?? []).map((row: any) => {
    const mySlip = row.expense_splits.find((s: any) => s.user_id === userId);
    const iPaid = row.paid_by.id === userId;
    const filteredByPaidByMe =
      input.paid_by_me === undefined || input.paid_by_me === iPaid;

    if (!filteredByPaidByMe) return null;

    return {
      id: row.id,
      title: row.title,
      amount: Number(row.amount),
      currency: row.currency,
      category: row.category,
      paid_by_name: row.paid_by.display_name,
      date: row.date,
      group_name: row.groups?.name ?? "Unknown",
      my_share: Number(mySlip?.amount ?? 0),
      i_paid: iPaid,
      settled: mySlip?.settled ?? false,
      receipt_count: row.receipt_links?.length ?? 0,
    };
  }).filter(Boolean) as any[];

  const youOwe = expenses
    .filter((e) => !e.i_paid && !e.settled)
    .reduce((s, e) => s + e.my_share, 0);
  const youLent = expenses
    .filter((e) => e.i_paid && !e.settled)
    .reduce((s, e) => s + (e.amount - e.my_share), 0);

  return {
    expenses,
    total_count: expenses.length,
    you_owe: Math.round(youOwe * 100) / 100,
    you_lent: Math.round(youLent * 100) / 100,
  };
}

// ── add_expense ───────────────────────────────────────────────────────────

export async function addExpense(
  input: In<typeof AddExpenseInput>,
  supabase: SupabaseClient,
  userId: string
): Promise<Out<typeof AddExpenseOutput>> {
  const today = new Date().toISOString().split("T")[0];

  // 1. Insert the expense
  const { data: expense, error: expErr } = await supabase
    .from("expenses")
    .insert({
      group_id: input.group_id,
      title: input.title,
      amount: input.amount,
      currency: input.currency,
      category: input.category,
      date: input.date ?? today,
      notes: input.notes,
      paid_by: userId,
    })
    .select("id")
    .single();

  if (expErr) throw new Error(`Failed to create expense: ${expErr.message}`);

  // 2. Calculate splits
  const allMembers = [...new Set([userId, ...input.split_with])];
  const perPerson =
    input.split_amounts ??
    Object.fromEntries(
      allMembers.map((id) => [id, Math.round((input.amount / allMembers.length) * 100) / 100])
    );

  // 3. Insert splits
  const splits = allMembers.map((uid) => ({
    expense_id: expense.id,
    user_id: uid,
    amount: perPerson[uid] ?? 0,
    settled: uid === userId, // payer's own split is auto-settled
  }));

  const { error: splitErr } = await supabase
    .from("expense_splits")
    .insert(splits);

  if (splitErr) throw new Error(`Failed to create splits: ${splitErr.message}`);

  // 4. Fetch display names for the response
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", allMembers);

  const nameMap = new Map((profiles ?? []).map((p: any) => [p.id, p.display_name]));

  return {
    expense_id: expense.id,
    message: `Added "${input.title}" ($${input.amount.toFixed(2)}) and split it ${allMembers.length} ways.`,
    splits: allMembers.map((uid) => ({
      user_id: uid,
      user_name: String(nameMap.get(uid) ?? uid),
      amount: perPerson[uid] ?? 0,
    })),
  };
}

// ── get_balances ──────────────────────────────────────────────────────────

export async function getBalances(
  input: In<typeof GetBalancesInput>,
  supabase: SupabaseClient,
  userId: string
): Promise<Out<typeof GetBalancesOutput>> {
  let query = supabase
    .from("expense_splits")
    .select(`
      user_id, amount, settled,
      expenses!inner(paid_by, currency, group_id)
    `)
    .eq("settled", false);

  if (input.group_id) query = query.eq("expenses.group_id", input.group_id);

  // Get splits where I paid (others owe me)
  const { data: iLent } = await query
    .eq("expenses.paid_by", userId)
    .neq("user_id", userId);

  // Get splits where I owe someone else
  const { data: iOwe } = await query
    .eq("user_id", userId)
    .neq("expenses.paid_by", userId);

  const netByUser = new Map<string, { net: number; currency: string }>();

  for (const row of iLent ?? []) {
    const cur = netByUser.get(row.user_id) ?? { net: 0, currency: (row as any).expenses.currency };
    cur.net += Number(row.amount);
    netByUser.set(row.user_id, cur);
  }

  for (const row of iOwe ?? []) {
    const paid_by = (row as any).expenses.paid_by;
    const cur = netByUser.get(paid_by) ?? { net: 0, currency: (row as any).expenses.currency };
    cur.net -= Number(row.amount);
    netByUser.set(paid_by, cur);
  }

  // Fetch display names
  const userIds = [...netByUser.keys()];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", userIds);

  const nameMap = new Map((profiles ?? []).map((p: any) => [p.id, p.display_name]));

  const balances = [...netByUser.entries()].map(([uid, { net, currency }]) => ({
    user_id: uid,
    user_name: String(nameMap.get(uid) ?? uid),
    net: Math.round(net * 100) / 100,
    currency,
  }));

  const yourNet = balances.reduce((s, b) => s + b.net, 0);

  return {
    balances,
    your_net: Math.round(yourNet * 100) / 100,
    currency: balances[0]?.currency ?? "CAD",
  };
}

// ── settle_up ─────────────────────────────────────────────────────────────

export async function settleUp(
  input: In<typeof SettleUpInput>,
  supabase: SupabaseClient,
  userId: string
): Promise<Out<typeof SettleUpOutput>> {
  // Mark relevant splits as settled
  const { error: splitErr } = await supabase
    .from("expense_splits")
    .update({ settled: true, settled_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("settled", false)
    .in(
      "expense_id",
      supabase
        .from("expenses")
        .select("id")
        .eq("paid_by", input.to_user_id)
        .eq("group_id", input.group_id)
    );

  if (splitErr) throw new Error(`Failed to settle splits: ${splitErr.message}`);

  // Record the settlement
  const { data: settlement, error: settleErr } = await supabase
    .from("settlements")
    .insert({
      group_id: input.group_id,
      from_user: userId,
      to_user: input.to_user_id,
      amount: input.amount,
      currency: input.currency,
      note: input.note,
    })
    .select("id")
    .single();

  if (settleErr) throw new Error(`Failed to record settlement: ${settleErr.message}`);

  return {
    settlement_id: settlement.id,
    message: `Settled $${input.amount.toFixed(2)} ${input.currency}. All relevant splits marked as done.`,
  };
}

// ── get_groups ────────────────────────────────────────────────────────────

export async function getGroups(
  _input: In<typeof GetGroupsInput>,
  supabase: SupabaseClient,
  userId: string
): Promise<Out<typeof GetGroupsOutput>> {
  const { data, error } = await supabase
    .from("groups")
    .select(`
      id, name, currency,
      group_members(user_id)
    `)
    .eq("group_members.user_id", userId);

  if (error) throw new Error(`DB error: ${error.message}`);

  const groups = await Promise.all(
    (data ?? []).map(async (g: any) => {
      // Quick balance check per group
      const { data: unsettled } = await supabase
        .from("expense_splits")
        .select("amount, expenses!inner(paid_by, group_id)")
        .eq("expenses.group_id", g.id)
        .eq("settled", false)
        .eq("user_id", userId);

      const yourBalance = (unsettled ?? []).reduce((s: number, row: any) => {
        return row.expenses.paid_by === userId ? s : s - Number(row.amount);
      }, 0);

      return {
        id: g.id,
        name: g.name,
        member_count: g.group_members?.length ?? 0,
        your_balance: Math.round(yourBalance * 100) / 100,
        currency: g.currency,
      };
    })
  );

  return { groups };
}

// ── attach_receipt ────────────────────────────────────────────────────────

export async function attachReceipt(
  input: In<typeof AttachReceiptInput>,
  supabase: SupabaseClient,
  userId: string
): Promise<Out<typeof AttachReceiptOutput>> {
  // Derive embed URL for Google Drive
  let embedUrl = input.url;
  if (input.provider === "google_drive") {
    try {
      const u = new URL(input.url);
      const segments = u.pathname.split("/");
      const fileIdx = segments.indexOf("d");
      if (fileIdx !== -1) {
        const fileId = segments[fileIdx + 1];
        embedUrl = `https://drive.google.com/file/d/${fileId}/preview`;
      }
    } catch {
      // leave embed_url as the original url
    }
  }

  const { data, error } = await supabase
    .from("receipt_links")
    .insert({
      expense_id: input.expense_id,
      uploaded_by: userId,
      url: input.url,
      embed_url: embedUrl,
      provider: input.provider,
      filename: input.filename,
    })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to attach receipt: ${error.message}`);

  return {
    receipt_id: data.id,
    embed_url: embedUrl,
    message: `Receipt attached successfully. Preview: ${embedUrl}`,
  };
}
