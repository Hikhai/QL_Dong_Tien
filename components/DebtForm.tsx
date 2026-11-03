"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/components/Store";
import { Alert, Button, Field, Sheet, cn, fieldClass } from "@/components/ui";
import { digitsOnly, formatPlain } from "@/lib/format";
import type { Debt, DebtType } from "@/lib/types";

export function DebtForm({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  editing?: Debt | null;
}) {
  const { state, today, actions } = useStore();
  const [type, setType] = useState<DebtType>("PAYABLE");
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [purpose, setPurpose] = useState("");
  const [start, setStart] = useState(today);
  const [due, setDue] = useState(today);
  const [digits, setDigits] = useState("");
  const [notes, setNotes] = useState("");
  const [disburse, setDisburse] = useState(false);
  const [accountId, setAccountId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    const bank = state.accounts.find((account) => account.is_active && account.type === "BANK") ?? state.accounts.find((account) => account.is_active);
    if (editing) {
      setType(editing.type);
      setName(editing.counterparty_name);
      setContact(editing.counterparty_contact);
      setPurpose(editing.purpose);
      setStart(editing.start_date);
      setDue(editing.due_date);
      setDigits(String(editing.principal_amount));
      setNotes(editing.notes);
      setDisburse(false);
      setAccountId(bank?.id ?? "");
      return;
    }
    setType("PAYABLE");
    setName("");
    setContact("");
    setPurpose("");
    setStart(today);
    setDue(today);
    setDigits("");
    setNotes("");
    setDisburse(false);
    setAccountId(bank?.id ?? "");
  }, [open, editing, today, state.accounts]);

  const save = () => {
    const principal = Number(digits);
    const payload = {
      type,
      counterparty_name: name,
      counterparty_contact: contact,
      purpose,
      start_date: start,
      due_date: due,
      principal_amount: principal,
      notes,
    };
    const result = editing
      ? actions.updateDebt(editing.id, payload)
      : actions.addDebt({ ...payload, recordDisbursement: disburse, account_id: accountId });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onClose();
  };

  return (
    <Sheet open={open} title={editing ? `Sửa ${editing.debt_code}` : "Thêm khoản nợ"} onClose={onClose}>
      <div className="space-y-4 overflow-y-auto px-4 py-4">
        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-stone-100 p-1">
          {(
            [
              ["PAYABLE", "Phải trả"],
              ["RECEIVABLE", "Phải thu"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setType(value)}
              className={cn("rounded-xl py-2 text-sm font-semibold", type === value ? "bg-white shadow-sm" : "text-[var(--muted)]")}
            >
              {label}
            </button>
          ))}
        </div>
        <Field label={type === "PAYABLE" ? "Chủ nợ" : "Người vay"}>
          <input className={fieldClass} value={name} onChange={(event) => setName(event.target.value)} placeholder="Anh Minh" />
        </Field>
        <Field label="Liên hệ">
          <input className={fieldClass} value={contact} onChange={(event) => setContact(event.target.value)} placeholder="Số điện thoại" />
        </Field>
        <Field label="Mục đích">
          <input className={fieldClass} value={purpose} onChange={(event) => setPurpose(event.target.value)} placeholder="Mua laptop trả góp, bạn mượn gấp…" />
        </Field>
        <Field label="Số tiền gốc">
          <input
            className={`${fieldClass} tabular text-right text-lg`}
            inputMode="numeric"
            value={digits ? formatPlain(Number(digits)) : ""}
            placeholder="0"
            onChange={(event) => setDigits(digitsOnly(event.target.value).slice(0, 12))}
          />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Ngày phát sinh">
            <input className={fieldClass} type="date" value={start} onChange={(event) => setStart(event.target.value)} />
          </Field>
          <Field label="Hạn tất toán">
            <input className={fieldClass} type="date" value={due} onChange={(event) => setDue(event.target.value)} />
          </Field>
        </div>
        <Field label="Ghi chú">
          <textarea className={fieldClass} rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </Field>
        {editing ? null : (
          <div className="space-y-2 rounded-2xl bg-stone-50 p-3">
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={disburse} onChange={(event) => setDisburse(event.target.checked)} />
              <span>
                Ghi nhận giải ngân vào dòng tiền
                <span className="mt-1 block text-xs text-[var(--muted)]">
                  {type === "PAYABLE"
                    ? "Bạn nhận tiền vay: cộng vào ví như một khoản thu."
                    : "Bạn đưa tiền cho vay: trừ ví như một khoản chi."}
                </span>
              </span>
            </label>
            {disburse ? (
              <select className={fieldClass} value={accountId} onChange={(event) => setAccountId(event.target.value)}>
                {state.accounts.filter((account) => account.is_active).map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
        )}
        {error ? <Alert>{error}</Alert> : null}
        <Button className="w-full" onClick={save}>
          Lưu khoản nợ
        </Button>
      </div>
    </Sheet>
  );
}
