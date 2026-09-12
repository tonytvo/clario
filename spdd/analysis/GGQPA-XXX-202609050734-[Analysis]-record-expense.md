# SPDD Analysis: Record an Expense

## Original Business Requirement

> `@README.md` is the general guideline on what the project looks like and we're looking to record the expense.

The requirement above is the source of truth; `README.md` is background context. Extracting only the **user-level intent** (technical decisions in the README are excluded — they are choices about *how*, not user needs):

- Clario is a Splitwise-style expense tracker whose guiding principle is **"you own your data."**
- Users can **record an expense** they paid on behalf of a group and **split it among group members**.
- Users can **attach a receipt** (proof of purchase) to an expense, and **those receipts remain theirs** — private to their group, under the user's control, revocable at any time, with no storage fees.
- The product should be **free**, easy to install for non-technical users, self-hostable, and open source.

Supporting user stories from `roadmap.md`:

> - user able to add expense with transcript
> - user able to see the expense with receipt in the app
> - user able to split the expense with group members
> - user able to edit/delete the expense
> - user able to see the total amount owed by each group member

**Note on requirement completeness:** The stated requirement is high-level and carries **no explicit acceptance criteria**. This analysis derives implied ACs from the user stories above and flags every derived assumption in the Risk & Gap Analysis. Scope disambiguation is the single most important open question (see below).

### Established project direction & constraints

These are decided constraints the analysis works within (not open questions):

- **Local-first.** Data lives on the user's device and works fully **offline**.
- **Sync across devices/users via CRDTs** (Automerge / Yjs family). The **exact CRDT engine and sync transport are deliberately deferred** — to be decided later.
- **Swappable persistence.** Switching the underlying storage/sync technology must be as cheap and as late as possible, via a technology-neutral abstraction (see Strategic Approach).
- **Storage *mechanisms* are technical decisions, deferred** — this applies to both the ledger and to **receipt storage**. The user requirement for receipts is *attachment + ownership*; where/how a receipt is stored (local blob synced with the ledger, an external link, or both) is not part of the requirement and is decided later behind the same abstraction boundary.
- **Authorization moves into the domain/service layer** (there is no database-enforced row security in a local-first store).

---

## Domain Concept Identification

Concept-driven exploration confirmed that **"record an expense" is not greenfield** — a working `add_expense` capability already exists end-to-end (Feature 1, "Add Expense via Chat"). Its **current implementation is Supabase-Postgres with RLS**, which the local-first direction slates for replacement. The concepts below are the durable, technology-neutral domain; "currently implemented as …" notes describe today's code and mark what must be re-homed behind a persistence port.

### Existing Concepts (from codebase)

- **Expense**: A payment one person made on behalf of a group. Owns a title, amount, currency, category, date, notes, and a `paid_by` payer. Currently implemented as the `expenses` table + the `add_expense` / `get_expenses` tools. Lifecycle root — its splits and receipts belong to it.
- **Split**: Each participant's share of one expense; carries a `settled` flag. Currently `expense_splits`, unique per expense+user. The payer's own split is treated as auto-settled at creation.
- **Group**: The container an expense belongs to; owns a default currency and a member roster. An expense cannot exist without a group. Currently `groups`. **Under local-first sync, the group is the natural unit of replication/sharing.**
- **Group member / Profile**: A person who may participate in a group's expenses and be a split target. Currently `group_members` (roster + role) + `profiles`. Split targets must be members of the expense's group.
- **Receipt**: Optional evidence (proof of purchase) a user attaches to an expense. The user-level invariant is **ownership and control** — receipts stay the user's, private to the group, revocable. *Where/how a receipt is stored is a deferred technical decision, not part of the concept.* Currently implemented as `receipt_links` + `attach_receipt` / `upload_receipt_from_path`. Related to recording only as a follow-on step.
- **Settlement**: A recorded repayment between two members that marks shared splits settled. Currently `settlements` / `settle_up`. Relevant to recording only insofar as new expenses reopen balances.
- **Transcript**: Natural-language input describing an expense ("I paid $60 for dinner, split 3 ways"), parsed best-effort into form prefill. A UI-layer concept, not persisted.
- **Category / Currency**: Classifying and monetary-unit attributes of an expense. Category is an enum in the API schema but free text in the DB; currency defaults to CAD.

### New Concepts Required

