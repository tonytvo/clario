/**
 * Tool handler tests — the non-recording tools are stubs on the local-first
 * ledger until their slices are designed. These tests pin the stub contract.
 *
 * Run: npm test
 */

import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import {
  getExpenses,
  getBalances,
  getGroups,
  settleUp,
  attachReceipt,
  uploadReceiptFromPath,
} from "../src/tools/handlers.ts";
import { LocalLedgerStore } from "../src/adapters/localLedgerStore.ts";

const TEST_USER_ID = "00000000-0000-0000-0000-000000000001";
const TEST_GROUP_ID = "00000000-0000-0000-0000-000000000002";
const OTHER_USER_ID = "00000000-0000-0000-0000-000000000003";
const TEST_EXPENSE_ID = "00000000-0000-0000-0000-000000000004";

const store = new LocalLedgerStore();

describe("read stubs", () => {
  it("getExpenses returns an empty result", async () => {
    const result = await getExpenses(
      { sort_by: "date", sort_order: "desc", limit: 50 },
      store,
      TEST_USER_ID
    );
    expect(result).toEqual({ expenses: [], total_count: 0, you_owe: 0, you_lent: 0 });
  });

  it("getBalances returns no balances with zero net", async () => {
    const result = await getBalances({}, store, TEST_USER_ID);
    expect(result.balances).toHaveLength(0);
    expect(result.your_net).toBe(0);
  });

  it("getGroups returns no groups", async () => {
    const result = await getGroups({}, store, TEST_USER_ID);
    expect(result.groups).toHaveLength(0);
  });
});

describe("write stubs", () => {
  it("settleUp returns a settlement id without persisting", async () => {
    const result = await settleUp(
      { group_id: TEST_GROUP_ID, to_user_id: OTHER_USER_ID, amount: 25, currency: "CAD" },
      store,
      TEST_USER_ID
    );
    expect(result.settlement_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(result.message).toContain("$25.00 CAD");
  });

  it("attachReceipt derives a Drive preview URL", async () => {
    const result = await attachReceipt(
      {
        expense_id: TEST_EXPENSE_ID,
        url: "https://drive.google.com/file/d/abc123/view?usp=sharing",
        provider: "google_drive",
      },
      store,
      TEST_USER_ID
    );
    expect(result.embed_url).toBe("https://drive.google.com/file/d/abc123/preview");
  });

  it("uploadReceiptFromPath references the local file by file:// URL", async () => {
    const dir = await mkdtemp(join(tmpdir(), "clario-"));
    const file = join(dir, "receipt.png");
    await writeFile(file, "fake");

    const result = await uploadReceiptFromPath(
      { expense_id: TEST_EXPENSE_ID, file_path: file },
      store,
      TEST_USER_ID
    );
    expect(result.url).toBe(`file://${file}`);
  });

  it("uploadReceiptFromPath rejects unsupported file types", async () => {
    await expect(
      uploadReceiptFromPath(
        { expense_id: TEST_EXPENSE_ID, file_path: "/tmp/receipt.txt" },
        store,
        TEST_USER_ID
      )
    ).rejects.toThrow(/Unsupported file type/);
  });
});
