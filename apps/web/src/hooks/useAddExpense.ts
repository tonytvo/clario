"use client";
import { useState } from "react";
import type { AddExpenseOutput } from "@clario/shared";
import { callTool, isApiConfigured } from "@/lib/api";

type AddExpenseFormData = {
  title: string;
  amount: number;
  date: string;
  category: string;
  splitWays: number;
};

type State = {
  loading: boolean;
  error: string | null;
  result: AddExpenseOutput | null;
};

// Placeholder UUIDs used when API is not yet wired to real Supabase data.
// These are replaced once group/member management is implemented.
const PLACEHOLDER_GROUP_ID = "00000000-0000-0000-0000-000000000000";
const PLACEHOLDER_MEMBER_ID = "00000000-0000-0000-0000-000000000001";

function mockSuccess(data: AddExpenseFormData): AddExpenseOutput {
  const perPerson = Math.round((data.amount / data.splitWays) * 100) / 100;
  return {
    expense_id: crypto.randomUUID(),
    message: `Added "${data.title}" ($${data.amount.toFixed(2)}) split ${data.splitWays} ways.`,
    splits: Array.from({ length: data.splitWays }, (_, i) => ({
      user_id: crypto.randomUUID(),
      user_name: i === 0 ? "You" : `Person ${i + 1}`,
      amount: perPerson,
    })),
  };
}

export function useAddExpense() {
  const [state, setState] = useState<State>({ loading: false, error: null, result: null });

  async function addExpense(data: AddExpenseFormData): Promise<AddExpenseOutput | null> {
    setState({ loading: true, error: null, result: null });

    try {
      let result: AddExpenseOutput;

      if (!isApiConfigured()) {
        await new Promise((r) => setTimeout(r, 500));
        result = mockSuccess(data);
      } else {
        // Build split_with array — placeholder until member management is built
        const splitWith = Array.from(
          { length: data.splitWays - 1 },
          () => PLACEHOLDER_MEMBER_ID
        );
        result = await callTool<AddExpenseOutput>("add_expense", {
          group_id: PLACEHOLDER_GROUP_ID,
          title: data.title,
          amount: data.amount,
          currency: "CAD",
          category: data.category,
          date: data.date,
          split_with: splitWith,
        });
      }

      setState({ loading: false, error: null, result });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setState({ loading: false, error: message, result: null });
      return null;
    }
  }

  return { ...state, addExpense };
}
