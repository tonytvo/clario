"use client";
import { useState, useRef, useEffect } from "react";
import { ExpenseTable, DEFAULT_COLUMNS, ALL_COLUMNS, COLUMN_DEFS } from "./ExpenseTable";
import { AddExpenseForm } from "../expense/AddExpenseForm";

// ─── Dev-mode sample data ────────────────────────────────────────────────────
// Shown only when NEXT_PUBLIC_API_URL is unset (local dev / demo).
const SAMPLE_EXPENSES = [
  { id:1, title:"Grocery run",   amount:124.80, paid_by:"You",  category:"🛒 Groceries", date:"2025-05-14", group:"Apartment",   my_share:31.20,  i_paid:true,  has_receipt:true,  settled:false, members:["You","Alex","Sara","Marco"] },
  { id:2, title:"Internet bill", amount:80.00,  paid_by:"Alex", category:"📡 Utilities", date:"2025-05-12", group:"Apartment",   my_share:20.00,  i_paid:false, has_receipt:false, settled:false, members:["You","Alex","Sara","Marco"] },
  { id:3, title:"Hydro",         amount:95.40,  paid_by:"Sara", category:"💡 Utilities", date:"2025-05-10", group:"Apartment",   my_share:23.85,  i_paid:false, has_receipt:true,  settled:true,  members:["You","Alex","Sara","Marco"] },
  { id:4, title:"Pizza night",   amount:67.20,  paid_by:"You",  category:"🍕 Dining",   date:"2025-05-08", group:"Apartment",   my_share:16.80,  i_paid:true,  has_receipt:true,  settled:false, members:["You","Alex","Sara","Marco"] },
  { id:5, title:"Hotel booking", amount:540.00, paid_by:"You",  category:"🏨 Travel",   date:"2025-05-15", group:"Banff trip",  my_share:180.00, i_paid:true,  has_receipt:true,  settled:false, members:["You","Alex","Sara"] },
  { id:6, title:"Gas",           amount:88.00,  paid_by:"Alex", category:"⛽ Transport", date:"2025-05-15", group:"Banff trip",  my_share:29.33,  i_paid:false, has_receipt:false, settled:true,  members:["You","Alex","Sara"] },
  { id:7, title:"Sushi dinner",  amount:212.00, paid_by:"You",  category:"🍣 Dining",   date:"2025-05-11", group:"Dinner club", my_share:35.33,  i_paid:true,  has_receipt:true,  settled:false, members:["You","Alex","Sara","Marco","Leo","Dana"] },
  { id:8, title:"Groceries",     amount:76.50,  paid_by:"Marco",category:"🛒 Groceries",date:"2025-05-06", group:"Apartment",   my_share:19.13,  i_paid:false, has_receipt:false, settled:true,  members:["You","Alex","Sara","Marco"] },
];

// ─── Intent detection ─────────────────────────────────────────────────────────

/**
 * Returns "add_expense" if the message is a natural-language expense transcript,
 * otherwise "query".
 */
function parseIntent(raw) {
  const q = raw.toLowerCase().trim();
  const isAdd =
    /^(add|log|record|create)\b/.test(q) ||
    /^i (paid|spent|bought)\b/.test(q) ||
    /^(spent|paid)\b/.test(q) ||
    /\badd expense\b/.test(q);
  if (!isAdd) return { intent: "query" };

  // Best-effort prefill from the message text
  const amountMatch = raw.match(/\$(\d+(?:\.\d{1,2})?)/);
  const amount = amountMatch ? parseFloat(amountMatch[1]) : undefined;

  const titleMatch = raw.match(/(?:for|on)\s+(.+?)(?:\s+with|\s+split|\s+last|\s+today|\s+yesterday|$)/i);
  const title = titleMatch?.[1]?.trim();

  let date;
  if (/yesterday|last night/i.test(raw)) {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    date = d.toISOString().split("T")[0];
  }

  return { intent: "add_expense", prefill: { amount, title, date } };
}

// ─── Query parser (for the existing chat query flow) ─────────────────────────

