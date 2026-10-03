/**
 * Persistence port (layer: persistence port).
 *
 * Technology-neutral, aggregate-oriented interface the recording domain depends on.
 * It exposes exactly what recording needs — nothing about SQL, query builders, or
 * transactions leaks through — so any adapter (local in-memory/file today, a CRDT
 * store or a cloud DB later) can satisfy it. The CRDT engine is deferred behind it.
 */

export type ExpenseSplit = {
  user_id: string;
  amount: number;
  settled: boolean;
};

export type RecordedExpense = {
  id: string;
  group_id: string;
  title: string;
  amount: number;
  currency: string;
  category: string;
  date: string;
  notes?: string;
  paid_by: string;
  recordedAt: number;
  splits: ExpenseSplit[];
};

export interface LedgerStore {
  /** True if the user participates in the group. */
  isGroupMember(groupId: string, userId: string): Promise<boolean>;

  /** All member ids of the group (empty if the group is unknown). */
  listGroupMemberIds(groupId: string): Promise<string[]>;

  /**
   * Persist an expense and all its splits as ONE atomic unit (all-or-nothing).
   * A partially-recorded expense must never exist, even after a future merge.
   */
  recordExpense(expense: RecordedExpense): Promise<void>;

  /** Map of user id → display name for the requested ids. */
  getMemberNames(userIds: string[]): Promise<Map<string, string>>;
}
