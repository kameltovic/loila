// Global LLM budget self-check, no network: npx tsx scripts/check-budget.ts
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "loila-budget-"));
process.env.DATABASE_PATH = path.join(dir, "test.db"); // must be set before db.ts is imported

async function main() {
  const { budgetDay, dailyBudget, llmCallsToday, reserveLlmCall, BudgetExceededError, DEFAULT_DAILY_BUDGET } = await import("../src/lib/budget");
  const { getDb } = await import("../src/lib/db");

  // Default (unset or blank) stays bounded.
  delete process.env.LLM_DAILY_BUDGET;
  assert.equal(dailyBudget(), DEFAULT_DAILY_BUDGET);
  process.env.LLM_DAILY_BUDGET = "nonsense";
  assert.equal(dailyBudget(), DEFAULT_DAILY_BUDGET);

  // Cap: the Nth call gets through, the N+1th is refused and consumes nothing.
  process.env.LLM_DAILY_BUDGET = "3";
  assert.equal(dailyBudget(), 3);
  assert.equal(llmCallsToday(), 0);
  for (let i = 1; i <= 3; i++) assert.equal(reserveLlmCall(), i);
  assert.equal(llmCallsToday(), 3);
  assert.throws(() => reserveLlmCall(), BudgetExceededError);
  assert.throws(() => reserveLlmCall(), BudgetExceededError);
  assert.equal(llmCallsToday(), 3);

  // 0 disables the cap (batch jobs / local dev): calls go through, nothing is recorded.
  process.env.LLM_DAILY_BUDGET = "0";
  for (let i = 0; i < 5; i++) reserveLlmCall();
  assert.equal(llmCallsToday(), 3);

  // Counters are independent per UTC day.
  getDb().prepare("INSERT INTO llm_budget (day, calls) VALUES (?, 9)").run(budgetDay(Date.parse("2026-01-02T00:30:00Z")));
  assert.equal(llmCallsToday(budgetDay(Date.parse("2026-01-02T00:30:00Z"))), 9);
  assert.equal(llmCallsToday(budgetDay(Date.parse("2026-01-03T00:30:00Z"))), 0);

  console.log("check-budget: OK");
}

main().finally(() => fs.rmSync(dir, { recursive: true, force: true }));
