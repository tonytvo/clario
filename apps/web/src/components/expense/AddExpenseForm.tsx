"use client";
import { useState } from "react";
import type { AddExpenseOutput } from "@clario/shared";
import { useAddExpense } from "@/hooks/useAddExpense";

const CATEGORIES = [
  "Groceries", "Dining", "Utilities", "Transport",
  "Travel", "Entertainment", "Health", "Rent", "Other",
] as const;

type Prefill = { title?: string; amount?: number; date?: string };

type Props = {
  prefill?: Prefill;
  onSuccess: (result: AddExpenseOutput) => void;
  onCancel: () => void;
};

const today = () => new Date().toISOString().split("T")[0];

const fieldStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: "4px",
};
const labelStyle = {
  fontSize: "11px",
  fontWeight: 600,
  color: "#475569",
  textTransform: "uppercase" as const,
  letterSpacing: ".05em",
};
const inputStyle = {
  fontSize: "14px",
  padding: "8px 10px",
  border: "1px solid #e2e8f0",
  borderRadius: "8px",
  background: "white",
  color: "#1e293b",
  fontFamily: "'DM Sans', sans-serif",
  outline: "none",
  width: "100%",
  boxSizing: "border-box" as const,
};

export function AddExpenseForm({ prefill, onSuccess, onCancel }: Props) {
  const [title, setTitle] = useState(prefill?.title ?? "");
  const [amount, setAmount] = useState(prefill?.amount?.toString() ?? "");
  const [date, setDate] = useState(prefill?.date ?? today());
  const [category, setCategory] = useState("Other");
  const [splitWays, setSplitWays] = useState("1");
  const { addExpense, loading, error } = useAddExpense();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amountNum = Number.parseFloat(amount);
    const splitNum = Math.max(1, Number.parseInt(splitWays, 10) || 1);
    if (!title.trim() || Number.isNaN(amountNum) || amountNum <= 0) return;
    const result = await addExpense({
      title: title.trim(),
      amount: amountNum,
      date,
      category,
      splitWays: splitNum,
    });
    if (result) onSuccess(result);
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
        borderRadius: "12px",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        maxWidth: "400px",
      }}
    >
      <div style={{ fontSize: "13px", fontWeight: 600, color: "#0f172a" }}>Add expense</div>

      <div style={fieldStyle}>
        <label htmlFor="exp-title" style={labelStyle}>Description</label>
        <input
          id="exp-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Dinner at Forno"
          required
          style={inputStyle}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
        <div style={fieldStyle}>
          <label htmlFor="exp-amount" style={labelStyle}>Amount ($)</label>
          <input
            id="exp-amount"
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            required
            style={inputStyle}
          />
        </div>
        <div style={fieldStyle}>
          <label htmlFor="exp-split" style={labelStyle}>Split (ways)</label>
          <input
            id="exp-split"
            type="number"
            min="1"
            max="20"
            value={splitWays}
            onChange={(e) => setSplitWays(e.target.value)}
            style={inputStyle}
          />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
        <div style={fieldStyle}>
          <label htmlFor="exp-date" style={labelStyle}>Date</label>
          <input
            id="exp-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div style={fieldStyle}>
          <label htmlFor="exp-cat" style={labelStyle}>Category</label>
          <select
            id="exp-cat"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={{ ...inputStyle, cursor: "pointer" }}
          >
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {error && (
        <div style={{ fontSize: "12px", color: "#922b2b", background: "#fde8e8", padding: "8px 10px", borderRadius: "8px" }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          style={{ fontSize: "13px", padding: "8px 14px", borderRadius: "8px", border: "1px solid #e2e8f0", background: "white", color: "#64748b", cursor: "pointer" }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading || !title.trim() || !amount}
          style={{
            fontSize: "13px",
            padding: "8px 16px",
            borderRadius: "8px",
            border: "none",
            background: loading ? "#e2e8f0" : "#0f172a",
            color: loading ? "#94a3b8" : "white",
            cursor: loading ? "default" : "pointer",
            fontWeight: 600,
          }}
        >
          {loading ? "Adding…" : "Add expense"}
        </button>
      </div>
    </form>
  );
}
