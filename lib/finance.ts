import { daysBetween } from "./dates";
import type {
  Account,
  AccountSnapshot,
  AppState,
  BudgetLine,
  Category,
  DailyBalanceSummary,
  Debt,
  DebtInstallment,
  DebtStatus,
  Transaction,
} from "./types";

export function anchorOpening(accounts: Account[]): number {
  return accounts.reduce((sum, account) => sum + account.initial_balance, 0);
}

export function effectOnAccount(tx: Transaction, accountId: string): number {
  if (tx.type === "INCOME" && tx.account_id === accountId) return tx.amount;
  if (tx.type === "EXPENSE" && tx.account_id === accountId) return -tx.amount;
  if (tx.type === "TRANSFER" && tx.account_id === accountId) return -tx.amount;
  if (tx.type === "TRANSFER" && tx.destination_account_id === accountId) return tx.amount;
  return 0;
}

export function buildDailySummaries(
  anchorDate: string,
  opening: number,
  transactions: Transaction[],
  endDate: string,
  notes: Record<string, string> = {},
): Map<string, DailyBalanceSummary> {
  const map = new Map<string, DailyBalanceSummary>();
  if (!anchorDate || endDate < anchorDate) return map;

  const income = new Map<string, number>();
  const expense = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.date < anchorDate || tx.date > endDate) continue;
    if (tx.type === "INCOME") income.set(tx.date, (income.get(tx.date) ?? 0) + tx.amount);
    if (tx.type === "EXPENSE") expense.set(tx.date, (expense.get(tx.date) ?? 0) + tx.amount);
  }

  let cursor = anchorDate;
  let running = opening;
  while (cursor <= endDate) {
    const totalIncome = income.get(cursor) ?? 0;
    const totalExpense = expense.get(cursor) ?? 0;
    const net = totalIncome - totalExpense;
    const closing = running + net;
    map.set(cursor, {
      id: `day-${cursor}`,
      date: cursor,
      opening_balance: running,
      total_income: totalIncome,
      total_expense: totalExpense,
      net_change: net,
      closing_balance: closing,
      notes: notes[cursor] || undefined,
    });
    running = closing;
    const [y, m, d] = cursor.split("-").map(Number);
    const next = new Date(Date.UTC(y, m - 1, d + 1));
    cursor = next.toISOString().slice(0, 10);
  }
  return map;
}

export function accountBalance(account: Account, transactions: Transaction[], untilDate?: string): number {
  return transactions.reduce((balance, tx) => {
    if (untilDate && tx.date > untilDate) return balance;
    return balance + effectOnAccount(tx, account.id);
  }, account.initial_balance);
}

export function accountSnapshots(
  accounts: Account[],
  transactions: Transaction[],
  untilDate?: string,
): AccountSnapshot[] {
  return [...accounts]
    .sort((a, b) => a.sort - b.sort)
    .map((account) => {
      let income = 0;
      let expense = 0;
      let transferIn = 0;
      let transferOut = 0;
      for (const tx of transactions) {
        if (untilDate && tx.date > untilDate) continue;
        if (tx.type === "INCOME" && tx.account_id === account.id) income += tx.amount;
        if (tx.type === "EXPENSE" && tx.account_id === account.id) expense += tx.amount;
        if (tx.type === "TRANSFER" && tx.account_id === account.id) transferOut += tx.amount;
        if (tx.type === "TRANSFER" && tx.destination_account_id === account.id) transferIn += tx.amount;
      }
      return {
        account,
        opening: account.initial_balance,
        income,
        expense,
        transferIn,
        transferOut,
        balance: account.initial_balance + income - expense + transferIn - transferOut,
      };
    });
}

export function debtStatus(
  debt: Pick<Debt, "remaining_amount" | "due_date">,
  today: string,
): DebtStatus {
  if (debt.remaining_amount <= 0) return "COMPLETED";
  if (debt.due_date < today) return "OVERDUE";
  if (daysBetween(today, debt.due_date) <= 5) return "DUE_SOON";
  return "ACTIVE";
}

export function recomputeDebt(
  debt: Debt,
  installments: DebtInstallment[],
  today: string,
): Debt {
  const mine = installments.filter((item) => item.debt_id === debt.id);
  const totalPaid = mine.reduce((sum, item) => sum + item.amount, 0);
  const remaining = debt.principal_amount - totalPaid;
  return {
    ...debt,
    total_paid: totalPaid,
    remaining_amount: remaining,
    installment_count: mine.length,
    status: debtStatus({ remaining_amount: remaining, due_date: debt.due_date }, today),
  };
}

export function debtPosition(debts: Debt[]) {
  const fold = (type: Debt["type"]) => {
    const rows = debts.filter((debt) => debt.type === type);
    return {
      count: rows.length,
      principal: rows.reduce((sum, debt) => sum + debt.principal_amount, 0),
      paid: rows.reduce((sum, debt) => sum + debt.total_paid, 0),
      remaining: rows.reduce((sum, debt) => sum + debt.remaining_amount, 0),
    };
  };
  const receivable = fold("RECEIVABLE");
  const payable = fold("PAYABLE");
  return {
    receivable,
    payable,
    net: receivable.remaining - payable.remaining,
  };
}

export function nextDebtCode(debts: Debt[]): string {
  const max = debts.reduce((current, debt) => {
    const match = /^CN(\d+)$/.exec(debt.debt_code);
    return match ? Math.max(current, Number(match[1])) : current;
  }, 0);
  return `CN${String(max + 1).padStart(2, "0")}`;
}

export function budgetLines(
  categories: Category[],
  budgets: AppState["budgets"],
  transactions: Transaction[],
  month: string,
  type: Category["type"],
): BudgetLine[] {
  return categories
    .filter((category) => category.type === type && !category.hidden)
    .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, "vi"))
    .map((category) => {
      const budgeted =
        budgets.find((row) => row.month_year === month && row.category_id === category.id)
          ?.budgeted_amount ?? 0;
      const actual = transactions.reduce((sum, tx) => {
        if (tx.date.slice(0, 7) !== month) return sum;
        if (tx.category_id !== category.id || tx.type !== type) return sum;
        return sum + tx.amount;
      }, 0);
      return {
        category,
        budgeted,
        actual,
        variance: budgeted - actual,
        percentage: budgeted > 0 ? (actual / budgeted) * 100 : null,
      };
    });
}

export function sumLines(lines: BudgetLine[]) {
  const budgeted = lines.reduce((sum, line) => sum + line.budgeted, 0);
  const actual = lines.reduce((sum, line) => sum + line.actual, 0);
  return {
    budgeted,
    actual,
    variance: budgeted - actual,
    percentage: budgeted > 0 ? (actual / budgeted) * 100 : null,
  };
}
