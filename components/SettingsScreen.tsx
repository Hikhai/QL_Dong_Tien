"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Icon, iconOptions } from "@/components/Icon";
import { useStore } from "@/components/Store";
import { confirmPassword } from "@/lib/localDb";
import { Alert, Button, Card, Field, Sheet, cn, fieldClass } from "@/components/ui";
import { accountTypeLabel, groupMeta } from "@/lib/defaults";
import { addDays, formatLongDate } from "@/lib/dates";
import { accountSnapshots } from "@/lib/finance";
import { digitsOnly, formatPlain, formatVnd, parseSignedBalance } from "@/lib/format";
import type { Account, AccountType, Category, CategoryGroup, CategoryType } from "@/lib/types";

const colors = ["#1f6b4a", "#157a45", "#0f766e", "#0284c7", "#1d4ed8", "#7c3aed", "#be123c", "#c2410c", "#b45309", "#92400e", "#64748b", "#9a3412"];
const incomeGroups: CategoryGroup[] = ["ACTIVE_INCOME", "BONUS_COMMISSION", "OTHER_INCOME"];
const expenseGroups: CategoryGroup[] = ["NEEDS", "WANTS", "SAVINGS_DEBT"];

export function SettingsScreen() {
  const { state, today, user, actions } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [anchor, setAnchor] = useState(state.settings.anchorDate ?? today);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [accountEdit, setAccountEdit] = useState<Account | "new" | null>(null);
  const [categoryEdit, setCategoryEdit] = useState<Category | "new" | null>(null);
  const snaps = accountSnapshots(state.accounts, state.transactions);

  const saveAnchor = () => {
    const result = actions.setAnchorDate(anchor);
    if (!result.ok) setError(result.error);
    else {
      setError("");
      setMessage("Đã cập nhật ngày bắt đầu. Số dư các ngày được tính lại.");
    }
  };

  const exportBook = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `thu-chi-${today}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <Card className="flex items-center justify-between gap-3 p-4">
        <div>
          <p className="text-xs text-[var(--muted)]">Đang đăng nhập</p>
          <p className="font-semibold">{user.username}</p>
        </div>
        <Button variant="soft" onClick={() => void actions.logout()}>
          Đăng xuất
        </Button>
      </Card>
      <Card className="space-y-3 p-4">
        <h2 className="font-semibold">Mốc số dư</h2>
        <p className="text-sm text-[var(--muted)]">
          Số dư đầu ngày bắt đầu bằng tổng số dư ban đầu của các ví
          {state.settings.anchorDate ? ` (${formatLongDate(state.settings.anchorDate)})` : ""}. Đổi mốc sẽ tính lại toàn bộ chuỗi ngày phía sau.
        </p>
        <Field label="Ngày bắt đầu theo dõi">
          <input className={fieldClass} type="date" value={anchor} max={addDays(today, 7)} onChange={(event) => setAnchor(event.target.value)} />
        </Field>
        <Button variant="soft" onClick={saveAnchor}>
          Lưu ngày bắt đầu
        </Button>
      </Card>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Ví và tài khoản</h2>
          <button type="button" className="text-sm font-semibold text-[var(--brand)]" onClick={() => setAccountEdit("new")}>
            Thêm ví
          </button>
        </div>
        {snaps.map((snap) => (
          <Card key={snap.account.id} className="flex items-center gap-3 p-4">
            <button type="button" onClick={() => setAccountEdit(snap.account)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand)]">
                <Icon name={snap.account.icon} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">
                  {snap.account.name}
                  {snap.account.is_active ? "" : " · Không ghi giao dịch mới"}
                </span>
                <span className="block text-xs text-[var(--muted)]">
                  {accountTypeLabel[snap.account.type]} · Thu {formatPlain(snap.income)} · Chi {formatPlain(snap.expense)}
                </span>
                <span className="tabular mt-1 block text-sm font-semibold">{formatVnd(snap.balance)}</span>
              </span>
            </button>
            <Link href={`/history?wallet=${snap.account.id}`} className="shrink-0 text-xs font-semibold text-[var(--brand)]">
              Lịch sử
            </Link>
          </Card>
        ))}
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Danh mục</h2>
          <button type="button" className="text-sm font-semibold text-[var(--brand)]" onClick={() => setCategoryEdit("new")}>
            Thêm danh mục
          </button>
        </div>
        {state.categories
          .filter((category) => !category.hidden)
          .sort((a, b) => a.sort - b.sort)
          .map((category) => (
            <button key={category.id} type="button" onClick={() => setCategoryEdit(category)} className="flex w-full items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--card)] px-3 py-2 text-left">
              <span className="grid h-9 w-9 place-items-center rounded-xl text-white" style={{ background: category.color }}>
                <Icon name={category.icon} size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{category.name}</span>
                <span className="block text-xs text-[var(--muted)]">
                  {category.type === "INCOME" ? "Thu" : "Chi"} · {groupMeta[category.group].label}
                </span>
              </span>
            </button>
          ))}
      </section>

      <Card className="space-y-3 p-4">
        <h2 className="font-semibold">Sao lưu tệp</h2>
        <p className="text-sm text-[var(--muted)]">Sổ này gắn với tài khoản đang đăng nhập. Xuất tệp JSON nếu muốn giữ một bản riêng.</p>
        <div className="flex gap-2">
          <Button variant="soft" className="flex-1" onClick={exportBook}>
            Xuất sổ
          </Button>
          <Button variant="soft" className="flex-1" onClick={() => fileRef.current?.click()}>
            Nhập sổ
          </Button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            try {
              const result = actions.replaceAll(JSON.parse(await file.text()));
              setError("");
              setMessage(result.ok ? "Đã khôi phục sổ." : result.error);
            } catch {
              setError("Không đọc được tệp.");
            }
          }}
        />
        <Button
          variant="danger"
          onClick={() => {
            if (!window.confirm("Xóa toàn bộ dữ liệu trên máy này?")) return;
            actions.reset();
          }}
        >
          Xóa toàn bộ dữ liệu
        </Button>
      </Card>
      {error ? <Alert>{error}</Alert> : null}
      {message ? <p className="rise rounded-2xl bg-[var(--brand-soft)] px-3 py-2 text-sm text-[var(--brand-dark)]">{message}</p> : null}

      <AccountSheet
        target={accountEdit}
        onClose={() => setAccountEdit(null)}
        onSaved={(text) => setMessage(text)}
      />
      <CategorySheet target={categoryEdit} onClose={() => setCategoryEdit(null)} />
    </div>
  );
}

function balanceInput(value: number): string {
  const text = formatPlain(value);
  return value < 0 ? `-${text}` : text;
}

function AccountSheet({
  target,
  onClose,
  onSaved,
}: {
  target: Account | "new" | null;
  onClose: () => void;
  onSaved?: (message: string) => void;
}) {
  const { state, actions, user } = useStore();
  const editing = target && target !== "new" ? target : null;
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("CASH");
  const [icon, setIcon] = useState("wallet");
  const [balanceText, setBalanceText] = useState("0");
  const [active, setActive] = useState(true);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const open = target != null;
  const [seen, setSeen] = useState<Account | "new" | null>(null);
  if (target !== seen) {
    setSeen(target);
    setError("");
    setName(editing?.name ?? "");
    setType(editing?.type ?? "CASH");
    setIcon(editing?.icon ?? "wallet");
    setBalanceText(editing ? balanceInput(editing.initial_balance) : "0");
    setActive(editing?.is_active ?? true);
    setPassword("");
    setBusy(false);
  }

  const save = async () => {
    const initial = parseSignedBalance(balanceText);
    if (initial == null) {
      setError("Số dư ban đầu phải là số nguyên.");
      return;
    }
    if (!password) {
      setError("Hãy nhập mật khẩu để xác nhận thay đổi ví.");
      return;
    }
    setBusy(true);
    const confirmed = await confirmPassword(user.id, password);
    setBusy(false);
    if (!confirmed) {
      setError("Mật khẩu không đúng.");
      return;
    }
    const result = editing
      ? actions.updateAccount(editing.id, { name, type, icon, initial_balance: initial, is_active: active })
      : actions.addAccount({ name, type, icon, initial_balance: initial });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onSaved?.(editing ? "Đã lưu thay đổi ví." : "Đã thêm ví.");
    onClose();
  };

  const snap = editing ? accountSnapshots(state.accounts, state.transactions).find((item) => item.account.id === editing.id) : null;

  return (
    <Sheet open={open} title={editing ? "Sửa ví" : "Thêm ví"} onClose={onClose}>
      <div className="space-y-4 overflow-y-auto px-4 py-4">
        {snap ? (
          <div className="rounded-2xl bg-[var(--brand-soft)] px-4 py-3">
            <p className="text-xs text-[var(--muted)]">Số dư hiện tại</p>
            <p className="tabular text-2xl font-semibold">{formatVnd(snap.balance)}</p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
              {`${formatPlain(snap.opening)} ₫ ban đầu + ${formatPlain(snap.income)} ₫ thu − ${formatPlain(snap.expense)} ₫ chi${
                snap.transferIn || snap.transferOut
                  ? ` + ${formatPlain(snap.transferIn)} ₫ chuyển đến − ${formatPlain(snap.transferOut)} ₫ chuyển đi`
                  : ""
              }.`}
            </p>
            <Link href={`/history?wallet=${snap.account.id}`} className="mt-2 inline-block text-sm font-semibold text-[var(--brand)]">
              Xem giao dịch của ví này
            </Link>
          </div>
        ) : (
          <p className="text-sm text-[var(--muted)]">Số dư ban đầu được tính vào đầu ngày bắt đầu theo dõi, trước mọi giao dịch.</p>
        )}
        <Field label="Tên ví">
          <input className={fieldClass} value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field label="Loại">
          <select className={fieldClass} value={type} onChange={(event) => setType(event.target.value as AccountType)}>
            {Object.entries(accountTypeLabel).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Số dư ban đầu" hint="Số đã có vào ngày bắt đầu theo dõi. Không phải số dư hiện tại của ví.">
          <input
            className={`${fieldClass} tabular text-right`}
            inputMode="numeric"
            value={balanceText}
            onChange={(event) => {
              const raw = event.target.value;
              const negative = raw.trim().startsWith("-");
              const digits = digitsOnly(raw).slice(0, 12);
              setBalanceText(digits ? `${negative ? "-" : ""}${formatPlain(Number(digits))}` : negative ? "-" : "");
            }}
          />
        </Field>
        <IconPicker value={icon} onChange={setIcon} />
        {editing ? (
          <label className="flex items-start gap-2 text-sm">
            <input className="mt-1" type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />
            <span>
              <span className="font-medium">Hiện khi ghi giao dịch mới</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-[var(--muted)]">
                Bỏ chọn thì ví này không xuất hiện lúc thêm thu, chi hoặc chuyển. Số dư và các giao dịch đã ghi vẫn giữ nguyên.
              </span>
            </span>
          </label>
        ) : null}
        <Field label="Mật khẩu" hint="Cần mật khẩu đang đăng nhập mỗi lần thêm hoặc sửa ví.">
          <input
            className={fieldClass}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>
        {error ? <Alert>{error}</Alert> : null}
        <Button className="w-full" disabled={busy} onClick={() => void save()}>
          {busy ? "Đang kiểm tra…" : "Lưu ví"}
        </Button>
      </div>
    </Sheet>
  );
}

function CategorySheet({ target, onClose }: { target: Category | "new" | null; onClose: () => void }) {
  const { actions } = useStore();
  const editing = target && target !== "new" ? target : null;
  const [name, setName] = useState("");
  const [type, setType] = useState<CategoryType>("EXPENSE");
  const [group, setGroup] = useState<CategoryGroup>("NEEDS");
  const [icon, setIcon] = useState("circle-plus");
  const [color, setColor] = useState(colors[0]);
  const [error, setError] = useState("");
  const [seen, setSeen] = useState<Category | "new" | null>(null);
  if (target !== seen) {
    setSeen(target);
    setError("");
    setName(editing?.name ?? "");
    setType(editing?.type ?? "EXPENSE");
    setGroup(editing?.group ?? "NEEDS");
    setIcon(editing?.icon ?? "circle-plus");
    setColor(editing?.color ?? colors[0]);
  }
  const groups = type === "INCOME" ? incomeGroups : expenseGroups;

  const save = () => {
    const nextGroup = groups.includes(group) ? group : groups[0];
    const result = editing
      ? actions.updateCategory(editing.id, { name, type, group: nextGroup, icon, color })
      : actions.addCategory({ name, type, group: nextGroup, icon, color });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onClose();
  };

  return (
    <Sheet open={target != null} title={editing ? "Sửa danh mục" : "Thêm danh mục"} onClose={onClose}>
      <div className="space-y-4 overflow-y-auto px-4 py-4">
        <Field label="Tên">
          <input className={fieldClass} value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field label="Loại">
          <select
            className={fieldClass}
            value={type}
            onChange={(event) => {
              const next = event.target.value as CategoryType;
              setType(next);
              setGroup(next === "INCOME" ? "OTHER_INCOME" : "NEEDS");
            }}
          >
            <option value="EXPENSE">Chi</option>
            <option value="INCOME">Thu</option>
          </select>
        </Field>
        <Field label="Nhóm">
          <select className={fieldClass} value={groups.includes(group) ? group : groups[0]} onChange={(event) => setGroup(event.target.value as CategoryGroup)}>
            {groups.map((item) => (
              <option key={item} value={item}>
                {groupMeta[item].label}
              </option>
            ))}
          </select>
        </Field>
        <div>
          <p className="mb-2 text-sm font-medium">Màu</p>
          <div className="flex flex-wrap gap-2">
            {colors.map((item) => (
              <button
                key={item}
                type="button"
                aria-label={item}
                onClick={() => setColor(item)}
                className={cn("h-8 w-8 rounded-full", color === item && "ring-2 ring-offset-2 ring-[var(--ink)]")}
                style={{ background: item }}
              />
            ))}
          </div>
        </div>
        <IconPicker value={icon} onChange={setIcon} />
        {error ? <Alert>{error}</Alert> : null}
        <Button className="w-full" onClick={save}>
          Lưu danh mục
        </Button>
        {editing && !editing.is_default ? (
          <Button
            variant="danger"
            className="w-full"
            onClick={() => {
              const result = actions.deleteCategory(editing.id);
              if (!result.ok) {
                setError(result.error);
                return;
              }
              onClose();
            }}
          >
            Xóa danh mục
          </Button>
        ) : null}
      </div>
    </Sheet>
  );
}

function IconPicker({ value, onChange }: { value: string; onChange: (icon: string) => void }) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium">Biểu tượng</p>
      <div className="grid grid-cols-6 gap-2">
        {iconOptions.map((icon) => (
          <button
            key={icon}
            type="button"
            aria-label={icon}
            onClick={() => onChange(icon)}
            className={cn(
              "grid h-10 place-items-center rounded-xl border",
              value === icon ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]" : "border-[var(--line)] bg-white",
            )}
          >
            <Icon name={icon} size={16} />
          </button>
        ))}
      </div>
    </div>
  );
}
