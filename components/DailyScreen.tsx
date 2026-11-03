"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Icon } from "@/components/Icon";
import { QuickAdd } from "@/components/QuickAdd";
import { useStore } from "@/components/Store";
import { Card, Money, cn } from "@/components/ui";
import { accountTypeLabel } from "@/lib/defaults";
import { addDays, daysOfMonth, formatLongDate, formatMonthLabel, formatShortDate, formatTime, shiftMonth } from "@/lib/dates";
import { accountSnapshots, anchorOpening, buildDailySummaries } from "@/lib/finance";
import type { Transaction } from "@/lib/types";

export function DailyScreen() {
  const { state, today } = useStore();
  const anchor = state.settings.anchorDate ?? today;
  const [month, setMonth] = useState(today.slice(0, 7));
  const [openDay, setOpenDay] = useState(today);
  const [composer, setComposer] = useState<{ date: string; tx: Transaction | null } | null>(null);
  const horizon = addDays(today, 7);

  const end = useMemo(() => {
    const dates = state.transactions.map((tx) => tx.date);
    return [horizon, ...dates].sort().at(-1) ?? horizon;
  }, [state.transactions, horizon]);

  const summaries = useMemo(
    () => buildDailySummaries(anchor, anchorOpening(state.accounts), state.transactions, end < anchor ? anchor : end, state.dayNotes),
    [anchor, end, state.accounts, state.transactions, state.dayNotes],
  );

  const txDates = new Set(state.transactions.map((tx) => tx.date));
  const days = daysOfMonth(month)
    .filter((day) => day >= anchor && day <= horizon && (day <= today || txDates.has(day)))
    .reverse();
  const latestMonth = horizon.slice(0, 7);
  const earliestMonth = anchor.slice(0, 7);

  useEffect(() => {
    const noted = new Set(state.transactions.map((tx) => tx.date));
    const visible = daysOfMonth(month).filter((day) => day >= anchor && day <= horizon && (day <= today || noted.has(day)));
    if (visible.includes(openDay)) return;
    if (visible.includes(today)) {
      setOpenDay(today);
      return;
    }
    setOpenDay(visible.at(-1) ?? anchor);
  }, [month, anchor, horizon, today, openDay, state.transactions]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-label="Tháng trước"
          disabled={month <= earliestMonth}
          onClick={() => setMonth(shiftMonth(month, -1))}
          className="rounded-full border border-[var(--line)] bg-white p-2 disabled:opacity-40"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="text-center">
          <p className="font-semibold">{formatMonthLabel(month)}</p>
          <Link href="/history" className="text-xs font-semibold text-[var(--brand)]">
            Lịch sử giao dịch
          </Link>
        </div>
        <button
          type="button"
          aria-label="Tháng sau"
          disabled={month >= latestMonth}
          onClick={() => setMonth(shiftMonth(month, 1))}
          className="rounded-full border border-[var(--line)] bg-white p-2 disabled:opacity-40"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {days.length === 0 ? (
        <Card className="px-4 py-8 text-center text-sm text-[var(--muted)]">Tháng này chưa nằm trong kỳ theo dõi.</Card>
      ) : (
        days.map((day) => {
          const summary = summaries.get(day);
          if (!summary) return null;
          const expanded = openDay === day;
          const txs = state.transactions
            .filter((tx) => tx.date === day)
            .sort((a, b) => b.transaction_time.localeCompare(a.transaction_time));
          return (
            <Card key={day} className={cn(expanded && "ring-1 ring-[var(--brand)]/30")}>
              <button type="button" className="w-full px-4 py-3 text-left" onClick={() => setOpenDay(day)} aria-expanded={expanded}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">
                      {formatLongDate(day)}
                      {day === today ? <span className="ml-2 rounded-full bg-[var(--brand-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--brand)]">Hôm nay</span> : null}
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      Thu {summary.total_income > 0 ? `+${summary.total_income.toLocaleString("vi-VN")}` : "0"} · Chi {summary.total_expense.toLocaleString("vi-VN")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] uppercase tracking-wide text-[var(--muted)]">Cuối ngày</p>
                    <Money value={summary.closing_balance} className="text-sm font-semibold" />
                  </div>
                </div>
              </button>
              {expanded ? (
                <DayBody
                  day={day}
                  anchor={anchor}
                  opening={summary.opening_balance}
                  income={summary.total_income}
                  expense={summary.total_expense}
                  net={summary.net_change}
                  closing={summary.closing_balance}
                  txs={txs}
                  onEdit={(tx) => setComposer({ date: day, tx })}
                  onAdd={() => setComposer({ date: day, tx: null })}
                />
              ) : null}
            </Card>
          );
        })
      )}

      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-30 flex justify-center">
        <div className="flex w-full max-w-lg justify-end px-4">
          <button
            type="button"
            aria-label="Thêm giao dịch"
            className="pointer-events-auto grid h-14 w-14 place-items-center rounded-full bg-[var(--brand)] text-white shadow-lg"
            onClick={() => setComposer({ date: openDay || today, tx: null })}
          >
            <Plus />
          </button>
        </div>
      </div>

      <QuickAdd
        open={composer != null}
        date={composer?.date ?? openDay}
        editing={composer?.tx}
        onClose={() => setComposer(null)}
      />
      </div>
  );
}