function parseQuery(raw) {
  const q = raw.toLowerCase();
  let filters = {};
  let columns = [...DEFAULT_COLUMNS];
  let sortBy = "date";
  let sortDir = "desc";
  let title = "";
  let summary = null;

  if (/\bi paid\b|\bpaid by me\b|\bi('ve)? paid\b/.test(q)) { filters.i_paid = true; title = "Expenses I paid"; }
  if (/\b(not paid|unpaid|owe|i owe)\b/.test(q)) { filters.i_paid = false; title = "Expenses I haven't paid"; }
  if (/\bsettled\b/.test(q) && !/\bunsettled\b/.test(q)) { filters.settled = true; title = (title || "Expenses") + " (settled)"; }
  if (/\bunsettled\b|\bnot settled\b/.test(q)) { filters.settled = false; title = (title || "Expenses") + " (unsettled)"; }
  if (/\bwith receipt\b|\bhas receipt\b|\breceipts?\b/.test(q)) { filters.has_receipt = true; if (!title) title = "Expenses with receipts"; }
  if (/\bno receipt\b|\bwithout receipt\b/.test(q)) { filters.has_receipt = false; }

  const grpMatch = q.match(/\b(apartment|banff|dinner club|work)\b/);
  if (grpMatch) {
    const map = { apartment: "Apartment", banff: "Banff trip", "dinner club": "Dinner club", work: "Work team" };
    filters.group = map[grpMatch[1]];
    if (!title) title = `${filters.group} expenses`;
  }

  const catMap = { dining: "Dining", groceries: "Groceries", travel: "Travel", utilities: "Utilities", transport: "Transport" };
  for (const [kw, cat] of Object.entries(catMap)) {
    if (q.includes(kw)) { filters.category_kw = cat; if (!title) title = `${cat} expenses`; break; }
  }

  if (/\bshow all\b|\ball columns\b|\beverything\b/.test(q)) columns = ALL_COLUMNS;
  if (/\breceipt\b/.test(q) && !columns.includes("has_receipt")) columns.push("has_receipt");
  if (/\bcategor\b/.test(q) && !columns.includes("category")) columns.push("category");
  if (/\bgroup\b/.test(q) && !columns.includes("group")) columns.push("group");
  if (/\b(share|my share|individual)\b/.test(q) && !columns.includes("my_share")) columns.push("my_share");

  if (/\b(largest|biggest|highest|most expensive)\b/.test(q)) { sortBy = "amount"; sortDir = "desc"; }
  if (/\b(smallest|cheapest|lowest)\b/.test(q)) { sortBy = "amount"; sortDir = "asc"; }
  if (/\b(recent|latest|newest)\b/.test(q)) { sortBy = "date"; sortDir = "desc"; }
  if (/\b(oldest|earliest)\b/.test(q)) { sortBy = "date"; sortDir = "asc"; }

  if (/\b(total|sum|how much|balance|owe)\b/.test(q)) summary = "total";
  if (!title) title = "All expenses";

  return { filters, columns, sortBy, sortDir, title, summary };
}

function applyQuery(expenses, { filters, sortBy, sortDir }) {
  let result = [...expenses];
  for (const [key, val] of Object.entries(filters)) {
    if (key === "category_kw") result = result.filter((e) => e.category.toLowerCase().includes(val.toLowerCase()));
    else result = result.filter((e) => e[key] === val);
  }
  result.sort((a, b) => {
    const av = a[sortBy], bv = b[sortBy];
    const cmp = typeof av === "number" ? av - bv : String(av).localeCompare(String(bv));
    return sortDir === "desc" ? -cmp : cmp;
  });
  return result;
}

// ─── Canned suggestions ───────────────────────────────────────────────────────

const SUGGESTIONS = [
  "Add expense $60 dinner last night",
  "Show all expenses I paid",
  "Unsettled expenses with receipts",
  "My Banff trip expenses by amount",
  "How much do I owe in total?",
];

// ─── Sub-components ──────────────────────────────────────────────────────────

function Message({ msg, onFormSuccess, onFormCancel }) {
  const isUser = msg.role === "user";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: isUser ? "flex-end" : "flex-start", marginBottom: "16px", animation: "fadeUp .3s ease both" }}>
      {!isUser && (
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
          <div style={{ width: "22px", height: "22px", borderRadius: "50%", background: "linear-gradient(135deg,#667eea,#764ba2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", color: "white", fontWeight: 700 }}>C</div>
          <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 500 }}>Clario AI</span>
        </div>
      )}
      {isUser ? (
        <div style={{ background: "#0f172a", color: "white", borderRadius: "18px 18px 4px 18px", padding: "10px 16px", fontSize: "14px", maxWidth: "80%", lineHeight: 1.5 }}>
          {msg.text}
        </div>
      ) : (
        <div style={{ maxWidth: "100%", width: "100%" }}>
          {msg.text && (
            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "18px 18px 18px 4px", padding: "10px 16px", fontSize: "14px", color: "#1e293b", lineHeight: 1.6, marginBottom: msg.table || msg.form ? "10px" : "0", display: "inline-block", maxWidth: "80%" }}>
              {msg.text}
            </div>
          )}
          {msg.form === "add_expense" && (
            <AddExpenseForm prefill={msg.prefill} onSuccess={onFormSuccess} onCancel={onFormCancel} />
          )}
          {msg.table && (
            <ExpenseTable rows={msg.table.rows} columns={msg.table.columns} title={msg.table.title} summary={msg.table.summary} />
          )}
        </div>
      )}
    </div>
  );
}

