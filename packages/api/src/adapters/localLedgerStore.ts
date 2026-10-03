/**
 * Local-first ledger adapter (layer: adapter).
 *
 * A minimal, offline implementation of the LedgerStore port. Each group is one
 * document (members + profiles + recorded expenses). Optional file persistence lets
 * a device keep its ledger across restarts. This is intentionally simple — a
 * CRDT-backed adapter (Automerge/Yjs) replaces it later without touching the domain.
 */

import { existsSync, readFileSync } from "node:fs";
import { writeFileSync } from "node:fs";
import type { LedgerStore, RecordedExpense } from "../ports/ledgerStore.ts";

type GroupDoc = {
  memberIds: string[];
  profiles: Map<string, string>;
  expenses: RecordedExpense[];
};

type PersistShape = {
  groups?: Record<
    string,
    { memberIds: string[]; profiles?: Record<string, string>; expenses?: RecordedExpense[] }
  >;
};

export class LocalLedgerStore implements LedgerStore {
  private readonly groups = new Map<string, GroupDoc>();
  private readonly filePath?: string;

  constructor(filePath?: string) {
    this.filePath = filePath;
    if (filePath && existsSync(filePath)) {
      this.load(filePath);
    }
  }

  private load(fp: string): void {
    const parsed = JSON.parse(readFileSync(fp, "utf8")) as PersistShape;
    for (const [gid, g] of Object.entries(parsed.groups ?? {})) {
      this.groups.set(gid, {
        memberIds: [...g.memberIds],
        profiles: new Map(Object.entries(g.profiles ?? {})),
        expenses: g.expenses ?? [],
      });
    }
  }

  async isGroupMember(groupId: string, userId: string): Promise<boolean> {
    return this.groups.get(groupId)?.memberIds.includes(userId) ?? false;
  }

  async listGroupMemberIds(groupId: string): Promise<string[]> {
    return [...(this.groups.get(groupId)?.memberIds ?? [])];
  }

  async recordExpense(expense: RecordedExpense): Promise<void> {
    const doc = this.groups.get(expense.group_id);
    if (!doc) {
      throw new Error(`Group ${expense.group_id} not found`);
    }
    // Push the fully-built aggregate in one operation (all-or-nothing).
    doc.expenses.push({ ...expense, splits: expense.splits.map((s) => ({ ...s })) });
    this.persist();
  }

  async getMemberNames(userIds: string[]): Promise<Map<string, string>> {
    const names = new Map<string, string>();
    for (const doc of this.groups.values()) {
      for (const uid of userIds) {
        const name = doc.profiles.get(uid);
        if (name) names.set(uid, name);
      }
    }
    return names;
  }

  private persist(): void {
    if (!this.filePath) return;
    const data: PersistShape = {
      groups: Object.fromEntries(
        [...this.groups.entries()].map(([gid, doc]) => [
          gid,
          {
            memberIds: doc.memberIds,
            profiles: Object.fromEntries(doc.profiles),
            expenses: doc.expenses,
          },
        ])
      ),
    };
    writeFileSync(this.filePath, JSON.stringify(data, null, 2), "utf8");
  }
}
