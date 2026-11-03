"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Delete } from "lucide-react";
import { DebtForm } from "@/components/DebtForm";
import { Icon } from "@/components/Icon";
import { useStore } from "@/components/Store";
import { Alert, Button, Card, Empty, Money, Sheet, cn } from "@/components/ui";
import { accountTypeLabel } from "@/lib/defaults";
import { combineDateTime, formatLongDate, nowTime } from "@/lib/dates";
import { appendDigits, formatPlain } from "@/lib/format";
import { debtStatus } from "@/lib/finance";
import type { DebtInstallment, DebtStatus } from "@/lib/types";

const statusView: Record<DebtStatus, { label: string; className: string }> = {
  ACTIVE: { label: "Đang trả dần", className: "bg-emerald-100 text-emerald-800" },
  DUE_SOON: { label: "Sắp đến hạn", className: "bg-amber-100 text-amber-900" },
  OVERDUE: { label: "Quá hạn", className: "bg-rose-100 text-rose-800" },
  COMPLETED: { label: "Đã tất toán", className: "bg-stone-200 text-stone-600" },
};

export function DebtDetail({ id }: { id: string }) {
  const router = useRouter();
  const { state, today, actions } = useStore();
  const debt = state.debts.find((item) => item.id === id);
  const [editing, setEditing] = useState(false);
  const [paying, setPaying] = useState<DebtInstallment | null | "new">(null);

  if (!debt) {
    return (
      <Empty title="Không thấy khoản nợ" body="Khoản này đã bị xóa hoặc đường dẫn không đúng." />
    );
  }

  const status = debtStatus(debt, today);
  const view = statusView[status];
  const installments = state.installments
    .filter((item) => item.debt_id === debt.id)
    .sort((a, b) => a.installment_number - b.installment_number);
  const progress = debt.principal_amount === 0 ? 0 : Math.min(100, (debt.total_paid / debt.principal_amount) * 100);

  const remove = () => {
    if (!window.confirm("Xóa khoản nợ cùng các đợt thanh toán và giao dịch liên quan?")) return;
    const result = actions.deleteDebt(debt.id);
    if (result.ok) router.push("/debts");
  };

  return (
    <div className="space-y-4">
      <Link href="/debts" className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--brand)]">
        <ChevronLeft size={16} /> Danh sách công nợ
      </Link>
      <Card className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-[var(--muted)]">{debt.debt_code}</p>
            <h2 className="text-2xl font-semibold">{debt.counterparty_name}</h2>
            <p className="text-sm text-[var(--muted)]">{debt.purpose}</p>
          </div>
          <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold", view.className)}>{view.label}</span>
        </div>
        {debt.counterparty_contact ? <p className="text-sm">Liên hệ: {debt.counterparty_contact}</p> : null}
        <p className="text-sm text-[var(--muted)]">
          Phát sinh {formatLongDate(debt.start_date)} · Hạn {formatLongDate(debt.due_date)}
        </p>
        <div className="h-2 overflow-hidden rounded-full bg-stone-200">
          <div className="h-full rounded-full bg-[var(--brand)]" style={{ width: `${progress}%` }} />
        </div>
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div>
            <p className="text-xs text-[var(--muted)]">Gốc</p>
            <Money value={debt.principal_amount} className="font-semibold" />
          </div>
          <div>
            <p className="text-xs text-[var(--muted)]">{debt.type === "PAYABLE" ? "Đã trả" : "Đã thu"}</p>
            <Money value={debt.total_paid} className="font-semibold" />
          </div>
          <div>
            <p className="text-xs text-[var(--muted)]">Còn lại</p>
            <Money value={debt.remaining_amount} className="font-semibold" />
          </div>
        </div>
        {debt.notes ? <p className="text-sm">{debt.notes}</p> : null}
        <div className="flex gap-2">
          <Button variant="soft" className="flex-1" onClick={() => setEditing(true)}>
            Sửa hồ sơ
          </Button>
          <Button variant="danger" onClick={remove}>
            Xóa
          </Button>
        </div>
      </Card>

      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Các đợt thanh toán</h3>
        <Button className="px-3 py-2" disabled={debt.remaining_amount <= 0} onClick={() => setPaying("new")}>
          Ghi nhận đợt mới
        </Button>
      </div>

      {installments.length === 0 ? (
        <Empty title="Chưa có đợt nào" body="Mỗi đợt sẽ tự trừ ví và cập nhật dòng tiền trong ngày." />
      ) : (
        <Card className="divide-y divide-[var(--line)]">
          {installments.map((item) => {
            const account = state.accounts.find((row) => row.id === item.account_id);
            return (
              <button key={item.id} type="button" onClick={() => setPaying(item)} className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left">
                <span>
                  <span className="block font-semibold">
                    Đợt {item.installment_number}
                    {item.is_final ? " · Tất toán" : ""}
                  </span>
                  <span className="mt-0.5 block text-sm text-[var(--muted)]">{formatLongDate(item.payment_date)}</span>
                  <span className="mt-1 inline-block rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium">
                    {account
                      ? account.name === accountTypeLabel[account.type]
                        ? accountTypeLabel[account.type]
                        : `${accountTypeLabel[account.type]} · ${account.name}`
                      : "Ví"}
                  </span>
                  {item.notes ? <span className="mt-1 block text-sm">{item.notes}</span> : null}
                </span>
                <Money value={item.amount} className="font-semibold" />
              </button>
            );
          })}
        </Card>
      )}

      <DebtForm open={editing} editing={debt} onClose={() => setEditing(false)} />
      <PaymentSheet
        key={paying === "new" ? "new" : paying?.id ?? "closed"}
        open={paying != null}
        debtId={debt.id}
        installment={paying && paying !== "new" ? paying : null}
        onClose={() => setPaying(null)}
      />
    </div>
  );
}

