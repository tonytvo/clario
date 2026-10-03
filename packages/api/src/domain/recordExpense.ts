/**
 * Record-expense service (layer: domain).
 *
 * Owns ALL business rules for recording: authorization (replacing Postgres RLS),
 * participant resolution, split allocation, and split-sum reconciliation. Depends
 * only on the LedgerStore port. Recording is committed by a single atomic
 * store.recordExpense() call — the service never performs multi-step writes.
 */

import { randomUUID } from "node:crypto";
import type { z } from "zod";
import type { AddExpenseInput, AddExpenseOutput } from "../tools/schemas.ts";
import type { ExpenseSplit, LedgerStore, RecordedExpense } from "../ports/ledgerStore.ts";
import { allocateEqual } from "./allocateEqual.ts";
import { DomainError, DomainErrorCode } from "./errors.ts";

type In<T extends z.ZodType> = z.infer<T>;
type Out<T extends z.ZodType> = z.infer<T>;

/** Caller's local calendar date as YYYY-MM-DD (not the UTC date). */
function todayLocalIso(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toCents(amount: number): number {
  return Math.round(amount * 100);
}

export class RecordExpenseService {
  constructor(private readonly store: LedgerStore) {}

  async record(
    input: In<typeof AddExpenseInput>,
    actorId: string
  ): Promise<Out<typeof AddExpenseOutput>> {
    // 1. The actor must belong to the group they are recording into.
    if (!(await this.store.isGroupMember(input.group_id, actorId))) {
      throw new DomainError(DomainErrorCode.NOT_A_MEMBER, "You are not a member of this group.");
    }

    // 2. Reject raw duplicates in split_with before de-duplication.
    const seen = new Set<string>();
    for (const id of input.split_with) {
      if (seen.has(id)) {
        throw new DomainError(
          DomainErrorCode.DUPLICATE_PARTICIPANT,
          "A participant was listed more than once."
        );
      }
      seen.add(id);
    }

    // 3. Resolve participants (payer first) and validate group membership.
    const participants = [...new Set([actorId, ...input.split_with])];
    const memberIds = await this.store.listGroupMemberIds(input.group_id);
    if (memberIds.length === 0) {
      throw new DomainError(DomainErrorCode.INVALID_GROUP, "Group not found or has no members.");
    }
    const memberSet = new Set(memberIds);
    for (const id of participants) {
      if (!memberSet.has(id)) {
        throw new DomainError(
          DomainErrorCode.SPLIT_TARGET_NOT_MEMBER,
          "A split participant is not a member of this group."
        );
      }
    }

    // 4. Amount must be positive (defence in depth beyond schema validation).
    if (!(input.amount > 0)) {
      throw new DomainError(DomainErrorCode.INVALID_AMOUNT, "Amount must be greater than zero.");
    }

    // 5. Compute each participant's share.
    const perPerson = this.resolveShares(input, participants);

    // 6. Build splits; the payer's own share is settled on creation.
    const splits: ExpenseSplit[] = participants.map((uid) => ({
      user_id: uid,
      amount: perPerson[uid] ?? 0,
      settled: uid === actorId,
    }));

    // 7. Reconciliation guard: splits must sum to the total (within one cent).
    const splitCents = splits.reduce((sum, s) => sum + toCents(s.amount), 0);
    if (Math.abs(splitCents - toCents(input.amount)) > 1) {
      throw new DomainError(
        DomainErrorCode.SPLIT_MISMATCH,
        "Split amounts must sum to the total."
      );
    }

    // 8. Persist the whole expense + splits as one atomic change.
    const recorded: RecordedExpense = {
      id: randomUUID(),
      group_id: input.group_id,
      title: input.title,
      amount: input.amount,
      currency: input.currency,
      category: input.category,
      date: input.date ?? todayLocalIso(),
      notes: input.notes,
      paid_by: actorId,
      recordedAt: Date.now(),
      splits,
    };
    await this.store.recordExpense(recorded);

    // 9. Map to the response contract.
    const names = await this.store.getMemberNames(participants);
    return {
      expense_id: recorded.id,
      message: `Added "${input.title}" ($${input.amount.toFixed(2)}) and split it ${participants.length} ways.`,
      splits: participants.map((uid) => ({
        user_id: uid,
        user_name: names.get(uid) ?? uid,
        amount: perPerson[uid] ?? 0,
      })),
    };
  }

  private resolveShares(
    input: In<typeof AddExpenseInput>,
    participants: string[]
  ): Record<string, number> {
    if (!input.split_amounts) {
      return allocateEqual(input.amount, participants);
    }

    const participantSet = new Set(participants);
    let sumCents = 0;
    for (const [uid, value] of Object.entries(input.split_amounts)) {
      if (!participantSet.has(uid)) {
        throw new DomainError(
          DomainErrorCode.SPLIT_MISMATCH,
          "Custom split amounts include a non-participant."
        );
      }
      if (!(value > 0)) {
        throw new DomainError(
          DomainErrorCode.SPLIT_MISMATCH,
          "Custom split amounts must be positive."
        );
      }
      sumCents += toCents(value);
    }
    if (Math.abs(sumCents - toCents(input.amount)) > 1) {
      throw new DomainError(
        DomainErrorCode.SPLIT_MISMATCH,
        "Custom split amounts must sum to the total."
      );
    }

    const shares: Record<string, number> = {};
    for (const uid of participants) {
      shares[uid] = input.split_amounts[uid] ?? 0;
    }
    return shares;
  }
}
