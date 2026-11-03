"use client";

import Link from "next/link";
import { Icon } from "@/components/Icon";
import { useStore } from "@/components/Store";
import { Card, Money, cn } from "@/components/ui";
import { expenseGroupOrder, groupMeta } from "@/lib/defaults";
import { addDays, formatLongDate, formatShortDate, formatTime } from "@/lib/dates";
import { accountSnapshots, anchorOpening, budgetLines, buildDailySummaries, debtPosition, debtStatus, sumLines } from "@/lib/finance";
import { formatPlain } from "@/lib/format";

const statusLabel = {
  OVERDUE: "Quá hạn",
  DUE_SOON: "Sắp đến hạn",
  ACTIVE: "Đang trả",
  COMPLETED: "Đã tất toán",
} as const;

export function DashboardScreen() {
  const { state, today, user } = useStore();
  const anchor = state.settings.anchorDate ?? today;
  const month = today.slice(0, 7);
  const end = [today, ...state.transactions.map((tx) => tx.date)].sort().at(-1) ?? today;
  const days = buildDailySummaries(anchor, anchorOpening(state.accounts), state.transactions, end < anchor ? anchor : end, state.dayNotes);
  const todaySummary = days.get(today);
  const snaps = accountSnapshots(state.accounts, state.transactions, today);
  const income = sumLines(budgetLines(state.categories, state.budgets, state.transactions, month, "INCOME"));
  const expense = sumLines(budgetLines(state.categories, state.budgets, state.transactions, month, "EXPENSE"));
  const net = income.actual - expense.actual;
  const priorNet = state.transactions.reduce((sum, tx) => {
    if (tx.date.slice(0, 7) >= month) return sum;
    if (tx.type === "INCOME") return sum + tx.amount;
    if (tx.type === "EXPENSE") return sum - tx.amount;
    return sum;
  }, 0);
  const rate = income.actual > 0 ? Math.round((net / income.actual) * 100) : null;
  const expenseGroups = expenseGroupOrder.map((group) => {
    const lines = budgetLines(state.categories, state.budgets, state.transactions, month, "EXPENSE").filter((line) => line.category.group === group);
    return { group, ...sumLines(lines), suggest: groupMeta[group].ratio && income.budgeted > 0 ? Math.round(income.budgeted * groupMeta[group].ratio!) : null };
  });
  const debts = state.debts.map((debt) => ({ ...debt, status: debtStatus(debt, today) }));
  const position = debtPosition(debts);
  const attention = debts
    .filter((debt) => debt.status === "OVERDUE" || debt.status === "DUE_SOON")
    .sort((a, b) => a.due_date.localeCompare(b.due_date));
  const recent = [...state.transactions].sort((a, b) => b.transaction_time.localeCompare(a.transaction_time)).slice(0, 6);
  const week: string[] = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const day = addDays(today, -offset);
    if (day >= anchor) week.push(day);
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-[var(--muted)]">{formatLongDate(today)}</p>
        <h2 className="text-2xl font-semibold">Xin chào, {user.username}</h2>
      </div>

      <Card className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-[var(--muted)]">Số dư cuối hôm nay</p>
            <Money value={todaySummary?.closing_balance ?? 0} className="mt-1 block text-3xl font-semibold" />
          </div>
          <Link href="/flow" className="text-sm font-semibold text-[var(--brand)]">
            Sổ ngày
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <Mini label="Đầu ngày" value={todaySummary?.opening_balance ?? 0} />
          <Mini label="Thu" value={todaySummary?.total_income ?? 0} positive />
          <Mini label="Chi" value={todaySummary?.total_expense ?? 0} negative />
        </div>
        <p className="text-sm">
          Biến động ròng <Money value={todaySummary?.net_change ?? 0} signed className="font-semibold" />
        </p>
      </Card>

      <section className="grid grid-cols-2 gap-2">
        {snaps.map((snap) => (
          <Link key={snap.account.id} href={`/history?wallet=${snap.account.id}`}>
            <Card className="p-3">
              <p className="flex items-center gap-2 text-xs text-[var(--muted)]">
                <Icon name={snap.account.icon} size={14} />
                {snap.account.name}
              </p>
              <Money value={snap.balance} className="mt-1 block text-sm font-semibold" />
            </Card>
          </Link>
        ))}
      </section>

      <Card className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Tháng này</h3>
          <Link href="/budget" className="text-sm font-semibold text-[var(--brand)]">
            Ngân sách
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-[var(--muted)]">Thu thực tế</p>
            <Money value={income.actual} className="font-semibold" />
            <p className="text-[11px] text-[var(--muted)]">Kế hoạch {formatPlain(income.budgeted)} ₫</p>
          </div>
          <div>
            <p className="text-xs text-[var(--muted)]">Chi thực tế</p>
            <Money value={expense.actual} className="font-semibold" />
            <p className="text-[11px] text-[var(--muted)]">Hạn mức {formatPlain(expense.budgeted)} ₫</p>
          </div>
          <div>
            <p className="text-xs text-[var(--muted)]">Dòng tiền ròng</p>
            <Money value={net} signed className="font-semibold" />
          </div>
          <div>
            <p className="text-xs text-[var(--muted)]">Tỷ lệ tiết kiệm</p>
            <p className="font-semibold">{rate == null ? "—" : `${rate}%`}</p>
          </div>
          <p className="col-span-2 text-[11px] leading-relaxed text-[var(--muted)]">
            {`Thu trừ chi trong tháng, chưa gồm số dư ban đầu ${formatPlain(anchorOpening(state.accounts))} ₫${
              priorNet === 0 ? "" : ` và thu chi các tháng trước (${formatPlain(priorNet)} ₫)`
            }. Số dư cuối hôm nay gồm cả phần đó.`}
          </p>
        </div>
        <div className="space-y-3">
          {expenseGroups.map((group) => {
            const used = group.percentage == null ? (group.actual > 0 ? 100 : 0) : Math.min(100, group.percentage);
            const over = group.percentage != null && group.percentage > 100;
            return (
              <div key={group.group}>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">{groupMeta[group.group].label}</span>
                  <span className="tabular text-[var(--muted)]">
                    {formatPlain(group.actual)} / {formatPlain(group.budgeted)} ₫
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-stone-200">
                  <div className={cn("h-full rounded-full", over ? "bg-[var(--expense)]" : "bg-[var(--brand)]")} style={{ width: `${used}%` }} />
                </div>
                {group.suggest != null ? <p className="mt-1 text-[11px] text-[var(--muted)]">Gợi ý {formatPlain(group.suggest)} ₫</p> : null}
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Công nợ</h3>
          <Link href="/debts" className="text-sm font-semibold text-[var(--brand)]">
            Chi tiết
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <Mini label="Còn phải thu" value={position.receivable.remaining} />
          <Mini label="Còn phải trả" value={position.payable.remaining} />
          <Mini label="Vị thế ròng" value={position.net} signed />
        </div>
        {attention.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Không có khoản nào quá hạn hoặc sắp đến hạn trong 5 ngày.</p>
        ) : (
          <div className="space-y-2">
            {attention.map((debt) => (
              <Link key={debt.id} href={`/debts/${debt.id}`} className="flex items-center justify-between gap-3 rounded-2xl bg-stone-50 px-3 py-2">
                <span>
                  <span className="block text-sm font-semibold">{debt.counterparty_name}</span>
                  <span className={cn("text-xs", debt.status === "OVERDUE" ? "text-[var(--expense)]" : "text-[var(--warn)]")}>
                    {debt.debt_code} · {statusLabel[debt.status]} · hạn {formatShortDate(debt.due_date)}
                  </span>
                </span>
                <Money value={debt.remaining_amount} className="text-sm font-semibold" />
              </Link>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-4">
        <h3 className="font-semibold">7 ngày gần nhất</h3>
        <div className="mt-3 space-y-2">
          {week.length === 0 ? <p className="text-sm text-[var(--muted)]">Chưa có ngày nào trong kỳ theo dõi.</p> : null}
          {week.map((day) => {
            const summary = days.get(day);
            return (
              <Link key={day} href="/flow" className="flex items-center justify-between gap-3 text-sm">
                <span>
                  <span className="font-medium">{day === today ? "Hôm nay" : formatShortDate(day)}</span>
                  <span className="mt-0.5 block text-xs text-[var(--muted)]">
                    Thu {formatPlain(summary?.total_income ?? 0)} · Chi {formatPlain(summary?.total_expense ?? 0)}
                  </span>
                </span>
                <span className="text-right">
                  <Money value={summary?.net_change ?? 0} signed className="block text-xs" />
                  <Money value={summary?.closing_balance ?? 0} className="text-sm font-semibold" />
                </span>
              </Link>
            );
          })}
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Giao dịch mới</h3>
          <span className="flex gap-3">
            <Link href="/history" className="text-sm font-semibold text-[var(--brand)]">
              Lịch sử
            </Link>
            <Link href="/flow" className="text-sm font-semibold text-[var(--brand)]">
              Thêm
            </Link>
          </span>
        </div>
        <div className="mt-3 space-y-3">
          {recent.length === 0 ? <p className="text-sm text-[var(--muted)]">Chưa có giao dịch. Ghi khoản đầu tiên trong sổ ngày.</p> : null}
          {recent.map((tx) => {
            const category = state.categories.find((item) => item.id === tx.category_id);
            const amount = tx.type === "EXPENSE" ? -tx.amount : tx.amount;
            return (
              <div key={tx.id} className="flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-white" style={{ background: category?.color ?? "#57534e" }}>
                  <Icon name={category?.icon ?? "wallet"} size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{tx.item_detail}</span>
                  <span className="text-xs text-[var(--muted)]">
                    {formatShortDate(tx.date)} · {formatTime(tx.transaction_time)}
                  </span>
                </span>
                <Money value={tx.type === "TRANSFER" ? tx.amount : amount} signed={tx.type !== "TRANSFER"} className="text-sm font-semibold" />
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function Mini({ label, value, positive, negative, signed }: { label: string; value: number; positive?: boolean; negative?: boolean; signed?: boolean }) {
  return (
    <div className="rounded-2xl bg-stone-50 px-2 py-2">
      <p className="text-[var(--muted)]">{label}</p>
      {signed ? (
        <Money value={value} signed className="mt-1 block text-sm font-semibold" />
      ) : (
        <p className={cn("tabular mt-1 text-sm font-semibold", positive && value > 0 && "text-[var(--income)]", negative && value > 0 && "text-[var(--expense)]")}>
          {formatPlain(value)} ₫
        </p>
      )}
    </div>
  );
}
