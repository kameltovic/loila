// Global daily cap on live LLM calls, to make a runaway bill impossible: if it fits, everything else
// leaking (account farm, header spoofing, a bug) still can't spend more than LLM_DAILY_BUDGET calls/day.
// Enforced in openrouter.ts (single chokepoint) BEFORE the network call; batch jobs opt out (budget: false).
import { getDb } from "./db";

export const DEFAULT_DAILY_BUDGET = 500;

export class BudgetExceededError extends Error {
  constructor(public limit: number) {
    super(`Daily LLM budget reached (${limit} calls)`);
  }
}

/** UTC day key, e.g. "2026-09-17". Counters are per UTC day (same clock as the SQLite retention purges). */
export const budgetDay = (at = Date.now()) => new Date(at).toISOString().slice(0, 10);

/** Max live LLM calls per UTC day. `LLM_DAILY_BUDGET=0` disables the cap (batch jobs / local dev). */
export function dailyBudget(): number {
  const raw = process.env.LLM_DAILY_BUDGET;
  if (raw === undefined || raw.trim() === "") return DEFAULT_DAILY_BUDGET;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.floor(n) : DEFAULT_DAILY_BUDGET;
}

export function llmCallsToday(day = budgetDay()): number {
  return (getDb().prepare("SELECT calls FROM llm_budget WHERE day = ?").get(day) as { calls: number } | undefined)?.calls ?? 0;
}

/**
 * Reserves one LLM call for today, atomically, and returns the new count. Throws BudgetExceededError
 * when the cap is already reached (the refused call costs nothing and consumes nothing).
 * The attempt is counted, not the success, so retries and failures can't slip past the cap.
 */
export function reserveLlmCall(): number {
  const limit = dailyBudget();
  if (limit <= 0) return 0; // cap disabled
  const db = getDb();
  const day = budgetDay();
  return db.transaction(() => {
    const used = (db.prepare("SELECT calls FROM llm_budget WHERE day = ?").get(day) as { calls: number } | undefined)?.calls ?? 0;
    if (used >= limit) throw new BudgetExceededError(limit);
    db.prepare("INSERT INTO llm_budget (day, calls) VALUES (?, 1) ON CONFLICT(day) DO UPDATE SET calls = calls + 1").run(day);
    return used + 1;
  }).immediate();
}
