import { createInitialState } from "./defaults";
import { formatVnd } from "./format";
import type { AccountChange, Activity, AppState } from "./types";

export function isAppState(value: unknown): value is AppState {
  if (!value || typeof value !== "object") return false;
  const row = value as AppState;
  return (
    row.version === 1 &&
    !!row.settings &&
    Array.isArray(row.accounts) &&
    Array.isArray(row.categories) &&
    Array.isArray(row.transactions) &&
    Array.isArray(row.debts) &&
    Array.isArray(row.installments) &&
    Array.isArray(row.budgets)
  );
}

function isAccountChange(value: unknown): value is AccountChange {
  if (!value || typeof value !== "object") return false;
  const row = value as AccountChange;
  return (
    typeof row.id === "string" &&
    typeof row.account_id === "string" &&
    typeof row.at === "string" &&
    (row.action === "CREATE" || row.action === "UPDATE") &&
    typeof row.summary === "string"
  );
}

function isActivity(value: unknown): value is Activity {
  if (!value || typeof value !== "object") return false;
  const row = value as Activity;
  return (
    typeof row.id === "string" &&
    typeof row.at === "string" &&
    typeof row.target_id === "string" &&
    typeof row.summary === "string" &&
    (row.action === "CREATE" || row.action === "UPDATE" || row.action === "DELETE") &&
    (row.kind === "TX" || row.kind === "WALLET" || row.kind === "DEBT" || row.kind === "BUDGET" || row.kind === "CATEGORY" || row.kind === "BOOK")
  );
}

export function normalizeState(value: AppState): AppState {
  const base = createInitialState();
  const rawChanges = (value as { accountChanges?: unknown }).accountChanges;
  const accountChanges = Array.isArray(rawChanges) ? rawChanges.filter(isAccountChange) : [];
  const rawActivity = (value as { activity?: unknown }).activity;
  const activity = Array.isArray(rawActivity) ? rawActivity.filter(isActivity) : [];
  const next: AppState = {
    ...base,
    ...value,
    settings: { ...base.settings, ...value.settings },
    dayNotes: value.dayNotes ?? {},
    accountChanges,
    activity,
  };
  if (next.accountChanges.length === 0 && next.settings.onboarded && next.settings.anchorDate) {
    next.accountChanges = next.accounts.map((account) => ({
      id: `opening-${account.id}`,
      account_id: account.id,
      at: `${next.settings.anchorDate}T00:00`,
      action: "CREATE",
      summary: `Ghi số dư ban đầu ${formatVnd(account.initial_balance)}.`,
    }));
  }
  const seen = new Set(next.activity.map((item) => item.id));
  const carried = next.accountChanges
    .filter((change) => !seen.has(change.id))
    .map((change) => ({
      id: change.id,
      at: change.at,
      kind: "WALLET" as const,
      action: change.action,
      target_id: change.account_id,
      summary: change.summary,
    }));
  next.activity = [...next.activity, ...carried];
  return next;
}

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function usernameError(value: string): string | null {
  const username = normalizeUsername(value);
  if (!/^[a-z0-9_]{3,24}$/.test(username)) {
    return "Tên đăng nhập từ 3 đến 24 ký tự, chỉ gồm chữ thường, số và dấu gạch dưới.";
  }
  return null;
}

export function passwordError(value: string): string | null {
  if (value.length < 6) return "Mật khẩu cần ít nhất 6 ký tự.";
  if (value.length > 72) return "Mật khẩu tối đa 72 ký tự.";
  return null;
}
