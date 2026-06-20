"use client";
import { useState } from "react";

export const COLUMN_DEFS: Record<string, { label: string; width: string; numeric?: boolean; badge?: boolean }> = {
  title:      { label: "Description",  width: "200px" },
  amount:     { label: "Total",        width: "100px", numeric: true },
  my_share:   { label: "My share",     width: "100px", numeric: true },
  paid_by:    { label: "Paid by",      width: "110px" },
  date:       { label: "Date",         width: "110px" },
  group:      { label: "Group",        width: "120px" },
  category:   { label: "Category",     width: "130px" },
  settled:    { label: "Settled",      width: "90px",  badge: true },
  i_paid:     { label: "I paid",       width: "80px",  badge: true },
  has_receipt:{ label: "Receipt",      width: "85px",  badge: true },
};

export const ALL_COLUMNS = Object.keys(COLUMN_DEFS);
export const DEFAULT_COLUMNS = ["title", "date", "amount", "my_share", "paid_by", "settled", "has_receipt"];

function Badge({ val, type }: { val: boolean; type: string }) {
  const styles = {
    yes:  { bg: "#e6f4ec", color: "#1a6b3c", label: "Yes" },
    no:   { bg: "#fde8e8", color: "#922b2b", label: "No" },
    paid: { bg: "#e8f0fe", color: "#1a56c4", label: "Paid" },
    owed: { bg: "#fff4e0", color: "#7a4800", label: "Owed" },
  };
  const s = val
    ? (type === "i_paid" ? styles.paid : styles.yes)
    : (type === "i_paid" ? styles.owed : styles.no);
  return (
    <span style={{ background: s.bg, color: s.color, fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "20px", letterSpacing: ".03em" }}>
      {s.label}
    </span>
  );
}

type Row = Record<string, unknown> & { id: number | string; settled?: boolean; has_receipt?: boolean };

type Props = {
  rows: Row[];
  columns: string[];
  title: string;
  summary: string | null;
};

export function ExpenseTable({ rows, columns, title, summary }: Props) {
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [visibleCols, setVisibleCols] = useState(columns);

  const toggleSort = (col: string) => {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir("asc"); }
  };

  const sorted = sortCol ? [...rows].sort((a, b) => {
    const av = a[sortCol];
    const bv = b[sortCol];
    const cmp = typeof av === "number" ? (av as number) - (bv as number) : String(av).localeCompare(String(bv));
    return sortDir === "asc" ? cmp : -cmp;
  }) : rows;

  const totalOwed = rows.filter((r) => !r.i_paid).reduce((s, r) => s + (r.my_share as number), 0);
  const totalLent = rows.filter((r) => r.i_paid).reduce((s, r) => s + ((r.amount as number) - (r.my_share as number)), 0);

  return (
    <div style={{ margin: "4px 0 16px", animation: "fadeUp .35s ease both" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
        <div>
          <span style={{ fontSize: "13px", fontWeight: 600, color: "#0f172a", fontFamily: "'DM Serif Display',serif" }}>{title}</span>
          <span style={{ fontSize: "12px", color: "#64748b", marginLeft: "8px" }}>{rows.length} expense{rows.length !== 1 ? "s" : ""}</span>
        </div>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {ALL_COLUMNS.filter((c) => !visibleCols.includes(c)).map((c) => (
            <button key={c} type="button" onClick={() => setVisibleCols((v) => [...v, c])}
              style={{ fontSize: "11px", padding: "2px 8px", border: "1px dashed #cbd5e1", borderRadius: "12px", background: "none", color: "#64748b", cursor: "pointer" }}>
              + {COLUMN_DEFS[c].label}
            </button>
          ))}
        </div>
      </div>

      {summary === "total" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: "8px", marginBottom: "12px" }}>
          {[
            { label: "You owe",  val: `$${totalOwed.toFixed(2)}`,  color: "#922b2b", bg: "#fde8e8" },
            { label: "You lent", val: `$${totalLent.toFixed(2)}`,  color: "#1a6b3c", bg: "#e6f4ec" },
            { label: "Net",      val: `${totalLent - totalOwed >= 0 ? "+" : ""}$${(totalLent - totalOwed).toFixed(2)}`, color: "#1a56c4", bg: "#e8f0fe" },
          ].map((card) => (
            <div key={card.label} style={{ background: card.bg, borderRadius: "10px", padding: "10px 14px" }}>
              <div style={{ fontSize: "11px", color: card.color, fontWeight: 600, opacity: .7, marginBottom: "2px" }}>{card.label}</div>
              <div style={{ fontSize: "20px", fontWeight: 700, color: card.color, fontFamily: "'DM Serif Display',serif" }}>{card.val}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ overflowX: "auto", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              {visibleCols.map((col) => (
                <th key={col} onClick={() => toggleSort(col)} onKeyDown={(e) => e.key === "Enter" && toggleSort(col)}
                  style={{ padding: "10px 14px", textAlign: COLUMN_DEFS[col]?.numeric ? "right" : "left", fontWeight: 600, fontSize: "11px", color: "#475569", letterSpacing: ".05em", textTransform: "uppercase", cursor: "pointer", userSelect: "none", whiteSpace: "nowrap", borderBottom: "1px solid #e2e8f0", minWidth: COLUMN_DEFS[col]?.width }}>
                  {COLUMN_DEFS[col]?.label ?? col}{sortCol === col ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                </th>
              ))}
              <th style={{ padding: "10px 14px", borderBottom: "1px solid #e2e8f0", width: "36px" }} />
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr key={row.id} style={{ borderTop: i > 0 ? "1px solid #f1f5f9" : "none", background: row.settled ? "#fafafa" : "white", transition: "background .15s" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#f8fafc"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = row.settled ? "#fafafa" : "white"; }}>
                {visibleCols.map((col) => (
                  <td key={col} style={{ padding: "10px 14px", color: "#1e293b", textAlign: COLUMN_DEFS[col]?.numeric ? "right" : "left", opacity: row.settled ? .6 : 1 }}>
                    {col === "amount"       ? <span style={{ fontVariantNumeric: "tabular-nums" }}>${(row.amount as number).toFixed(2)}</span>
                     : col === "my_share"   ? <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>${(row.my_share as number).toFixed(2)}</span>
                     : col === "settled"    ? <Badge val={Boolean(row.settled)} type="settled" />
                     : col === "i_paid"     ? <Badge val={Boolean(row.i_paid)} type="i_paid" />
                     : col === "has_receipt"? <Badge val={Boolean(row.has_receipt)} type="receipt" />
                     : col === "date"       ? <span style={{ color: "#64748b" }}>{String(row[col])}</span>
                     : String(row[col] ?? "")}
                  </td>
                ))}
                <td style={{ padding: "10px 8px" }}>
                  {row.has_receipt && <span title="Has receipt" style={{ fontSize: "16px" }}>📎</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div style={{ padding: "32px", textAlign: "center", color: "#94a3b8", fontSize: "13px" }}>
            No expenses match this query.
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: "6px", marginTop: "8px", flexWrap: "wrap" }}>
        {visibleCols.filter((c) => c !== "title").map((c) => (
          <button key={c} type="button" onClick={() => setVisibleCols((v) => v.filter((x) => x !== c))}
            style={{ fontSize: "11px", padding: "2px 8px", border: "1px solid #e2e8f0", borderRadius: "12px", background: "white", color: "#94a3b8", cursor: "pointer" }}>
            {COLUMN_DEFS[c]?.label} ×
          </button>
        ))}
      </div>
    </div>
  );
}
