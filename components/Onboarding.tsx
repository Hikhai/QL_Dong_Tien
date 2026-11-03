"use client";

import { useState } from "react";
import { useStore } from "@/components/Store";
import { Alert, Button, Field, fieldClass } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { formatPlain, formatVnd, parseSignedBalance } from "@/lib/format";
import { formatLongDate } from "@/lib/dates";

export function Onboarding() {
  const { state, today, actions } = useStore();
  const [date, setDate] = useState(today);
  const [balances, setBalances] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  const preview = state.accounts.reduce((sum, account) => {
    return sum + (parseSignedBalance(balances[account.id] ?? "") ?? 0);
  }, 0);

  const save = () => {
    const parsed: Record<string, number> = {};
    for (const account of state.accounts) {
      const amount = parseSignedBalance(balances[account.id] ?? "");
      if (amount == null) {
        setError("Số dư phải là số nguyên.");
        return;
      }
      parsed[account.id] = amount;
    }
    const result = actions.completeSetup({ anchorDate: date, balances: parsed });
    if (!result.ok) setError(result.error);
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-5 py-8">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--brand)]">Thu Chi</p>
      <h1 className="mt-2 text-3xl font-semibold leading-tight">Bắt đầu theo dõi dòng tiền</h1>
      <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
        Nhập số dư các ví tại thời điểm bắt đầu. Mỗi ngày sau đó lấy số dư cuối ngày hôm trước làm số dư đầu ngày.
      </p>

      <div className="mt-6 space-y-4">
        <Field label="Ngày bắt đầu" hint={date ? formatLongDate(date) : undefined}>
          <input className={fieldClass} type="date" value={date} max={today} onChange={(event) => setDate(event.target.value)} />
        </Field>
        {state.accounts.map((account) => (
          <Field key={account.id} label={account.name}>
            <div className="flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-white px-3">
              <span className="text-[var(--brand)]">
                <Icon name={account.icon} />
              </span>
              <input
                className="tabular w-full bg-transparent py-3 text-right text-lg outline-none"
                inputMode="numeric"
                placeholder="0"
                value={balances[account.id] ?? ""}
                onChange={(event) => {
                  const negative = event.target.value.trim().startsWith("-");
                  const digits = event.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
                  setBalances((current) => ({
                    ...current,
                    [account.id]: digits ? `${negative ? "-" : ""}${formatPlain(Number(digits))}` : negative ? "-" : "",
                  }));
                }}
              />
              <span className="text-sm text-[var(--muted)]">₫</span>
            </div>
          </Field>
        ))}
      </div>

      <div className="mt-5 rounded-3xl bg-[var(--brand)] px-4 py-4 text-white">
        <p className="text-xs uppercase tracking-wider text-white/75">Số dư đầu ngày bắt đầu</p>
        <p className="tabular mt-1 text-2xl font-semibold">{formatVnd(preview)}</p>
      </div>

      {error ? <div className="mt-4"><Alert>{error}</Alert></div> : null}

      <Button className="mt-6 w-full" onClick={save}>
        Bắt đầu theo dõi
      </Button>
    </div>
  );
}
