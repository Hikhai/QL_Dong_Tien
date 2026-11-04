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
import type { Activity, Transaction, TransactionType } from "@/lib/types";

type HistoryFilter = "ALL" | TransactionType | "WALLET" | "EDIT";

const filters: Array<{ id: HistoryFilter; label: string }> = [
  { id: "ALL", label: "Tất cả" },
  { id: "INCOME", label: "Thu" },
  { id: "EXPENSE", label: "Chi" },
  { id: "TRANSFER", label: "Chuyển" },
  { id: "EDIT", label: "Đã sửa" },
  { id: "WALLET", label: "Sửa ví" },
];

type HistoryItem =
  | { kind: "tx"; id: string; at: string; date: string; tx: Transaction }
  | { kind: "log"; id: string; at: string; date: string; entry: Activity };

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
    const showTx = filter === "ALL" || filter === "INCOME" || filter === "EXPENSE" || filter === "TRANSFER";
    const transactions: HistoryItem[] = showTx
      ? state.transactions
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
          .map((tx) => ({ kind: "tx" as const, id: tx.id, at: tx.transaction_time, date: tx.date, tx }))
      : [];
    const logs: HistoryItem[] =
      filter === "INCOME" || filter === "EXPENSE" || filter === "TRANSFER"
        ? []
        : (state.activity ?? [])
            .filter((entry) => !(entry.kind === "TX" && entry.action === "CREATE"))
            .filter((entry) => (filter === "EDIT" ? entry.action === "UPDATE" || entry.action === "DELETE" : true))
            .filter((entry) => (filter === "WALLET" ? entry.kind === "WALLET" : true))
            .filter((entry) => matchesWallet(entry, walletId, state.transactions))
            .filter((entry) => !needle || entry.summary.toLowerCase().includes(needle))
            .map((entry) => ({
              kind: "log" as const,
              id: entry.id,
              at: entry.at,
              date: entry.at.slice(0, 10),
              entry,
            }));
    return [...transactions, ...logs].sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id));
  }, [filter, query, state.activity, state.accounts, state.categories, state.transactions, walletId]);

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
  const editCount = items.filter((item) => item.kind === "log" && (item.entry.action === "UPDATE" || item.entry.action === "DELETE")).length;

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
        <p className="text-sm text-[var(--muted)]">{historyCaption(filter, txCount, editCount, selected?.account.name)}</p>
        <p className="text-xs leading-relaxed text-[var(--muted)]">Chạm một giao dịch để sửa. Số thu, số chi và số dư được tính lại từ số tiền mới.</p>
        {groups.length === 0 ? (
          <Card className="px-4 py-8 text-center text-sm text-[var(--muted)]">
            {filter === "WALLET" ? "Chưa có lần sửa ví nào." : filter === "EDIT" ? "Chưa có lần sửa hoặc xóa nào." : "Không có mục nào khớp bộ lọc."}
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
                    <ActivityRow key={item.id} entry={item.entry} />
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
          {" · Sửa"}
        </span>
      </span>
      <Money value={signed ? amount : tx.amount} signed={signed} className="shrink-0 text-sm font-semibold" />
    </button>
  );
}

function matchesWallet(entry: Activity, walletId: string, transactions: Transaction[]): boolean {
  if (walletId === "ALL") return true;
  if (entry.kind === "WALLET") return entry.target_id === walletId;
  if (entry.kind !== "TX") return false;
  const tx = transactions.find((item) => item.id === entry.target_id);
  return tx?.account_id === walletId || tx?.destination_account_id === walletId;
}

function historyCaption(filter: HistoryFilter, txCount: number, editCount: number, walletName?: string): string {
  const parts: string[] = [];
  if (filter !== "WALLET" && filter !== "EDIT") parts.push(`${txCount} giao dịch`);
  if (filter === "ALL" || filter === "EDIT" || filter === "WALLET") parts.push(`${editCount} lần sửa hoặc xóa`);
  const text = parts.join(", ");
  return walletName ? `${text} của ${walletName}` : text;
}

function activityTitle(entry: Activity): string {
  if (entry.kind === "WALLET" && entry.action === "CREATE" && entry.summary.startsWith("Ghi số dư")) return "Số dư ban đầu";
  if (entry.kind === "WALLET" && entry.action === "CREATE") return "Tạo ví";
  if (entry.action === "DELETE") return "Đã xóa";
  if (entry.action === "CREATE") return "Đã thêm";
  return "Đã sửa";
}

function ActivityRow({ entry }: { entry: Activity }) {
  const { state } = useStore();
  const account = entry.kind === "WALLET" ? state.accounts.find((item) => item.id === entry.target_id) : undefined;
  return (
    <div className="flex w-full items-center gap-3 py-3 text-left">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand)]">
        <Icon name={account?.icon ?? "scroll-text"} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate font-semibold">{activityTitle(entry)}</span>
          <span className="text-xs text-[var(--muted)]">{formatTime(entry.at)}</span>
        </span>
        <span className="mt-0.5 block text-sm leading-relaxed text-[var(--muted)]">{entry.summary}</span>
        {account ? <span className="mt-1 block text-[11px] text-[var(--muted)]">{account.name}</span> : null}
      </span>
    </div>
  );
}