- **Persistence port (repository / ledger interface)**: A technology-neutral abstraction the domain and handlers depend on instead of a concrete database client. This is the key new concept enabling the "decide later / swap cheaply" goal. It must be **document/aggregate-oriented**, not SQL-oriented, so a CRDT-backed adapter is natural (no server-side joins, no RDBMS transactions, no auto-increment assumptions).
- **Replication / sync unit & sharing model**: Under local-first, "who can see this expense" becomes "whose devices hold the replica." The **group** is the natural document/replication boundary. How groups are shared and synced is deferred, but the concept must exist so recording knows which document a new expense joins.
- **Merge / conflict semantics for a money ledger**: CRDTs converge state automatically, but the domain must define what a *correct* merge means for money (see Split-integrity risk). Strongly points toward **immutable expense events + derived balances** as the recording model.
- **Member selection (participant picker)**: "Split with group members" implies choosing real participants by identity. Today the web flow only asks "split N ways" and substitutes placeholder UUIDs — there is no selection of actual members. Still the principal functional gap.
- **Split strategy**: An explicit, validated rule for how a total is divided (equal vs. custom amounts), including deterministic remainder-cent allocation. Currently implicit.

### Key Business Rules

- **A recorded expense belongs to exactly one group the recorder participates in.** (Governs Expense ↔ Group. Formerly enforced by RLS; must move to the app/domain layer under local-first.)
- **The sum of all splits equals the expense total, in one currency.** Governs Expense ↔ Split. Asserted in schema prose but **not enforced** today — and a **merge-time invariant** under CRDTs.
- **Every split target is a member of the expense's group.** Governs Split ↔ Group member. Not enforced today.
- **Amount is strictly positive; each split share is non-negative.** (DB checks exist; must be re-expressed as domain invariants once the DB is abstracted.)
- **The payer participates in the split and their own share is settled on creation.**
- **Recording an expense is atomic** — under CRDTs this means expense + its splits are committed as **one change**; a half-recorded or non-reconciling expense must never appear, even after a merge.
- **Splits are unique per (expense, participant).**
- **Recording is append-only for balances** — a new unsettled expense increases what participants owe the payer until settled. Append-only modeling also aligns best with CRDT merge behavior.
- **A receipt attached to an expense stays owned and controlled by the attaching user** — private to the group, revocable — independent of the storage mechanism.

---

## Strategic Approach

### Solution Direction

Treat "record an expense" as **completing and re-homing an existing capability** onto a local-first, sync-ready foundation — without committing to a specific CRDT engine or storage mechanism yet.

- **Introduce a persistence port and depend on it everywhere.** Define a technology-neutral repository/ledger interface (in `packages/shared` or a new `packages/core`) that speaks the domain — record an expense, list expenses, compute balances — not SQL. The tool handlers (`handlers.ts`) stop importing `SupabaseClient` and depend only on this port. Swapping backends becomes "write one adapter + flip a factory," with **no handler changes**. This single move delivers the requested optionality, and the same boundary later hosts the receipt-storage adapter.
- **Preserve the dual-spec, single-schema contract.** The Zod schema in `schemas.ts` stays the one canonical definition consumed by both the MCP adapter (Claude) and the OpenAPI adapter (ChatGPT / web). Changing what "recording" accepts is still a one-place edit; only what sits *behind* the port changes.
- **Adopt a local-first-shaped data model now, engine-agnostic.** Model recording so it is natural for a CRDT document store: **the group is the sync/replication document**, and an expense (with its splits) is **one immutable event appended** to that document. Balances are **derived** from the event stream, not stored mutable fields. This makes concurrent offline recording safe-by-construction and avoids merge conflicts on shared mutable counters.
- **Move authorization from RLS into the domain/service layer.** Membership and "can record into this group" checks that Postgres RLS used to enforce now live in the application, invoked before a write. Visibility becomes a function of which group documents a user replicates.
- **General data flow (target):** *transcript or form → validated tool input → domain service (invariant + membership checks, split allocation) → persistence port `.recordExpense()` → local CRDT adapter appends one change → balances derived on read → structured split breakdown returned.* Sync/replication happens out-of-band behind the port.
- **Keep the engine and receipt-storage decisions deferred but not blocking.** Build against the port with a minimal local adapter so recording works today; design the port's method shapes to be satisfiable by Automerge, Yjs, or any successor without signature changes. Receipt storage plugs into the same abstraction later.

### Key Design Decisions

