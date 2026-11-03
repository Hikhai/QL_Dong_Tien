"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@/components/Icon";
import { QuickAdd } from "@/components/QuickAdd";
import { useStore } from "@/components/Store";
import { Card, Money, cn, fieldClass } from "@/components/ui";
import { accountTypeLabel } from "@/lib/defaults";
import { formatLongDate, formatTime } from "@/lib/dates";
import { accountSnapshots } from "@/lib/finance";
import { formatPlain } from "@/lib/format";
import type { AccountChange, Transaction, TransactionType } from "@/lib/types";

type HistoryFilter = "ALL" | TransactionType | "WALLET";

const filters: Array<{ id: HistoryFilter; label: string }> = [
  { id: "ALL", label: "Tất cả" },
  { id: "INCOME", label: "Thu" },
  { id: "EXPENSE", label: "Chi" },
  { id: "TRANSFER", label: "Chuyển" },
  { id: "WALLET", label: "Sửa ví" },
];

type HistoryItem =
  | { kind: "tx"; id: string; at: string; date: string; tx: Transaction }
  | { kind: "wallet"; id: string; at: string; date: string; change: AccountChange };

export function HistoryScreen() {
  const { state } = useStore();
  const router = useRouter();
  const search = useSearchParams();
  const walletId = search.get("wallet") ?? "ALL";
  const [filter, setFilter] = useState<HistoryFilter>("ALL");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Transaction | null>(null);
  const snaps = accountSnapshots(state.accounts, state.transactions);
  const selected = snaps.find((snap) => snap.account.id === walletId) ?? null;

  const chooseWallet = (id: string) => {
    const next = new URLSearchParams(search.toString());
    if (id === "ALL") next.delete("wallet");
    else next.set("wallet", id);
    const queryText = next.toString();
    router.replace(queryText ? `/history?${queryText}` : "/history");
  };

  const items = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const transactions: HistoryItem[] =
      filter === "WALLET"
        ? []
        : state.transactions
            .filter((tx) => filter === "ALL" || tx.type === filter)
            .filter((tx) => walletId === "ALL" || tx.account_id === walletId || tx.destination_account_id === walletId)
            .filter((tx) => {
              if (!needle) return true;
              const category = state.categories.find((item) => item.id === tx.category_id);
              const account = state.accounts.find((item) => item.id === tx.account_id);
              const destination = state.accounts.find((item) => item.id === tx.destination_account_id);
              return [tx.item_detail, tx.notes, category?.name, account?.name, destination?.name]
                .filter(Boolean)
                .some((value) => value!.toLowerCase().includes(needle));
            })
            .map((tx) => ({ kind: "tx" as const, id: tx.id, at: tx.transaction_time, date: tx.date, tx }));
    const changes: HistoryItem[] =
      filter !== "ALL" && filter !== "WALLET"
        ? []
        : (state.accountChanges ?? [])
            .filter((change) => walletId === "ALL" || change.account_id === walletId)
            .filter((change) => {
              if (!needle) return true;
              const account = state.accounts.find((item) => item.id === change.account_id);
              return [change.summary, account?.name].filter(Boolean).some((value) => value!.toLowerCase().includes(needle));
            })
            .map((change) => ({
              kind: "wallet" as const,
              id: change.id,
              at: change.at,
              date: change.at.slice(0, 10),
              change,
            }));
    return [...transactions, ...changes].sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id));
  }, [filter, query, state.accountChanges, state.accounts, state.categories, state.transactions, walletId]);

  const groups = useMemo(() => {
    const map = new Map<string, HistoryItem[]>();
    for (const item of items) {
      const list = map.get(item.date) ?? [];
      list.push(item);
      map.set(item.date, list);
    }
    return [...map.entries()];
  }, [items]);

  const txCount = items.filter((item) => item.kind === "tx").length;
  const walletCount = items.filter((item) => item.kind === "wallet").length;

  return (
    <div className="space-y-4">
      <input
        className={fieldClass}
        value={query}
        placeholder="Tìm khoản, ghi chú hoặc ví"
        onChange={(event) => setQuery(event.target.value)}
      />
      <div className="flex gap-2 overflow-x-auto">
        {filters.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFilter(item.id)}
            className={cn(
              "tap shrink-0 rounded-full px-4 py-2 text-sm font-semibold",
              filter === item.id ? "bg-[var(--brand)] text-white" : "bg-white text-[var(--ink)]",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="flex gap-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => chooseWallet("ALL")}
          className={cn(
            "tap shrink-0 rounded-full px-4 py-2 text-sm font-semibold",
            walletId === "ALL" ? "bg-[var(--brand)] text-white" : "bg-white text-[var(--ink)]",
          )}
        >
          Mọi ví
        </button>
        {snaps.map((snap) => (
          <button
            key={snap.account.id}
            type="button"
            onClick={() => chooseWallet(snap.account.id)}
            className={cn(
              "tap shrink-0 rounded-full px-4 py-2 text-sm font-semibold",
              walletId === snap.account.id ? "bg-[var(--brand)] text-white" : "bg-white text-[var(--ink)]",
            )}
          >
            {snap.account.name}
          </button>
        ))}
      </div>
      <div key={`${filter}:${walletId}`} className="rise space-y-4">
        {selected ? (
          <Card className="space-y-1 p-4">
            <p className="text-xs text-[var(--muted)]">Số dư hiện tại · {selected.account.name}</p>
            <Money value={selected.balance} className="block text-2xl font-semibold" />
            <p className="text-xs leading-relaxed text-[var(--muted)]">
              {`${formatPlain(selected.opening)} ₫ ban đầu + ${formatPlain(selected.income)} ₫ thu − ${formatPlain(selected.expense)} ₫ chi${
                selected.transferIn || selected.transferOut
                  ? ` + ${formatPlain(selected.transferIn)} ₫ chuyển đến − ${formatPlain(selected.transferOut)} ₫ chuyển đi`
                  : ""
              }.`}
            </p>
          </Card>
        ) : null}
        <p className="text-sm text-[var(--muted)]">{historyCaption(filter, txCount, walletCount, selected?.account.name)}</p>
        {groups.length === 0 ? (
          <Card className="px-4 py-8 text-center text-sm text-[var(--muted)]">
            {filter === "WALLET" ? "Chưa có lần sửa ví nào." : "Không có mục nào khớp bộ lọc."}
          </Card>
        ) : (
          groups.map(([date, rows]) => (
            <section key={date} className="space-y-2">
              <h2 className="text-sm font-semibold text-[var(--muted)]">{formatLongDate(date)}</h2>
              <Card className="divide-y divide-[var(--line)] px-3">
                {rows.map((item) =>
                  item.kind === "tx" ? (
                    <HistoryRow key={item.id} tx={item.tx} walletId={walletId} onEdit={() => setEditing(item.tx)} />
                  ) : (
                    <WalletChangeRow key={item.id} change={item.change} />
                  ),
                )}
              </Card>
            </section>
          ))
        )}
      </div>
      <QuickAdd open={editing != null} onClose={() => setEditing(null)} date={editing?.date ?? state.settings.anchorDate ?? ""} editing={editing} />
    </div>
  );
}

function HistoryRow({ tx, walletId, onEdit }: { tx: Transaction; walletId: string; onEdit: () => void }) {
  const { state } = useStore();
  const category = state.categories.find((item) => item.id === tx.category_id);
  const account = state.accounts.find((item) => item.id === tx.account_id);
  const destination = state.accounts.find((item) => item.id === tx.destination_account_id);
  const amount =
    walletId !== "ALL" && tx.destination_account_id === walletId
      ? tx.amount
      : walletId !== "ALL" && tx.account_id === walletId && tx.type !== "INCOME"
        ? -tx.amount
        : tx.type === "EXPENSE"
          ? -tx.amount
          : tx.amount;
  const signed = walletId !== "ALL" || tx.type !== "TRANSFER";
  const wallet = account
    ? account.name === accountTypeLabel[account.type]
      ? accountTypeLabel[account.type]
      : account.name
    : "Ví";

  return (
    <button type="button" onClick={onEdit} className="flex w-full items-center gap-3 py-3 text-left">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-white" style={{ background: category?.color ?? "#57534e" }}>
        <Icon name={category?.icon ?? (tx.type === "TRANSFER" ? "arrow-left-right" : "wallet")} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate font-semibold">{tx.type === "TRANSFER" ? "Chuyển tiền" : category?.name ?? tx.item_detail}</span>
          <span className="text-xs text-[var(--muted)]">{formatTime(tx.transaction_time)}</span>
        </span>
        <span className="mt-0.5 block truncate text-sm text-[var(--muted)]">{tx.item_detail}</span>
        <span className="mt-1 block text-[11px] text-[var(--muted)]">
          {wallet}
          {destination ? ` → ${destination.name}` : ""}
        </span>
      </span>
      <Money value={signed ? amount : tx.amount} signed={signed} className="shrink-0 text-sm font-semibold" />
    </button>
  );
}

function historyCaption(filter: HistoryFilter, txCount: number, walletCount: number, walletName?: string): string {
  const parts: string[] = [];
  if (filter !== "WALLET") parts.push(`${txCount} giao dịch`);
  if (filter === "WALLET" || walletCount > 0) parts.push(`${walletCount} lần sửa ví`);
  const text = parts.join(", ");
  return walletName ? `${text} của ${walletName}` : text;
}

function walletTitle(change: AccountChange): string {
  if (change.action === "UPDATE") return "Sửa ví";
  if (change.summary.startsWith("Tạo ví")) return "Tạo ví";
  return "Số dư ban đầu";
}

function WalletChangeRow({ change }: { change: AccountChange }) {
  const { state } = useStore();
  const account = state.accounts.find((item) => item.id === change.account_id);
  return (
    <div className="flex w-full items-center gap-3 py-3 text-left">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand)]">
        <Icon name={account?.icon ?? "landmark"} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate font-semibold">{walletTitle(change)}</span>
          <span className="text-xs text-[var(--muted)]">{formatTime(change.at)}</span>
        </span>
        <span className="mt-0.5 block text-sm leading-relaxed text-[var(--muted)]">{change.summary}</span>
        <span className="mt-1 block text-[11px] text-[var(--muted)]">{account?.name ?? "Ví đã xóa"}</span>
      </span>
    </div>
  );
}