function Typing() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "16px" }}>
      <div style={{ width: "22px", height: "22px", borderRadius: "50%", background: "linear-gradient(135deg,#667eea,#764ba2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", color: "white", fontWeight: 700 }}>C</div>
      <div style={{ display: "flex", gap: "4px", background: "#f1f5f9", padding: "10px 14px", borderRadius: "18px" }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#94a3b8", animation: `bounce .9s ease ${i * .15}s infinite` }} />
        ))}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ExpenseChat() {
  const [messages, setMessages] = useState([
    { id: 0, role: "assistant", text: "Hey! I'm your Clario assistant. Ask me anything about your expenses, or say something like \"add expense $60 dinner\" to log a new one.", table: null, form: null, prefill: null },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, typing]);

  function buildQueryReply(query) {
    const { filters, columns, sortBy, sortDir, title, summary } = parseQuery(query);
    const rows = applyQuery(SAMPLE_EXPENSES, { filters, sortBy, sortDir });
    const totalOwed = rows.filter((r) => !r.i_paid).reduce((s, r) => s + r.my_share, 0);
    const totalPaid = rows.filter((r) => r.i_paid).reduce((s, r) => s + r.amount, 0);

    if (rows.length === 0) return { text: "I couldn't find any expenses matching that. Try rephrasing or ask for 'all expenses'.", table: null };

    let text = "";
    if (summary === "total") text = `Here's your breakdown across ${rows.length} expense${rows.length !== 1 ? "s" : ""}:`;
    else if (filters.i_paid === true) text = `Found ${rows.length} expense${rows.length !== 1 ? "s" : ""} you paid, totalling $${totalPaid.toFixed(2)}.`;
    else if (filters.i_paid === false) text = `You owe $${totalOwed.toFixed(2)} across ${rows.length} unpaid expense${rows.length !== 1 ? "s" : ""}.`;
    else text = `Here are ${rows.length} expense${rows.length !== 1 ? "s" : ""} matching your query.`;

    return { text, table: { rows, columns, title, summary } };
  }

  async function send(queryText) {
    const q = (queryText || input).trim();
    if (!q) return;
    setInput("");

    const userMsg = { id: Date.now(), role: "user", text: q, table: null, form: null, prefill: null };
    setMessages((m) => [...m, userMsg]);

    const { intent, prefill } = parseIntent(q);

    if (intent === "add_expense") {
      setMessages((m) => [...m, {
        id: Date.now() + 1,
        role: "assistant",
        text: "Here's the expense form. Fill in the details and hit Add:",
        table: null,
        form: "add_expense",
        prefill: prefill ?? null,
      }]);
      return;
    }

    // Query flow
    setTyping(true);
    await new Promise((r) => setTimeout(r, 600 + Math.random() * 400));
    const { text, table } = buildQueryReply(q);
    setTyping(false);
    setMessages((m) => [...m, { id: Date.now() + 1, role: "assistant", text, table, form: null, prefill: null }]);
  }

  function handleFormSuccess(result) {
    // Replace the form message with the success result
    setMessages((m) => {
      const withoutForm = m.map((msg) =>
        msg.form === "add_expense" ? { ...msg, form: null, text: "Got it!" } : msg
      );
      const perPerson = result.splits[0]?.amount ?? 0;
      return [
        ...withoutForm,
        {
          id: Date.now(),
          role: "assistant",
          text: result.message,
          table: {
            rows: result.splits.map((s, i) => ({ id: i, title: s.user_name, amount: perPerson, my_share: s.amount, paid_by: s.user_name, date: new Date().toISOString().split("T")[0], group: "—", category: "—", settled: false, i_paid: i === 0, has_receipt: false })),
            columns: ["title", "amount"],
            title: "Split breakdown",
            summary: null,
          },
          form: null,
          prefill: null,
        },
      ];
    });
  }

  function handleFormCancel() {
    setMessages((m) => m.map((msg) =>
      msg.form === "add_expense" ? { ...msg, form: null, text: "No problem — cancelled. What else can I help with?" } : msg
    ));
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'DM Sans', sans-serif; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:none } }
        @keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 4px; }
        textarea:focus { outline: none; }
      `}</style>

      <div style={{ display: "grid", gridTemplateRows: "auto 1fr auto", height: "100vh", background: "#ffffff", fontFamily: "'DM Sans',sans-serif", maxWidth: "860px", margin: "0 auto" }}>

        {/* ── Header ── */}
        <div style={{ padding: "16px 24px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "32px", height: "32px", borderRadius: "10px", background: "linear-gradient(135deg,#667eea,#764ba2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", color: "white", fontWeight: 700, fontFamily: "'DM Serif Display',serif" }}>C</div>
            <div>
              <div style={{ fontSize: "15px", fontWeight: 600, color: "#0f172a", fontFamily: "'DM Serif Display',serif" }}>Clario</div>
              <div style={{ fontSize: "11px", color: "#94a3b8" }}>Expense assistant</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            {["Apartment", "Banff trip", "Dinner club"].map((g) => (
              <button key={g} onClick={() => send(`Show ${g} expenses`)}
                style={{ fontSize: "11px", padding: "4px 10px", borderRadius: "20px", border: "1px solid #e2e8f0", background: "none", color: "#64748b", cursor: "pointer" }}>
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* ── Messages ── */}
        <div style={{ overflowY: "auto", padding: "24px 24px 8px" }}>
          {messages.map((m) => (
            <Message key={m.id} msg={m} onFormSuccess={handleFormSuccess} onFormCancel={handleFormCancel} />
          ))}
          {typing && <Typing />}
          <div ref={bottomRef} />
        </div>

        {/* ── Suggestions ── */}
        <div style={{ padding: "0 24px 10px", display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {SUGGESTIONS.map((s) => (
            <button key={s} onClick={() => send(s)}
              style={{ fontSize: "12px", padding: "5px 12px", borderRadius: "20px", border: "1px solid #e2e8f0", background: "#f8fafc", color: "#475569", cursor: "pointer", transition: "all .15s", fontFamily: "'DM Sans',sans-serif" }}
              onMouseEnter={(e) => { e.target.style.background = "#f1f5f9"; e.target.style.borderColor = "#cbd5e1"; }}
              onMouseLeave={(e) => { e.target.style.background = "#f8fafc"; e.target.style.borderColor = "#e2e8f0"; }}>
              {s}
            </button>
          ))}
        </div>

        {/* ── Input ── */}
        <div style={{ padding: "0 24px 24px" }}>
          <div style={{ display: "flex", gap: "10px", alignItems: "flex-end", border: "1.5px solid #e2e8f0", borderRadius: "16px", padding: "10px 14px", background: "white", transition: "border-color .15s" }}
            onFocusCapture={(e) => { e.currentTarget.style.borderColor = "#667eea"; }}
            onBlurCapture={(e) => { e.currentTarget.style.borderColor = "#e2e8f0"; }}>
            <textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder='Ask about your expenses… or "add expense $60 dinner"'
              style={{ flex: 1, fontSize: "14px", lineHeight: 1.5, color: "#1e293b", border: "none", background: "none", resize: "none", fontFamily: "'DM Sans',sans-serif", minHeight: "20px", maxHeight: "120px", overflow: "auto" }}
              rows={1}
              onInput={(e) => { e.target.style.height = "auto"; e.target.style.height = `${e.target.scrollHeight}px`; }} />
            <button onClick={() => send()}
              disabled={!input.trim() || typing}
              style={{ width: "36px", height: "36px", borderRadius: "10px", border: "none", background: input.trim() && !typing ? "#0f172a" : "#e2e8f0", color: input.trim() && !typing ? "white" : "#94a3b8", cursor: input.trim() && !typing ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", flexShrink: 0, transition: "all .15s" }}>
              ↑
            </button>
          </div>
          <div style={{ fontSize: "11px", color: "#cbd5e1", textAlign: "center", marginTop: "8px" }}>
            Enter to send · Shift+Enter for new line · Click column headers to sort
          </div>
        </div>
      </div>
    </>
  );
}
