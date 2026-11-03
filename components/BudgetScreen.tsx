"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Icon } from "@/components/Icon";
import { useStore } from "@/components/Store";
import { Card, Money, cn } from "@/components/ui";
import { expenseGroupOrder, groupMeta, incomeGroupOrder } from "@/lib/defaults";
import { currentMonth, formatMonthLabel, shiftMonth } from "@/lib/dates";
import { digitsOnly, formatPlain } from "@/lib/format";
import { budgetLines, sumLines } from "@/lib/finance";
import type { BudgetLine, CategoryGroup } from "@/lib/types";

export function BudgetScreen() {
  const { state, actions } = useStore();
  const [month, setMonth] = useState(currentMonth());
  const incomeLines = budgetLines(state.categories, state.budgets, state.transactions, month, "INCOME");
  const expenseLines = budgetLines(state.categories, state.budgets, state.transactions, month, "EXPENSE");
  const income = sumLines(incomeLines);
  const expense = sumLines(expenseLines);
  const net = income.actual - expense.actual;
  const rate = income.actual > 0 ? (net / income.actual) * 100 : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button type="button" aria-label="Tháng trước" className="rounded-full border border-[var(--line)] bg-white p-2" onClick={() => setMonth(shiftMonth(month, -1))}>
          <ChevronLeft size={18} />
        </button>
        <div className="text-center">
          <p className="font-semibold">{formatMonthLabel(month)}</p>
          <p className="text-xs text-[var(--muted)]">Dự toán đầu tháng và số thực tế từ sổ ngày</p>
        </div>
        <button type="button" aria-label="Tháng sau" className="rounded-full border border-[var(--line)] bg-white p-2" onClick={() => setMonth(shiftMonth(month, 1))}>
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Kpi title="Tổng thu nhập" planned={income.budgeted} actual={income.actual} plannedLabel="Kế hoạch" />
        <Kpi title="Tổng chi tiêu" planned={expense.budgeted} actual={expense.actual} plannedLabel="Hạn mức" />
        <Card className="p-3">
          <p className="text-xs text-[var(--muted)]">Dòng tiền ròng</p>
          <Money value={net} signed className="mt-1 block text-lg font-semibold" />
          <p className="mt-1 text-[11px] text-[var(--muted)]">Thu thực tế − chi thực tế</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-[var(--muted)]">Tỷ lệ tiết kiệm</p>
          <p className={cn("tabular mt-1 text-lg font-semibold", rate != null && rate < 0 && "text-[var(--expense)]")}>
            {rate == null ? "—" : `${Math.round(rate)}%`}
          </p>
          <p className="mt-1 text-[11px] text-[var(--muted)]">(Thu − Chi) / Thu</p>
        </Card>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Thu nhập</h2>
        {incomeGroupOrder.map((group) => (
          <GroupBlock
            key={group}
            group={group}
            lines={incomeLines.filter((line) => line.category.group === group)}
            incomeBudget={income.budgeted}
            onCommit={(categoryId, amount) => actions.setBudget(month, categoryId, amount)}
          />
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Chi tiêu theo 50 / 30 / 20</h2>
        {expenseGroupOrder.map((group) => (
          <GroupBlock
            key={group}
            group={group}
            lines={expenseLines.filter((line) => line.category.group === group)}
            incomeBudget={income.budgeted}
            onCommit={(categoryId, amount) => actions.setBudget(month, categoryId, amount)}
          />
        ))}
      </section>
    </div>
  );
}

function Kpi({ title, planned, actual, plannedLabel }: { title: string; planned: number; actual: number; plannedLabel: string }) {
  return (
    <Card className="p-3">
      <p className="text-xs text-[var(--muted)]">{title}</p>
      <p className="mt-1 text-[11px] text-[var(--muted)]">{plannedLabel}</p>
      <Money value={planned} className="block text-sm font-semibold" />
      <p className="mt-2 text-[11px] text-[var(--muted)]">Thực tế</p>
      <Money value={actual} className="block text-sm font-semibold" />
    </Card>
  );
}

function GroupBlock({
  group,
  lines,
  incomeBudget,
  onCommit,
}: {
  group: CategoryGroup;
  lines: BudgetLine[];
  incomeBudget: number;
  onCommit: (categoryId: string, amount: number) => void;
}) {
  const meta = groupMeta[group];
  const totals = sumLines(lines);
  const suggest = meta.ratio && incomeBudget > 0 ? Math.round(incomeBudget * meta.ratio) : null;
  if (lines.length === 0) return null;
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-[var(--line)] px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold">{meta.label}</h3>
            <p className="text-xs text-[var(--muted)]">{meta.hint}</p>
          </div>
          <div className="text-right text-xs">
            <p className="text-[var(--muted)]">Thực tế / dự toán</p>
            <p className="tabular font-semibold">
              {totals.actual.toLocaleString("vi-VN")} / {totals.budgeted.toLocaleString("vi-VN")}
            </p>
          </div>
        </div>
        {suggest != null ? <p className="mt-1 text-xs text-[var(--brand)]">Gợi ý {formatPlain(suggest)} ₫ theo thu kế hoạch</p> : null}
      </div>
      <div className="divide-y divide-[var(--line)]">
        {lines.map((line) => (
          <LineRow key={line.category.id} line={line} onCommit={(amount) => onCommit(line.category.id, amount)} />
        ))}
      </div>
    </Card>
  );
}

function LineRow({ line, onCommit }: { line: BudgetLine; onCommit: (amount: number) => void }) {
  const [text, setText] = useState(line.budgeted ? formatPlain(line.budgeted) : "");
  useEffect(() => {
    setText(line.budgeted ? formatPlain(line.budgeted) : "");
  }, [line.budgeted]);
  const over = line.category.type === "EXPENSE" && line.percentage != null && line.percentage > 100;
  const width = line.percentage == null ? (line.actual > 0 ? 100 : 0) : Math.min(100, line.percentage);
  const varianceLabel =
    line.budgeted === 0
      ? line.actual > 0
        ? "Chưa đặt hạn mức"
        : "Chưa phát sinh"
      : line.category.type === "EXPENSE"
        ? line.variance > 0
          ? "Còn dư"
          : line.variance < 0
            ? "Bội chi"
            : "Khớp hạn mức"
        : line.variance > 0
          ? "Chưa đạt"
          : line.variance < 0
            ? "Vượt thu"
            : "Khớp kế hoạch";

  return (
    <div className="space-y-2 px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white" style={{ background: line.category.color }}>
          <Icon name={line.category.icon} size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{line.category.name}</p>
          <p className="text-[11px] text-[var(--muted)]">Dự toán</p>
        </div>
        <input
          aria-label={`Dự toán ${line.category.name}`}
          inputMode="numeric"
          className="tabular w-32 rounded-xl border border-[var(--line)] bg-white px-2 py-2 text-right text-sm outline-none focus:border-[var(--brand)]"
          value={text}
          placeholder="0"
          onChange={(event) => {
            const digits = digitsOnly(event.target.value).slice(0, 12);
            setText(digits ? formatPlain(Number(digits)) : "");
            onCommit(digits ? Number(digits) : 0);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") (event.target as HTMLInputElement).blur();
          }}
        />
      </div>
      <div className="flex items-center justify-between text-xs">
        <span>
          Thực tế <span className="tabular font-semibold">{formatPlain(line.actual)} ₫</span>
        </span>
        <span className={cn(line.budgeted > 0 && line.variance < 0 && line.category.type === "EXPENSE" && "font-semibold text-[var(--expense)]")}>
          {varianceLabel} {formatPlain(Math.abs(line.variance))} ₫
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-stone-200">
        <div
          className={cn("h-full rounded-full", over ? "bg-[var(--expense)]" : "bg-[var(--brand)]")}
          style={{ width: `${width}%` }}
        />
      </div>
      <p className="text-[11px] text-[var(--muted)]">
        {line.percentage == null ? (line.actual > 0 ? "Chưa đặt hạn mức" : "Chưa phát sinh") : `${Math.round(line.percentage)}% đã dùng`}
      </p>
    </div>
  );
}
