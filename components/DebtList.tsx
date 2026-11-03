"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { DebtForm } from "@/components/DebtForm";
import { useStore } from "@/components/Store";
import { Card, Empty, Money, cn } from "@/components/ui";
import { debtPosition, debtStatus } from "@/lib/finance";
import type { Debt, DebtStatus, DebtType } from "@/lib/types";

const statusView: Record<DebtStatus, { label: string; className: string }> = {
  ACTIVE: { label: "Đang trả dần", className: "bg-emerald-100 text-emerald-800" },
  DUE_SOON: { label: "Sắp đến hạn", className: "bg-amber-100 text-amber-900" },
  OVERDUE: { label: "Quá hạn", className: "bg-rose-100 text-rose-800" },
  COMPLETED: { label: "Đã tất toán", className: "bg-stone-200 text-stone-600" },
};

const rank: Record<DebtStatus, number> = { OVERDUE: 0, DUE_SOON: 1, ACTIVE: 2, COMPLETED: 3 };

export function DebtList() {
  const { state, today } = useStore();
  const [tab, setTab] = useState<DebtType>("PAYABLE");
  const [open, setOpen] = useState(false);
  const position = debtPosition(state.debts.map((debt) => ({ ...debt, status: debtStatus(debt, today) })));
  const rows = state.debts
    .filter((debt) => debt.type === tab)
    .map((debt) => ({ ...debt, status: debtStatus(debt, today) }))
    .sort((a, b) => rank[a.status] - rank[b.status] || a.due_date.localeCompare(b.due_date));

  return (
    <div className="space-y-4">
      <Card className="space-y-3 p-4">
        <Kpi title="Phải thu — người khác nợ mình" principal={position.receivable.principal} paid={position.receivable.paid} remaining={position.receivable.remaining} paidLabel="Đã thu" remainingLabel="Còn phải thu" />
        <Kpi title="Phải trả — mình nợ người khác" principal={position.payable.principal} paid={position.payable.paid} remaining={position.payable.remaining} paidLabel="Đã trả" remainingLabel="Dư nợ còn lại" />
        <div className="rounded-2xl bg-[var(--brand)] px-3 py-3 text-white">
          <p className="text-xs uppercase tracking-wider text-white/75">Vị thế nợ ròng</p>
          <p className="tabular mt-1 text-xl font-semibold">
            {position.net > 0 ? "+" : ""}
            {position.net.toLocaleString("vi-VN")} ₫
          </p>
          <p className="mt-1 text-xs text-white/80">
            {position.net > 0
              ? "Người khác đang nợ bạn nhiều hơn số bạn nợ."
              : position.net < 0
                ? "Bạn đang nợ nhiều hơn số cho vay."
                : "Phải thu và phải trả đang cân bằng."}
          </p>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-stone-200/70 p-1">
        {(
          [
            ["PAYABLE", "Phải trả"],
            ["RECEIVABLE", "Phải thu"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={cn("rounded-xl py-2 text-sm font-semibold", tab === value ? "bg-white shadow-sm" : "text-[var(--muted)]")}
          >
            {label}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <Empty title="Chưa có khoản nợ" body="Thêm hồ sơ vay hoặc cho vay, rồi ghi từng đợt trả." />
      ) : (
        rows.map((debt) => <DebtCard key={debt.id} debt={debt} />)
      )}

      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-30 flex justify-center">
        <div className="flex w-full max-w-lg justify-end px-4">
          <button
            type="button"
            aria-label="Thêm khoản nợ"
            className="pointer-events-auto grid h-14 w-14 place-items-center rounded-full bg-[var(--brand)] text-white shadow-lg"
            onClick={() => setOpen(true)}
          >
            <Plus />
          </button>
        </div>
      </div>
      <DebtForm open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

function Kpi({
  title,
  principal,
  paid,
  remaining,
  paidLabel,
  remainingLabel,
}: {
  title: string;
  principal: number;
  paid: number;
  remaining: number;
  paidLabel: string;
  remainingLabel: string;
}) {
  return (
    <div>
      <p className="text-sm font-semibold">{title}</p>
      <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
        <Stat label="Tổng gốc" value={principal} />
        <Stat label={paidLabel} value={paid} />
        <Stat label={remainingLabel} value={remaining} emphasize />
      </div>
    </div>
  );
}

function Stat({ label, value, emphasize }: { label: string; value: number; emphasize?: boolean }) {
  return (
    <div className={cn("rounded-2xl px-2 py-2", emphasize ? "bg-stone-100" : "bg-transparent")}>
      <p className="text-[var(--muted)]">{label}</p>
      <p className="tabular mt-1 text-sm font-semibold">{value.toLocaleString("vi-VN")} ₫</p>
    </div>
  );
}

function DebtCard({ debt }: { debt: Debt }) {
  const view = statusView[debt.status];
  const progress = debt.principal_amount === 0 ? 0 : Math.min(100, (debt.total_paid / debt.principal_amount) * 100);
  return (
    <Link href={`/debts/chi-tiet?id=${debt.id}`} className="block">
      <Card className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-[var(--muted)]">{debt.debt_code}</p>
            <h2 className="text-lg font-semibold leading-tight">{debt.counterparty_name}</h2>
            <p className="text-sm text-[var(--muted)]">{debt.purpose}</p>
          </div>
          <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold", view.className)}>{view.label}</span>
        </div>
        <div>
          <div className="h-2 overflow-hidden rounded-full bg-stone-200">
            <div className="h-full rounded-full bg-[var(--brand)]" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Đã thanh toán {Math.round(progress)}% · {debt.type === "PAYABLE" ? "Đã trả" : "Đã thu"} {debt.installment_count} đợt
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div>
            <p className="text-[var(--muted)]">Gốc</p>
            <Money value={debt.principal_amount} className="text-sm font-semibold" />
          </div>
          <div>
            <p className="text-[var(--muted)]">{debt.type === "PAYABLE" ? "Đã trả" : "Đã thu"}</p>
            <Money value={debt.total_paid} className="text-sm font-semibold" />
          </div>
          <div>
            <p className="text-[var(--muted)]">Còn lại</p>
            <Money value={debt.remaining_amount} className="text-sm font-semibold" />
          </div>
        </div>
      </Card>
    </Link>
  );
}
