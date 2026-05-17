/**
 * Tool handler tests — test the business logic directly,
 * without needing a real Supabase instance.
 *
 * Run: npm test
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { getExpenses, getBalances, addExpense } from "../src/tools/handlers.ts";

// ── Mock Supabase client ──────────────────────────────────────────────────

function makeMockSupabase(selectData: unknown, insertData?: unknown) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: selectData, error: null }),
    single: vi.fn().mockResolvedValue({ data: insertData ?? { id: "test-uuid" }, error: null }),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
  };

  return {
    from: vi.fn().mockReturnValue(chain),
    _chain: chain,
  };
}

const TEST_USER_ID = "00000000-0000-0000-0000-000000000001";
const TEST_GROUP_ID = "00000000-0000-0000-0000-000000000002";
const OTHER_USER_ID = "00000000-0000-0000-0000-000000000003";

// ── get_expenses ──────────────────────────────────────────────────────────

describe("getExpenses", () => {
  it("returns empty result when no expenses", async () => {
    const supabase = makeMockSupabase([]);
    const result = await getExpenses(
      { sort_by: "date", sort_order: "desc", limit: 50 },
      supabase as any,
      TEST_USER_ID
    );
    expect(result.expenses).toHaveLength(0);
    expect(result.you_owe).toBe(0);
    expect(result.you_lent).toBe(0);
  });

  it("calculates you_owe correctly for unpaid splits", async () => {
    const mockExpenses = [
      {
        id: "exp-1",
        title: "Groceries",
        amount: "100.00",
        currency: "CAD",
        category: "Groceries",
        date: "2025-05-14",
        notes: null,
        paid_by: { id: OTHER_USER_ID, display_name: "Alex" },
        groups: { id: TEST_GROUP_ID, name: "Apartment" },
        expense_splits: [{ user_id: TEST_USER_ID, amount: "25.00", settled: false }],
        receipt_links: [],
      },
    ];

    const supabase = makeMockSupabase(mockExpenses);
    const result = await getExpenses(
      { sort_by: "date", sort_order: "desc", limit: 50 },
      supabase as any,
      TEST_USER_ID
    );

    expect(result.expenses).toHaveLength(1);
    expect(result.you_owe).toBe(25);
    expect(result.you_lent).toBe(0);
    expect(result.expenses[0].i_paid).toBe(false);
    expect(result.expenses[0].settled).toBe(false);
  });

  it("calculates you_lent correctly for expenses you paid", async () => {
    const mockExpenses = [
      {
        id: "exp-2",
        title: "Pizza night",
        amount: "80.00",
        currency: "CAD",
        category: "Dining",
        date: "2025-05-10",
        notes: null,
        paid_by: { id: TEST_USER_ID, display_name: "You" },
        groups: { id: TEST_GROUP_ID, name: "Apartment" },
        expense_splits: [{ user_id: TEST_USER_ID, amount: "20.00", settled: false }],
        receipt_links: [{ id: "r1" }],
      },
    ];

    const supabase = makeMockSupabase(mockExpenses);
    const result = await getExpenses(
      { sort_by: "date", sort_order: "desc", limit: 50 },
      supabase as any,
      TEST_USER_ID
    );

    expect(result.expenses[0].i_paid).toBe(true);
    expect(result.expenses[0].receipt_count).toBe(1);
    // You lent = amount - your share = 80 - 20 = 60
    expect(result.you_lent).toBe(60);
  });
});

// ── getBalances ───────────────────────────────────────────────────────────

describe("getBalances", () => {
  it("returns empty balances with zero net when nothing owed", async () => {
    const supabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    };

    const result = await getBalances({}, supabase as any, TEST_USER_ID);
    expect(result.balances).toHaveLength(0);
    expect(result.your_net).toBe(0);
  });
});

// ── addExpense ────────────────────────────────────────────────────────────

describe("addExpense", () => {
  it("calculates equal splits correctly", async () => {
    const supabase = {
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: "new-expense-id" }, error: null }),
      }),
    };

    // Override for the profiles fetch
    let callCount = 0;
    (supabase.from as any).mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({
            data: [
              { id: TEST_USER_ID, display_name: "You" },
              { id: OTHER_USER_ID, display_name: "Alex" },
            ],
            error: null,
          }),
        };
      }
      return {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: "new-expense-id" }, error: null }),
      };
    });

    const result = await addExpense(
      {
        group_id: TEST_GROUP_ID,
        title: "Test expense",
        amount: 100,
        currency: "CAD",
        category: "Other",
        split_with: [TEST_USER_ID, OTHER_USER_ID],
      },
      supabase as any,
      TEST_USER_ID
    );

    expect(result.expense_id).toBe("new-expense-id");
    expect(result.message).toContain("Test expense");
    expect(result.splits).toHaveLength(2);
  });
});
