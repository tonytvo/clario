/**
 * RecordExpenseService tests — exercise the recording business rules directly
 * against an in-memory fake of the LedgerStore port (no Supabase, no CRDT).
 *
 * Run: npm test
 */

import { describe, it, expect } from "vitest";
import { RecordExpenseService } from "../src/domain/recordExpense.ts";
import type { LedgerStore, RecordedExpense } from "../src/ports/ledgerStore.ts";

const A = "user-a"; // actor / payer
const B = "user-b";
const C = "user-c";
const D = "user-d"; // outsider (never a member)

class FakeLedgerStore implements LedgerStore {
  recorded: RecordedExpense[] = [];

  constructor(
    private readonly members: string[],
    private readonly names: Record<string, string> = {}
  ) {}

  async isGroupMember(_groupId: string, userId: string): Promise<boolean> {
    return this.members.includes(userId);
  }

  async listGroupMemberIds(_groupId: string): Promise<string[]> {
    return [...this.members];
  }

  async recordExpense(expense: RecordedExpense): Promise<void> {
    this.recorded.push(expense);
  }

  async getMemberNames(userIds: string[]): Promise<Map<string, string>> {
    return new Map(userIds.map((id) => [id, this.names[id] ?? id]));
  }
}

function cents(amount: number): number {
  return Math.round(amount * 100);
}

describe("RecordExpenseService.record", () => {
  it("equal-splits an indivisible total so shares sum exactly ($10 / 3)", async () => {
    const store = new FakeLedgerStore([A, B, C]);
    const result = await new RecordExpenseService(store).record(
      { group_id: "g1", title: "Dinner", amount: 10, currency: "CAD", category: "Other", split_with: [B, C] },
      A
    );

    const recorded = store.recorded[0];
    const total = recorded.splits.reduce((s, sp) => s + cents(sp.amount), 0);
    expect(total).toBe(cents(10));

    const byUser = Object.fromEntries(recorded.splits.map((s) => [s.user_id, cents(s.amount)]));
    expect(byUser[A]).toBe(334); // payer absorbs the odd cent
    expect(byUser[B]).toBe(333);
    expect(byUser[C]).toBe(333);
    expect(result.splits).toHaveLength(3);
  });

  it("accepts valid custom split amounts that sum to the total", async () => {
    const store = new FakeLedgerStore([A, B, C]);
    await new RecordExpenseService(store).record(
      {
        group_id: "g1",
        title: "Groceries",
        amount: 30,
        currency: "CAD",
        category: "Groceries",
        split_with: [B, C],
        split_amounts: { [A]: 10, [B]: 12, [C]: 8 },
      },
      A
    );

    const byUser = Object.fromEntries(store.recorded[0].splits.map((s) => [s.user_id, s.amount]));
    expect(byUser[A]).toBe(10);
    expect(byUser[B]).toBe(12);
    expect(byUser[C]).toBe(8);
  });

  it("rejects custom split amounts that do not sum to the total", async () => {
    const store = new FakeLedgerStore([A, B, C]);
    await expect(
      new RecordExpenseService(store).record(
        {
          group_id: "g1",
          title: "Groceries",
          amount: 30,
          currency: "CAD",
          category: "Groceries",
          split_with: [B, C],
          split_amounts: { [A]: 10, [B]: 10, [C]: 5 },
        },
        A
      )
    ).rejects.toMatchObject({ code: "SPLIT_MISMATCH" });
    expect(store.recorded).toHaveLength(0);
  });

  it("rejects a non-member actor", async () => {
    const store = new FakeLedgerStore([B, C]); // A is not a member
    await expect(
      new RecordExpenseService(store).record(
        { group_id: "g1", title: "Dinner", amount: 10, currency: "CAD", category: "Other", split_with: [B] },
        A
      )
    ).rejects.toMatchObject({ code: "NOT_A_MEMBER" });
  });

  it("rejects a split target who is not a group member", async () => {
    const store = new FakeLedgerStore([A, B]); // D is not a member
    await expect(
      new RecordExpenseService(store).record(
        { group_id: "g1", title: "Dinner", amount: 10, currency: "CAD", category: "Other", split_with: [B, D] },
        A
      )
    ).rejects.toMatchObject({ code: "SPLIT_TARGET_NOT_MEMBER" });
  });

  it("records a single-participant expense (payer only), fully settled", async () => {
    const store = new FakeLedgerStore([A]);
    await new RecordExpenseService(store).record(
      { group_id: "g1", title: "Solo lunch", amount: 50, currency: "CAD", category: "Dining", split_with: [] },
      A
    );

    const splits = store.recorded[0].splits;
    expect(splits).toHaveLength(1);
    expect(splits[0].user_id).toBe(A);
    expect(splits[0].amount).toBe(50);
    expect(splits[0].settled).toBe(true);
  });

  it("settles the payer's own share and leaves others unsettled", async () => {
    const store = new FakeLedgerStore([A, B, C]);
    await new RecordExpenseService(store).record(
      { group_id: "g1", title: "Dinner", amount: 30, currency: "CAD", category: "Other", split_with: [B, C] },
      A
    );

    const byUser = Object.fromEntries(store.recorded[0].splits.map((s) => [s.user_id, s.settled]));
    expect(byUser[A]).toBe(true);
    expect(byUser[B]).toBe(false);
    expect(byUser[C]).toBe(false);
  });
});