function DayBody({
  day,
  anchor,
  opening,
  income,
  expense,
  net,
  closing,
  txs,
  onEdit,
  onAdd,
}: {
  day: string;
  anchor: string;
  opening: number;
  income: number;
  expense: number;
  net: number;
  closing: number;
  txs: Transaction[];
  onEdit: (tx: Transaction) => void;
  onAdd: () => void;
}) {
  const { state, actions } = useStore();
  const [note, setNote] = useState(state.dayNotes[day] ?? "");
  const snaps = accountSnapshots(state.accounts, state.transactions, day);

  useEffect(() => {
    setNote(state.dayNotes[day] ?? "");
  }, [day, state.dayNotes]);

  const rows = [
    ["Số dư đầu ngày", opening, false],
    ["Tổng thu", income, true],
    ["Tổng chi", -expense, true],
    ["Biến động ròng", net, true],
  ] as const;

  return (
    <div className="space-y-4 border-t border-[var(--line)] px-4 py-4">
      <p className="text-xs text-[var(--muted)]">
        {day === anchor ? "Số dư đầu ngày lấy từ số dư ban đầu của các ví." : "Số dư đầu ngày bằng số dư cuối ngày hôm trước."}
      </p>
      <dl className="space-y-2">
        {rows.map(([label, value, signed]) => (
          <div key={label} className="flex items-center justify-between gap-3 text-sm">
            <dt className="text-[var(--muted)]">{label}</dt>
            <dd>{signed ? <Money value={value} signed /> : <Money value={value} />}</dd>
          </div>
        ))}
        <div className="flex items-center justify-between gap-3 border-t border-[var(--line)] pt-2">
          <dt className="font-semibold">Số dư cuối ngày</dt>
          <dd>
            <Money value={closing} className="text-lg font-semibold" />
          </dd>
        </div>
      </dl>
      <div className="flex flex-wrap gap-2">
        {snaps.map((snap) => (
          <span key={snap.account.id} className="rounded-full bg-stone-100 px-3 py-1 text-xs">
            {snap.account.name}: <span className="tabular font-semibold">{snap.balance.toLocaleString("vi-VN")} ₫</span>
          </span>
        ))}
      </div>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-[var(--muted)]">Ghi chú ngày</span>
        <input
          className="w-full rounded-2xl border border-[var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--brand)]"
          placeholder="Ví dụ: ngày lĩnh lương"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          onBlur={() => actions.setDayNote(day, note)}
        />
      </label>
      <div className="space-y-2">
        {txs.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Chưa có giao dịch. Chạm + để ghi khoản chi nhỏ.</p>
        ) : (
          txs.map((tx) => <TxRow key={tx.id} tx={tx} onEdit={() => onEdit(tx)} />)
        )}
      </div>
      <button type="button" onClick={onAdd} className="text-sm font-semibold text-[var(--brand)]">
        Thêm giao dịch ngày {formatShortDate(day)}
      </button>
    </div>
  );
}

function TxRow({ tx, onEdit }: { tx: Transaction; onEdit: () => void }) {
  const { state } = useStore();
  const category = state.categories.find((item) => item.id === tx.category_id);
  const account = state.accounts.find((item) => item.id === tx.account_id);
  const destination = state.accounts.find((item) => item.id === tx.destination_account_id);
  const debt = state.debts.find((item) => item.id === tx.debt_id);
  const amount = tx.type === "EXPENSE" ? -tx.amount : tx.amount;
  const accountBadge = account
    ? account.name === accountTypeLabel[account.type]
      ? accountTypeLabel[account.type]
      : `${accountTypeLabel[account.type]} · ${account.name}`
    : "Ví";
  const title = tx.type === "TRANSFER" ? tx.item_detail : category?.name ?? tx.item_detail;

  return (
    <button type="button" onClick={onEdit} className="flex w-full items-center gap-3 rounded-2xl px-1 py-2 text-left hover:bg-black/[0.03]">
      <span
        className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-white"
        style={{ background: category?.color ?? "#57534e" }}
      >
        <Icon name={category?.icon ?? (tx.type === "TRANSFER" ? "arrow-left-right" : "wallet")} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate font-semibold">{title}</span>
          <span className="text-xs text-[var(--muted)]">{formatTime(tx.transaction_time)}</span>
        </span>
        <span className="mt-0.5 block truncate text-sm text-[var(--muted)]">{tx.item_detail}</span>
        <span className="mt-1 flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium">
            {accountBadge}
            {destination ? ` → ${destination.name}` : ""}
          </span>
          {debt ? (
            <Link
              href={`/debts/chi-tiet?id=${debt.id}`}
              onClick={(event) => event.stopPropagation()}
              className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-800"
            >
              Mã nợ: {debt.debt_code}
            </Link>
          ) : null}
        </span>
      </span>
      <Money value={tx.type === "TRANSFER" ? tx.amount : amount} signed={tx.type !== "TRANSFER"} className="shrink-0 text-sm font-semibold" />
    </button>
  );
}