- **Persistence abstraction: repository port (hexagonal).** → **Recommendation:** adopt it as the first step of this feature. Trade-off: one layer of indirection + a factory, versus permanent coupling to whatever DB is chosen. Optionality is the explicit goal, so the indirection is the point.
- **Port shape: document/aggregate-oriented, not SQL-oriented.** → **Recommendation:** the port exposes domain operations returning whole aggregates (an expense with its splits), never query builders or row cursors. Trade-off: less ad-hoc query flexibility; but SQL-shaped ports leak assumptions a CRDT adapter can't honor, defeating swappability.
- **Recording model: immutable expense events + derived balances.** → **Recommendation:** record each expense as an append-only event and derive balances on read. Trade-off: balance reads compute rather than look up (fine at Clario's scale; memoize later if needed), in exchange for conflict-free merges and a trivially auditable ledger — the right shape for CRDT sync.
- **Atomicity as a single CRDT change.** → **Recommendation:** expense + all its splits are committed in one change so a partially-recorded expense can never exist or emerge from a merge. Trade-off: none meaningful; it replaces the (currently missing) SQL transaction with the CRDT-native equivalent.
- **Merge invariant for split-sum.** Because a CRDT can merge a concurrent amount-edit and split-edit into an inconsistent whole, → **Recommendation:** favor immutability (edits create corrective events rather than mutating amount/splits independently) and validate reconciliation whenever an expense is materialized. Trade-off: "edit expense" becomes event-based rather than in-place; deferred to the edit/delete feature but must be anticipated now.
- **Authorization in the domain layer.** → **Recommendation:** membership/participation checks run in the service before any write; sharing = replication scope. Trade-off: we lose RLS's defense-in-depth backstop, so domain checks must be thorough and well-tested.
- **Receipt attachment via the same abstraction, mechanism deferred.** → **Recommendation:** expose receipt attachment as a domain operation whose *storage adapter* is chosen later; keep the user-level guarantee (ownership, private to group, revocable) in the domain, not tied to any provider. Trade-off: a placeholder/local adapter is needed interim; but the requirement is honored without committing to a mechanism.
- **Split allocation & custom-amount validation:** deterministic remainder allocation; validate custom amounts (keys ⊆ participants, sum = total, all positive). → **Recommendation:** implement domain-side.
- **Participant identity in the web flow:** replace placeholder UUIDs with real member selection sourced from group membership. → **Recommendation:** required for a real split; may depend on group management existing.
- **Defer the concrete CRDT engine + transport.** → **Recommendation:** choose Automerge vs. Yjs and the sync transport in a later, dedicated decision; keep the port able to satisfy either. Trade-off: a minimal placeholder local adapter is needed in the interim so recording is exercisable end-to-end.

### Alternatives Considered

- **Keep Supabase / build directly on a database client** — rejected: contradicts the local-first + swap-late direction and re-welds the domain to one vendor.
- **Swap Supabase for another cloud DB without a port** — rejected: still cloud-dependent, not local-first, and leaves the same coupling that made the pivot expensive.
- **Pick the CRDT engine (Automerge or Yjs) now** — rejected per the decision to choose later; committing early would leak engine specifics into the domain before the port stabilizes.
- **Model expenses as mutable rows/records under CRDT** — rejected: mutable shared fields (amount, split shares) are exactly where CRDT merges silently violate money invariants; immutable events avoid the class of bug.
- **Pre-materialize/store balances at record time** — rejected: adds a synchronized counter that CRDT merges can corrupt; derive-on-read is both simpler and merge-safe.
- **Bake a specific receipt-storage provider into the domain** — rejected: storage location is a technical decision; tying the domain to a provider repeats exactly the coupling this analysis is removing.

---

## Risk & Gap Analysis

### Requirement Ambiguities

- **Scope of "record the expense"**: harden/complete existing `add_expense`, add new capability, or document current behavior? This analysis assumes *harden + re-home onto local-first*. Needs confirmation.
- **Sequencing of the local-first re-homing**: is the port + local-first foundation part of *this* "record expense" work, or a preceding foundational task? Recording cannot be trustworthy on local-first until the port and domain-layer authz exist.
- **Sharing/replication model**: how are groups shared across users, and is any sharing in scope now, or is single-user/single-device local-first the near-term target with multi-user sync later?
- **Participant model**: real member selection now, or equal-N-ways placeholders until group management ships?
- **Split modes in scope**: equal only, or custom amounts/percentages/shares?
- **Payer**: always the authenticated user, or attributable to another member?
- **Entry surfaces**: must recording behave identically via chat/AI (MCP + GPT) and the web form?

### Edge Cases

- **Concurrent offline recording that later merges** — two devices record into the same group offline; both expenses must survive the merge (append-only handles this) and balances must recompute correctly.
- **Concurrent edit of the same expense** — one device changes the amount while another changes a split; the merged result must not violate split-sum. (Drives the immutable-event decision.)
- **Non-divisible totals** ($10 / 3): deterministic remainder-cent allocation so splits sum exactly.
- **Custom `split_amounts` not summing to total**, or keys not matching participants: currently accepted silently.
- **Duplicate participants / payer in `split_with`**: web placeholder path produces N identical IDs, violating uniqueness.
- **Single-participant expense** (payer only): one fully-settled split, zero owed.
- **Split target not a member of the group**: must be rejected.
- **No group chosen / user in no group**: must fail gracefully, not write to a placeholder group.
- **Clock skew across devices** for event ordering (CRDTs use logical, not wall, clocks — but the human-facing `date` still needs sensible defaulting).
- **Very large / zero / negative amounts** and rounding accumulation across many participants.
- **Replica divergence / partial sync**: a balance computed on a device that hasn't received all events is provisional — the UI may need to reflect "not fully synced."

### Technical Risks

- **CRDT merge violating money invariants (correctness — highest)** — *Impact:* silently inconsistent ledgers after a merge (splits ≠ total). *Mitigation:* immutable expense events + derived balances; reconciliation validation on materialization; corrective-event editing rather than in-place mutation.
- **Loss of RLS as an authorization backstop (security)** — *Impact:* without database-enforced row security, any gap in app-layer checks exposes or corrupts data. *Mitigation:* thorough domain-layer membership/participation checks with dedicated tests; treat replication scope as the visibility boundary.
- **Port designed with SQL assumptions (architectural — defeats the goal)** — *Impact:* a leaky, query-builder-shaped port a CRDT adapter can't satisfy, forcing a rewrite exactly when swapping. *Mitigation:* document/aggregate-oriented port validated against both a trivial local adapter and a sketch of a CRDT adapter before locking it.
- **Atomicity without transactions (integrity)** — *Impact:* half-recorded expenses. *Mitigation:* commit expense + splits as one CRDT change.
- **Deferred engine choice leaking into the domain (coupling)** — *Impact:* premature Automerge/Yjs specifics contaminate handlers. *Mitigation:* keep all engine specifics behind the port; interim minimal local adapter.
- **Balances derived on read (performance — minor at current scale)** — *Impact:* recompute cost grows with event count. *Mitigation:* acceptable now; memoize/snapshot later if needed.
- **Split-sum drift on equal splits (correctness)** — *Impact:* balances that don't add up. *Mitigation:* deterministic remainder allocation.
- **Placeholder identities in the web path (functional gap)** — *Impact:* real splits impossible; uniqueness violations for N>2. *Mitigation:* real member selection; may require group management first.
- **Receipt storage mechanism undecided (deferred technical decision)** — *Impact:* the user requirement (attach a receipt, user owns it) is clear, but a cloud-only mechanism would conflict with the offline/local-first goal. *Mitigation:* keep receipt storage behind the same abstraction as the ledger and decide the mechanism later; out of scope for the core record action.
- **Category enum vs. free-text drift; expense-vs-group currency mismatch (consistency)** — *Mitigation:* enum as contract; default expense currency to the group's; defer multi-currency.

### Acceptance Criteria Coverage

No explicit ACs were provided. The table assesses **derived** ACs (from the user stories), scored against the local-first / CRDT direction. Each should be confirmed with the stakeholder.

| AC# | Description (derived) | Addressable? | Gaps/Notes |
|-----|-----------------------|--------------|------------|
| 1 | A user can record an expense (title, amount, currency, category, date, notes) against a group they belong to | Yes | Core path exists; must be re-homed behind the persistence port and pass domain-layer membership checks |
| 2 | Splits sum exactly to the total | Partial | No reconciliation today; must also hold as a **merge-time** invariant under CRDTs |
| 3 | Split with **real** group members (not placeholders) | Partial | Web flow uses placeholders; depends on group/member management |
| 4 | Custom (unequal) split amounts, validated | Partial | Schema supports it; no validation; UI exposes equal-split only |
| 5 | Payer's share settled; others' unsettled and affect balances | Yes | Implemented; balances should be **derived** from events under the new model |
| 6 | Recording is atomic — no orphaned/non-reconciling expense, even after a merge | Partial | Needs single-CRDT-change commit; today two separate inserts, no transaction |
| 7 | Recording works offline and consistently across chat/AI and web | Partial | Requires the port + local adapter; offline behavior is new work |
| 8 | Concurrent/offline recordings merge without loss or invariant violation | Partial | New requirement from the local-first direction; addressed by append-only event model |
| 9 | Invalid input (non-member target, wrong sum, missing group, non-positive amount) rejected clearly | Partial | Format checks exist; membership + sum + group-presence checks missing and must move to the domain layer |
| 10 | A user can attach a receipt to an expense and retains ownership/control of it | Yes (separate step) | Existing `attach_receipt`; storage *mechanism* is a deferred technical decision, not a requirement |