function PaymentSheet({
  open,
  debtId,
  installment,
  onClose,
}: {
  open: boolean;
  debtId: string;
  installment: DebtInstallment | null;
  onClose: () => void;
}) {
  const { state, today, actions } = useStore();
  const debt = state.debts.find((item) => item.id === debtId);
  const [digits, setDigits] = useState("");
  const [date, setDate] = useState(today);
  const [time, setTime] = useState(nowTime());
  const [accountId, setAccountId] = useState("");
  const [notes, setNotes] = useState("");
  const [finalPay, setFinalPay] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !debt) return;
    const cash = state.accounts.find((account) => account.is_active && account.type === "CASH") ?? state.accounts.find((account) => account.is_active);
    if (installment) {
      const tx = state.transactions.find((item) => item.id === installment.transaction_id);
      setDigits(String(installment.amount));
      setDate(installment.payment_date);
      setTime(tx?.transaction_time.slice(11, 16) || "12:00");
      setAccountId(installment.account_id);
      setNotes(installment.notes);
      setFinalPay(installment.is_final);
    } else {
      setDigits("");
      setDate(today);
      setTime(nowTime());
      setAccountId(cash?.id ?? "");
      setNotes("");
      setFinalPay(false);
    }
    setError("");
  }, [open, installment, debt, today, state.accounts, state.transactions]);

  if (!debt) return null;
  const others = debt.total_paid - (installment?.amount ?? 0);
  const cap = debt.principal_amount - others;

  const save = () => {
    const amount = Number(digits);
    if (!Number.isInteger(amount) || amount <= 0) {
      setError("Hãy nhập số tiền lớn hơn 0.");
      return;
    }
    if (installment) {
      const tx = state.transactions.find((item) => item.id === installment.transaction_id);
      if (!tx) {
        setError("Không tìm thấy giao dịch của đợt này.");
        return;
      }
      const result = actions.updateTransaction(tx.id, {
        transaction_time: combineDateTime(date, time),
        type: tx.type,
        category_id: tx.category_id,
        amount,
        account_id: accountId,
        item_detail: tx.item_detail,
        notes,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onClose();
      return;
    }
    const result = actions.addInstallment({
      debt_id: debt.id,
      amount,
      payment_date: date,
      payment_time: time,
      account_id: accountId,
      is_final: finalPay,
      notes,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onClose();
  };

  const remove = () => {
    if (!installment) return;
    if (!window.confirm("Xóa đợt này và giao dịch tương ứng trong sổ dòng tiền?")) return;
    const result = actions.deleteInstallment(installment.id);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onClose();
  };

  return (
    <Sheet open={open} title={installment ? `Sửa đợt ${installment.installment_number}` : "Đợt thanh toán mới"} onClose={onClose}>
      <div className="max-h-[calc(94dvh-57px)] space-y-4 overflow-y-auto px-4 py-4">
        <p className="text-sm text-[var(--muted)]">
          Còn lại {formatPlain(cap)} ₫. {debt.type === "PAYABLE" ? "Khoản này sẽ trừ ví và ghi chi Trả nợ vay." : "Khoản này sẽ cộng ví và ghi thu Thu hồi nợ."}
        </p>
        <button type="button" className="w-full rounded-3xl bg-[var(--brand-soft)] px-4 py-4 text-left">
          <span className="text-xs font-medium uppercase tracking-wider text-[var(--brand)]">Số tiền đợt này</span>
          <span className="tabular mt-1 block text-3xl font-semibold">{formatPlain(Number(digits || "0"))} ₫</span>
        </button>
        <div className="grid grid-cols-3 gap-2">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "000", "0", "⌫"].map((key) => (
            <button
              key={key}
              type="button"
              className="rounded-2xl bg-stone-100 py-3 text-lg font-semibold"
              onClick={() => {
                if (key === "⌫") setDigits((value) => value.slice(0, -1));
                else setDigits((value) => appendDigits(value, key));
              }}
            >
              {key === "⌫" ? <Delete className="mx-auto" size={18} /> : key}
            </button>
          ))}
        </div>
        <button type="button" className="w-full rounded-2xl bg-stone-100 py-3 text-sm font-semibold" onClick={() => setDigits((value) => appendDigits(value, "000000"))}>
          000.000
        </button>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-sm">
            Ngày thanh toán
            <input className="mt-1 w-full rounded-2xl border border-[var(--line)] bg-white px-3 py-3" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
          <label className="block text-sm">
            Giờ
            <input className="mt-1 w-full rounded-2xl border border-[var(--line)] bg-white px-3 py-3" type="time" value={time} onChange={(event) => setTime(event.target.value)} />
          </label>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium">Nguồn thanh toán</p>
          <div className="grid grid-cols-2 gap-2">
            {state.accounts.filter((account) => account.is_active).map((account) => (
              <button
                key={account.id}
                type="button"
                onClick={() => setAccountId(account.id)}
                className={cn(
                  "flex items-center gap-2 rounded-2xl border px-3 py-3 text-left text-sm font-medium",
                  accountId === account.id ? "border-[var(--brand)] bg-[var(--brand-soft)]" : "border-[var(--line)] bg-white",
                )}
              >
                <Icon name={account.icon} />
                {account.name}
              </button>
            ))}
          </div>
        </div>
        <label className="block text-sm">
          Ghi chú
          <input className="mt-1 w-full rounded-2xl border border-[var(--line)] bg-white px-3 py-3" value={notes} onChange={(event) => setNotes(event.target.value)} />
        </label>
        {installment ? null : (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={finalPay}
              onChange={(event) => {
                setFinalPay(event.target.checked);
                if (event.target.checked) setDigits(String(cap));
              }}
            />
            Đợt này tất toán khoản nợ
          </label>
        )}
        {error ? <Alert>{error}</Alert> : null}
        <div className="flex gap-2">
          {installment ? (
            <Button variant="danger" onClick={remove}>
              Xóa đợt
            </Button>
          ) : null}
          <Button className="flex-1" onClick={save}>
            Lưu đợt thanh toán
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
