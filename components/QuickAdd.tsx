"use client";

import { useMemo, useState } from "react";
import { Delete } from "lucide-react";
import { Icon } from "@/components/Icon";
import { useStore } from "@/components/Store";
import { Alert, Button, Sheet, cn, fieldClass } from "@/components/ui";
import { quickCategoryCodes } from "@/lib/defaults";
import { combineDateTime, formatTime, nowTime } from "@/lib/dates";
import { appendDigits, formatPlain } from "@/lib/format";
import type { Transaction, TransactionType } from "@/lib/types";

type Draft = {
  type: TransactionType;
  digits: string;
  categoryId: string;
  accountId: string;
  destinationId: string;
  detail: string;
  notes: string;
  date: string;
  time: string;
};

function preferAccount(accounts: { id: string; type: string; is_active: boolean }[], kind: "BANK" | "CASH") {
  return accounts.find((account) => account.is_active && account.type === kind) ?? accounts.find((account) => account.is_active);
}

export function QuickAdd({
  open,
  onClose,
  date,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  date: string;
  editing?: Transaction | null;
}) {
  const { state, today, actions } = useStore();
  const signature = open ? `${editing?.id ?? "new"}|${date}` : "closed";
  const [seen, setSeen] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState("");
  const [padOn, setPadOn] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const locked = Boolean(editing?.debt_installment_id);

  if (seen !== signature) {
    setSeen(signature);
    setError("");
    setPadOn(true);
    setShowAll(false);
    if (!open) {
      setDraft(null);
    } else if (editing) {
      setDraft({
        type: editing.type,
        digits: String(editing.amount),
        categoryId: editing.category_id ?? "",
        accountId: editing.account_id,
        destinationId: editing.destination_account_id ?? "",
        detail: editing.item_detail,
        notes: editing.notes,
        date: editing.date,
        time: formatTime(editing.transaction_time) || "12:00",
      });
    } else {
      const food = state.categories.find((category) => category.code === "food");
      const cash = preferAccount(state.accounts, "CASH");
      setDraft({
        type: "EXPENSE",
        digits: "",
        categoryId: food?.id ?? "",
        accountId: cash?.id ?? "",
        destinationId: "",
        detail: "",
        notes: "",
        date,
        time: date === today ? nowTime() : "12:00",
      });
    }
  }

  const activeAccounts = state.accounts.filter((account) => account.is_active);
  const categories = useMemo(() => {
    if (!draft || draft.type === "TRANSFER") return [];
    return state.categories.filter((category) => category.type === draft.type && !category.hidden);
  }, [draft, state.categories]);

  if (!draft) return null;

  const chips =
    draft.type === "EXPENSE"
      ? categories.filter((category) => quickCategoryCodes.includes(category.code))
      : categories.filter((category) => ["salary", "bonus", "other_income"].includes(category.code));

  const changeType = (type: TransactionType) => {
    if (locked) return;
    setDraft((current) => {
      if (!current) return current;
      if (type === "TRANSFER") return { ...current, type };
      const pool = state.categories.filter((category) => category.type === type && !category.hidden);
      const preferred =
        type === "INCOME"
          ? (pool.find((category) => category.code === "salary") ?? pool[0])
          : (pool.find((category) => category.code === "food") ?? pool[0]);
      const account =
        type === "INCOME" ? preferAccount(state.accounts, "BANK") : preferAccount(state.accounts, "CASH");
      return {
        ...current,
        type,
        categoryId: preferred?.id ?? "",
        accountId: account?.id ?? current.accountId,
      };
    });
  };

  const pushDigits = (extra: string) => {
    setPadOn(true);
    setDraft((current) => (current ? { ...current, digits: appendDigits(current.digits, extra) } : current));
  };

  const save = () => {
    const amount = Number(draft.digits);
    if (!draft.digits || !Number.isInteger(amount) || amount <= 0) {
      setError("Hãy nhập số tiền lớn hơn 0.");
      return;
    }
    const payload = {
      transaction_time: combineDateTime(draft.date, draft.time),
      type: draft.type,
      category_id: draft.type === "TRANSFER" ? null : draft.categoryId,
      amount,
      account_id: draft.accountId,
      destination_account_id: draft.type === "TRANSFER" ? draft.destinationId : null,
      item_detail: draft.detail,
      notes: draft.notes,
    };
    const result = editing ? actions.updateTransaction(editing.id, payload) : actions.addTransaction(payload);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onClose();
  };

  const remove = () => {
    if (!editing) return;
    if (!window.confirm("Xóa giao dịch này? Số dư các ngày sau sẽ được tính lại.")) return;
    const result = actions.deleteTransaction(editing.id);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onClose();
  };

  return (
    <Sheet open={open} title={editing ? "Sửa giao dịch" : "Thêm giao dịch"} onClose={onClose}>
      <div className="flex max-h-[calc(94dvh-57px)] flex-col">
        <div className="space-y-4 overflow-y-auto px-4 py-4">
          {locked ? (
            <p className="rounded-2xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Giao dịch gắn với đợt trả nợ. Sửa số tiền, ngày hoặc ví sẽ cập nhật luôn dư nợ.
            </p>
          ) : null}
          <div className="grid grid-cols-3 gap-2 rounded-2xl bg-stone-100 p-1">
            {(
              [
                ["EXPENSE", "Chi"],
                ["INCOME", "Thu"],
                ["TRANSFER", "Chuyển"],
              ] as const
            ).map(([type, label]) => (
              <button
                key={type}
                type="button"
                disabled={locked}
                onClick={() => changeType(type)}
                className={cn(
                  "rounded-xl py-2 text-sm font-semibold",
                  draft.type === type ? "bg-white shadow-sm" : "text-[var(--muted)]",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <button type="button" onClick={() => setPadOn(true)} className="w-full rounded-3xl bg-[var(--brand-soft)] px-4 py-4 text-left">
            <span className="text-xs font-medium uppercase tracking-wider text-[var(--brand)]">Số tiền</span>
            <span className="tabular mt-1 block text-3xl font-semibold text-[var(--ink)]">
              {formatPlain(Number(draft.digits || "0"))} ₫
            </span>
          </button>

          {draft.type !== "TRANSFER" ? (
            <div>
              <p className="mb-2 text-sm font-medium">Danh mục</p>
              <div className="flex gap-3 overflow-x-auto px-1 py-1">
                {chips.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => setDraft({ ...draft, categoryId: category.id })}
                    className={cn(
                      "flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium text-white",
                      draft.categoryId === category.id ? "ring-2 ring-[var(--brand)] ring-offset-2" : "opacity-90",
                    )}
                    style={{ background: category.color }}
                  >
                    <Icon name={category.icon} size={16} />
                    {category.name}
                  </button>
                ))}
                <button type="button" onClick={() => setShowAll((value) => !value)} className="shrink-0 rounded-full bg-stone-200 px-4 py-2.5 text-sm font-medium">
                  {showAll ? "Thu gọn" : "Khác"}
                </button>
              </div>
              {showAll ? (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {categories.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => setDraft({ ...draft, categoryId: category.id })}
                      className={cn(
                        "flex items-center gap-2 rounded-2xl border px-3 py-2 text-left text-sm",
                        draft.categoryId === category.id ? "border-[var(--brand)] bg-[var(--brand-soft)]" : "border-[var(--line)] bg-white",
                      )}
                    >
                      <span className="grid h-8 w-8 place-items-center rounded-full text-white" style={{ background: category.color }}>
                        <Icon name={category.icon} size={15} />
                      </span>
                      {category.name}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          <div>
            <p className="mb-2 text-sm font-medium">{draft.type === "TRANSFER" ? "Từ ví" : "Nguồn tiền"}</p>
            <div className="grid grid-cols-2 gap-2">
              {activeAccounts.map((account) => (
                <button
                  key={account.id}
                  type="button"
                  onClick={() => setDraft({ ...draft, accountId: account.id })}
                  className={cn(
                    "flex items-center gap-2 rounded-2xl border px-3 py-3 text-left text-sm font-medium",
                    draft.accountId === account.id ? "border-[var(--brand)] bg-[var(--brand-soft)]" : "border-[var(--line)] bg-white",
                  )}
                  aria-pressed={draft.accountId === account.id}
                >
                  <Icon name={account.icon} />
                  {account.name}
                </button>
              ))}
            </div>
          </div>

          {draft.type === "TRANSFER" ? (
            <div>
              <p className="mb-2 text-sm font-medium">Đến ví</p>
              <div className="grid grid-cols-2 gap-2">
                {activeAccounts.map((account) => (
                  <button
                    key={account.id}
                    type="button"
                    onClick={() => setDraft({ ...draft, destinationId: account.id })}
                    className={cn(
                      "flex items-center gap-2 rounded-2xl border px-3 py-3 text-left text-sm font-medium",
                      draft.destinationId === account.id ? "border-[var(--brand)] bg-[var(--brand-soft)]" : "border-[var(--line)] bg-white",
                    )}
                  >
                    <Icon name={account.icon} />
                    {account.name}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Khoản chi tiết</span>
            <input
              className={fieldClass}
              placeholder="Đi ăn trưa, uống nước mía, đổ xăng…"
              value={draft.detail}
              onFocus={() => setPadOn(false)}
              onChange={(event) => setDraft({ ...draft, detail: event.target.value })}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Ghi chú</span>
            <input
              className={fieldClass}
              value={draft.notes}
              onFocus={() => setPadOn(false)}
              onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Ngày</span>
              <input className={fieldClass} type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Giờ</span>
              <input className={fieldClass} type="time" value={draft.time} onChange={(event) => setDraft({ ...draft, time: event.target.value })} />
            </label>
          </div>
          {error ? <Alert>{error}</Alert> : null}
        </div>

        <div className="border-t border-[var(--line)] bg-[var(--card)] px-4 py-3">
          {padOn ? (
            <div className="mb-3 space-y-2">
              <div className="grid grid-cols-3 gap-2">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9", "000", "0", "⌫"].map((key) => (
                  <button
                    key={key}
                    type="button"
                    className="rounded-2xl bg-stone-100 py-3 text-lg font-semibold active:bg-stone-200"
                    onClick={() => {
                      if (key === "⌫") setDraft({ ...draft, digits: draft.digits.slice(0, -1) });
                      else pushDigits(key);
                    }}
                  >
                    {key === "⌫" ? <Delete className="mx-auto" size={18} /> : key}
                  </button>
                ))}
              </div>
              <button type="button" className="w-full rounded-2xl bg-stone-100 py-3 text-sm font-semibold" onClick={() => pushDigits("000000")}>
                000.000
              </button>
            </div>
          ) : (
            <button type="button" className="mb-3 w-full rounded-2xl bg-stone-100 py-3 text-sm font-semibold" onClick={() => setPadOn(true)}>
              Hiện bàn phím số
            </button>
          )}
          <div className="flex gap-2">
            {editing ? (
              <Button variant="danger" className="shrink-0" onClick={remove}>
                Xóa
              </Button>
            ) : null}
            <Button className="flex-1" onClick={save}>
              Lưu giao dịch
            </Button>
          </div>
        </div>
      </div>
    </Sheet>
  );
}
