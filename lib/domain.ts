import { accountTypeLabel, groupMatchesType, protectedCategoryCodes } from "./defaults";
import { isMonth, isYmd, MAX_FUTURE_DAYS, daysBetween, nowStamp } from "./dates";
import { formatVnd } from "./format";
import { anchorOpening, buildDailySummaries, nextDebtCode, recomputeDebt } from "./finance";
import type {
  Account,
  AccountChange,
  Activity,
  AccountType,
  AppState,
  Category,
  CategoryGroup,
  CategoryType,
  Debt,
  DebtInput,
  DebtInstallment,
  InstallmentInput,
  Transaction,
  TxInput,
} from "./types";

export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}

export function uid(): string {
  if (typeof crypto.randomUUID === "function") {
    try {
      return crypto.randomUUID();
    } catch {
      // Điện thoại mở qua địa chỉ Wi-Fi (http) không được gọi randomUUID.
    }
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function assertAmount(amount: number) {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new DomainError("Số tiền phải là số nguyên dương.");
  }
}

function assertBalance(amount: number) {
  if (!Number.isInteger(amount)) {
    throw new DomainError("Số dư phải là số nguyên.");
  }
}

function assertDateAllowed(date: string, today: string) {
  if (!isYmd(date)) throw new DomainError("Ngày không hợp lệ.");
  if (daysBetween(today, date) > MAX_FUTURE_DAYS) {
    throw new DomainError("Ngày không được vượt quá 7 ngày trong tương lai.");
  }
}

function requireAnchor(state: AppState): string {
  if (!state.settings.onboarded || !state.settings.anchorDate) {
    throw new DomainError("Hãy hoàn tất số dư đầu ngày bắt đầu theo dõi.");
  }
  return state.settings.anchorDate;
}

function assertOnOrAfterAnchor(state: AppState, date: string) {
  const anchor = requireAnchor(state);
  if (date < anchor) {
    throw new DomainError("Ngày phải từ ngày bắt đầu theo dõi trở đi.");
  }
}

function activeAccount(state: AppState, id: string): Account {
  const account = state.accounts.find((item) => item.id === id);
  if (!account || !account.is_active) {
    throw new DomainError("Nguồn tiền không còn sử dụng.");
  }
  return account;
}

function categoryByCode(state: AppState, code: string): Category {
  const category = state.categories.find((item) => item.code === code);
  if (!category) throw new DomainError("Thiếu danh mục hệ thống.");
  return category;
}

function refresh(state: AppState, today: string): AppState {
  return {
    ...state,
    debts: state.debts.map((debt) => recomputeDebt(debt, state.installments, today)),
  };
}

function buildTransaction(state: AppState, input: TxInput, today: string, existing?: Transaction): Transaction {
  const date = input.transaction_time.slice(0, 10);
  const time = input.transaction_time.slice(11, 16);
  assertDateAllowed(date, today);
  assertOnOrAfterAnchor(state, date);
  if (!/^\d{2}:\d{2}$/.test(time)) throw new DomainError("Giờ giao dịch không hợp lệ.");
  assertAmount(input.amount);
  const account = activeAccount(state, input.account_id);

  if (input.type === "TRANSFER") {
    const destinationId = input.destination_account_id ?? "";
    if (destinationId === account.id) {
      throw new DomainError("Ví nguồn và ví đích phải khác nhau.");
    }
    activeAccount(state, destinationId);
    return {
      id: existing?.id ?? uid(),
      transaction_time: `${date}T${time}`,
      date,
      type: "TRANSFER",
      category_id: null,
      amount: input.amount,
      account_id: account.id,
      destination_account_id: destinationId,
      item_detail: input.item_detail.trim() || "Chuyển tiền giữa các ví",
      debt_id: existing?.debt_id ?? null,
      debt_installment_id: existing?.debt_installment_id ?? null,
      notes: input.notes?.trim() ?? "",
      created_at: existing?.created_at ?? new Date().toISOString(),
    };
  }

  const category = state.categories.find((item) => item.id === input.category_id);
  if (!category || category.hidden) throw new DomainError("Hãy chọn danh mục.");
  if (category.type !== input.type) {
    throw new DomainError("Danh mục không khớp loại giao dịch.");
  }
  return {
    id: existing?.id ?? uid(),
    transaction_time: `${date}T${time}`,
    date,
    type: input.type,
    category_id: category.id,
    amount: input.amount,
    account_id: account.id,
    destination_account_id: null,
    item_detail: input.item_detail.trim() || category.name,
    debt_id: existing?.debt_id ?? null,
    debt_installment_id: existing?.debt_installment_id ?? null,
    notes: input.notes?.trim() ?? "",
    created_at: existing?.created_at ?? new Date().toISOString(),
  };
}

export function completeSetup(
  state: AppState,
  input: { anchorDate: string; balances: Record<string, number> },
  today: string,
): AppState {
  assertDateAllowed(input.anchorDate, today);
  const accounts = state.accounts.map((account) => {
    const balance = input.balances[account.id] ?? 0;
    assertBalance(balance);
    return { ...account, initial_balance: balance };
  });
  const changes = accounts.map((account) =>
    accountChange(account.id, "CREATE", `Ghi số dư ban đầu ${formatVnd(account.initial_balance)}.`, `${input.anchorDate}T00:00`),
  );
  return {
    ...state,
    accounts,
    settings: { onboarded: true, anchorDate: input.anchorDate },
    accountChanges: [...(state.accountChanges ?? []), ...changes],
    activity: [...(state.activity ?? []), ...walletActivity(changes)],
  };
}

function accountChange(accountId: string, action: AccountChange["action"], summary: string, at = nowStamp()): AccountChange {
  return { id: uid(), account_id: accountId, at, action, summary };
}

function withActivity(
  state: AppState,
  input: { kind: Activity["kind"]; action: Activity["action"]; target_id: string; summary: string; at?: string; id?: string },
): AppState {
  const item: Activity = {
    id: input.id ?? uid(),
    at: input.at ?? nowStamp(),
    kind: input.kind,
    action: input.action,
    target_id: input.target_id,
    summary: input.summary,
  };
  return { ...state, activity: [...(state.activity ?? []), item] };
}

function walletActivity(changes: AccountChange[]): Activity[] {
  return changes.map((change) => ({
    id: change.id,
    at: change.at,
    kind: "WALLET",
    action: change.action,
    target_id: change.account_id,
    summary: change.summary,
  }));
}

function typeLabel(type: Transaction["type"]): string {
  if (type === "INCOME") return "Thu";
  if (type === "EXPENSE") return "Chi";
  return "Chuyển";
}

function accountName(state: AppState, id: string | null): string {
  if (!id) return "không có";
  return state.accounts.find((account) => account.id === id)?.name ?? "ví đã xóa";
}

function txTitle(state: AppState, tx: Transaction): string {
  if (tx.type === "TRANSFER") return tx.item_detail || "Chuyển tiền";
  return state.categories.find((category) => category.id === tx.category_id)?.name ?? tx.item_detail;
}

function txChangeSummary(state: AppState, before: Transaction, after: Transaction): string {
  const lines: string[] = [];
  if (before.amount !== after.amount) lines.push(`số tiền ${formatVnd(before.amount)} → ${formatVnd(after.amount)}`);
  if (before.type !== after.type) lines.push(`loại ${typeLabel(before.type)} → ${typeLabel(after.type)}`);
  if (before.category_id !== after.category_id) {
    const previous = state.categories.find((category) => category.id === before.category_id)?.name ?? "không";
    const next = state.categories.find((category) => category.id === after.category_id)?.name ?? "không";
    lines.push(`danh mục ${previous} → ${next}`);
  }
  if (before.account_id !== after.account_id) lines.push(`ví ${accountName(state, before.account_id)} → ${accountName(state, after.account_id)}`);
  if (before.destination_account_id !== after.destination_account_id) {
    lines.push(`ví đích ${accountName(state, before.destination_account_id)} → ${accountName(state, after.destination_account_id)}`);
  }
  if (before.transaction_time !== after.transaction_time) {
    lines.push(`thời điểm ${before.transaction_time.replace("T", " ")} → ${after.transaction_time.replace("T", " ")}`);
  }
  if (before.item_detail !== after.item_detail) lines.push(`nội dung “${before.item_detail}” → “${after.item_detail}”`);
  if (before.notes !== after.notes) lines.push(`ghi chú “${before.notes || "trống"}” → “${after.notes || "trống"}”`);
  if (lines.length === 0) return "";
  return `Sửa ${txTitle(state, before)}: ${lines.join(". ")}.`;
}

export function setAnchorDate(state: AppState, anchorDate: string, today: string): AppState {
  assertDateAllowed(anchorDate, today);
  const blocked = state.transactions.some((tx) => tx.date < anchorDate);
  if (blocked) {
    throw new DomainError("Còn giao dịch trước ngày bắt đầu mới. Hãy xóa hoặc dời các giao dịch đó.");
  }
  if (state.settings.anchorDate === anchorDate) return state;
  return withActivity(
    { ...state, settings: { ...state.settings, anchorDate } },
    {
      kind: "BOOK",
      action: "UPDATE",
      target_id: "anchor",
      summary: `Đổi ngày bắt đầu theo dõi ${state.settings.anchorDate ?? "chưa đặt"} → ${anchorDate}.`,
    },
  );
}

export function setDayNote(state: AppState, date: string, note: string): AppState {
  if (!isYmd(date)) throw new DomainError("Ngày không hợp lệ.");
  const dayNotes = { ...state.dayNotes };
  const trimmed = note.trim();
  if (!trimmed) delete dayNotes[date];
  else dayNotes[date] = trimmed.slice(0, 280);
  if ((state.dayNotes[date] ?? "") === (dayNotes[date] ?? "")) return { ...state, dayNotes };
  return withActivity(
    { ...state, dayNotes },
    { kind: "BOOK", action: "UPDATE", target_id: date, summary: `Sửa ghi chú ngày ${date}.` },
  );
}

export function addTransaction(state: AppState, input: TxInput, today: string): AppState {
  const tx = buildTransaction(state, input, today);
  return withActivity(
    { ...state, transactions: [...state.transactions, tx] },
    {
      kind: "TX",
      action: "CREATE",
      target_id: tx.id,
      summary: `Thêm ${typeLabel(tx.type)} ${formatVnd(tx.amount)} · ${txTitle(state, tx)}.`,
    },
  );
}

export function updateTransaction(state: AppState, id: string, input: TxInput, today: string): AppState {
  const current = state.transactions.find((tx) => tx.id === id);
  if (!current) throw new DomainError("Không tìm thấy giao dịch.");
  if (current.debt_installment_id && input.type !== current.type) {
    throw new DomainError("Không đổi loại giao dịch đã gắn với đợt trả nợ.");
  }
  const nextTx = buildTransaction(state, input, today, current);
  if (current.debt_installment_id) {
    nextTx.category_id = current.category_id;
    nextTx.type = current.type;
    nextTx.debt_id = current.debt_id;
    nextTx.debt_installment_id = current.debt_installment_id;
    const installment = state.installments.find((item) => item.id === current.debt_installment_id);
    const debt = state.debts.find((item) => item.id === current.debt_id);
    if (!installment || !debt) throw new DomainError("Đợt trả nợ không còn tồn tại.");
    const others = state.installments
      .filter((item) => item.debt_id === debt.id && item.id !== installment.id)
      .reduce((sum, item) => sum + item.amount, 0);
    if (others + nextTx.amount > debt.principal_amount) {
      throw new DomainError("Số tiền vượt quá dư nợ còn lại.");
    }
    const installments = state.installments.map((item) =>
      item.id === installment.id
        ? {
            ...item,
            amount: nextTx.amount,
            payment_date: nextTx.date,
            account_id: nextTx.account_id,
            notes: nextTx.notes,
            is_final: others + nextTx.amount === debt.principal_amount,
          }
        : item,
    );
    return finishTransactionEdit(state, current, nextTx, { installments }, today);
  }
  let debts = state.debts;
  if (current.debt_id && !current.debt_installment_id && nextTx.amount !== current.amount) {
    const debt = debts.find((item) => item.id === current.debt_id);
    if (debt) {
      if (nextTx.amount < debt.total_paid) throw new DomainError("Số tiền nhỏ hơn số đã thanh toán.");
      debts = debts.map((item) => (item.id === debt.id ? { ...item, principal_amount: nextTx.amount } : item));
    }
  }
  return finishTransactionEdit(state, current, nextTx, { debts }, today);
}

function finishTransactionEdit(
  state: AppState,
  before: Transaction,
  after: Transaction,
  patch: Partial<Pick<AppState, "installments" | "debts">>,
  today: string,
): AppState {
  const summary = txChangeSummary(state, before, after);
  const next = {
    ...state,
    ...patch,
    transactions: state.transactions.map((tx) => (tx.id === after.id ? after : tx)),
  };
  const logged = summary ? withActivity(next, { kind: "TX", action: "UPDATE", target_id: after.id, summary }) : next;
  return before.debt_id || patch.installments || patch.debts ? refresh(logged, today) : logged;
}

export function deleteTransaction(state: AppState, id: string, today: string): AppState {
  const current = state.transactions.find((tx) => tx.id === id);
  if (!current) throw new DomainError("Không tìm thấy giao dịch.");
  const transactions = state.transactions.filter((tx) => tx.id !== id);
  const logged = withActivity(
    { ...state, transactions },
    {
      kind: "TX",
      action: "DELETE",
      target_id: id,
      summary: `Xóa ${typeLabel(current.type)} ${formatVnd(current.amount)} · ${txTitle(state, current)}.`,
    },
  );
  if (!current.debt_installment_id) return refresh(logged, today);
  return refresh(
    { ...logged, installments: state.installments.filter((item) => item.id !== current.debt_installment_id) },
    today,
  );
}

function assertDebtInput(input: DebtInput) {
  assertAmount(input.principal_amount);
  if (!isYmd(input.start_date) || !isYmd(input.due_date)) {
    throw new DomainError("Ngày nợ không hợp lệ.");
  }
  if (input.due_date < input.start_date) {
    throw new DomainError("Hạn tất toán phải từ ngày phát sinh trở đi.");
  }
  if (!input.counterparty_name.trim()) throw new DomainError("Hãy nhập tên đối tác.");
  if (!input.purpose.trim()) throw new DomainError("Hãy nhập mục đích vay.");
}

export function addDebt(state: AppState, input: DebtInput, today: string): AppState {
  requireAnchor(state);
  assertDebtInput(input);
  if (input.recordDisbursement && input.start_date < requireAnchor(state)) {
    throw new DomainError("Chỉ ghi nhận giải ngân từ ngày bắt đầu theo dõi. Bỏ chọn nếu khoản vay phát sinh từ trước.");
  }
  const debt: Debt = {
    id: uid(),
    debt_code: nextDebtCode(state.debts),
    type: input.type,
    counterparty_name: input.counterparty_name.trim(),
    counterparty_contact: input.counterparty_contact?.trim() ?? "",
    purpose: input.purpose.trim(),
    start_date: input.start_date,
    due_date: input.due_date,
    principal_amount: input.principal_amount,
    total_paid: 0,
    remaining_amount: input.principal_amount,
    installment_count: 0,
    status: "ACTIVE",
    notes: input.notes?.trim() ?? "",
  };
  let next: AppState = { ...state, debts: [...state.debts, debt] };
  if (input.recordDisbursement) {
    if (!input.account_id) throw new DomainError("Hãy chọn nguồn tiền giải ngân.");
    const category = categoryByCode(state, input.type === "PAYABLE" ? "loan_in" : "loan_out");
    const detail =
      input.type === "PAYABLE"
        ? `Nhận vay từ ${debt.counterparty_name}`
        : `Cho ${debt.counterparty_name} vay`;
    next = addTransaction(
      next,
      {
        transaction_time: `${input.start_date}T12:00`,
        type: input.type === "PAYABLE" ? "INCOME" : "EXPENSE",
        category_id: category.id,
        amount: input.principal_amount,
        account_id: input.account_id,
        item_detail: detail,
        notes: "",
      },
      today,
    );
    const created = [...next.transactions].reverse().find((tx) => tx.item_detail === detail && tx.debt_id == null);
    if (created) {
      next = {
        ...next,
        transactions: next.transactions.map((tx) => (tx.id === created.id ? { ...tx, debt_id: debt.id } : tx)),
      };
    }
  }
  return refresh(
    withActivity(next, {
      kind: "DEBT",
      action: "CREATE",
      target_id: debt.id,
      summary: `Thêm nợ ${debt.debt_code} ${debt.counterparty_name}, gốc ${formatVnd(debt.principal_amount)}.`,
    }),
    today,
  );
}

export function updateDebt(
  state: AppState,
  id: string,
  input: Omit<DebtInput, "recordDisbursement" | "account_id">,
  today: string,
): AppState {
  const current = state.debts.find((debt) => debt.id === id);
  if (!current) throw new DomainError("Không tìm thấy khoản nợ.");
  assertDebtInput({ ...input });
  if (input.type !== current.type && state.installments.some((item) => item.debt_id === id)) {
    throw new DomainError("Không đổi chiều nợ khi đã có đợt thanh toán.");
  }
  if (input.principal_amount < current.total_paid) {
    throw new DomainError("Gốc mới nhỏ hơn số tiền đã thanh toán.");
  }
  const nextDebt = {
    ...current,
    type: input.type,
    counterparty_name: input.counterparty_name.trim(),
    counterparty_contact: input.counterparty_contact?.trim() ?? "",
    purpose: input.purpose.trim(),
    start_date: input.start_date,
    due_date: input.due_date,
    principal_amount: input.principal_amount,
    notes: input.notes?.trim() ?? "",
  };
  const debts = state.debts.map((debt) => (debt.id === id ? nextDebt : debt));
  const disbursement = state.transactions.find((tx) => tx.debt_id === id && !tx.debt_installment_id);
  const transactions =
    disbursement && disbursement.amount !== input.principal_amount
      ? state.transactions.map((tx) => (tx.id === disbursement.id ? { ...tx, amount: input.principal_amount } : tx))
      : state.transactions;
  const lines: string[] = [];
  if (nextDebt.principal_amount !== current.principal_amount) {
    lines.push(`gốc ${formatVnd(current.principal_amount)} → ${formatVnd(nextDebt.principal_amount)}`);
  }
  if (nextDebt.counterparty_name !== current.counterparty_name) {
    lines.push(`đối tác “${current.counterparty_name}” → “${nextDebt.counterparty_name}”`);
  }
  if (nextDebt.purpose !== current.purpose) lines.push(`mục đích “${current.purpose}” → “${nextDebt.purpose}”`);
  if (nextDebt.start_date !== current.start_date || nextDebt.due_date !== current.due_date) {
    lines.push(`thời hạn ${current.start_date}–${current.due_date} → ${nextDebt.start_date}–${nextDebt.due_date}`);
  }
  if (nextDebt.type !== current.type) lines.push("đổi chiều nợ");
  if (disbursement && disbursement.amount !== input.principal_amount) {
    lines.push(`giao dịch ${typeLabel(disbursement.type)} đi kèm đổi thành ${formatVnd(input.principal_amount)}`);
  }
  const next = { ...state, debts, transactions };
  if (lines.length === 0) return refresh(next, today);
  return refresh(
    withActivity(next, {
      kind: "DEBT",
      action: "UPDATE",
      target_id: id,
      summary: `Sửa nợ ${current.debt_code}: ${lines.join(". ")}.`,
    }),
    today,
  );
}

export function deleteDebt(state: AppState, id: string, today: string): AppState {
  const current = state.debts.find((debt) => debt.id === id);
  if (!current) throw new DomainError("Không tìm thấy khoản nợ.");
  return refresh(
    withActivity(
      {
        ...state,
        debts: state.debts.filter((debt) => debt.id !== id),
        installments: state.installments.filter((item) => item.debt_id !== id),
        transactions: state.transactions.filter((tx) => tx.debt_id !== id),
      },
      {
        kind: "DEBT",
        action: "DELETE",
        target_id: id,
        summary: `Xóa nợ ${current.debt_code} ${current.counterparty_name}, gốc ${formatVnd(current.principal_amount)}.`,
      },
    ),
    today,
  );
}

export function addInstallment(state: AppState, input: InstallmentInput, today: string): AppState {
  const debt = state.debts.find((item) => item.id === input.debt_id);
  if (!debt) throw new DomainError("Không tìm thấy khoản nợ.");
  if (debt.remaining_amount <= 0) throw new DomainError("Khoản nợ đã tất toán.");
  assertAmount(input.amount);
  if (input.amount > debt.remaining_amount) {
    throw new DomainError("Số tiền thanh toán vượt quá dư nợ còn lại.");
  }
  if (input.is_final && input.amount !== debt.remaining_amount) {
    throw new DomainError("Số tiền chưa đủ để tất toán khoản nợ.");
  }
  assertDateAllowed(input.payment_date, today);
  assertOnOrAfterAnchor(state, input.payment_date);
  const account = activeAccount(state, input.account_id);
  const category = categoryByCode(state, debt.type === "PAYABLE" ? "debt_payment" : "debt_collection");
  const installmentId = uid();
  const txId = uid();
  const number =
    state.installments.filter((item) => item.debt_id === debt.id).reduce((max, item) => {
      return Math.max(max, item.installment_number);
    }, 0) + 1;
  const isFinal = input.amount === debt.remaining_amount;
  const time = input.payment_time && /^\d{2}:\d{2}$/.test(input.payment_time) ? input.payment_time : "12:00";
  const installment: DebtInstallment = {
    id: installmentId,
    debt_id: debt.id,
    installment_number: number,
    payment_date: input.payment_date,
    amount: input.amount,
    account_id: account.id,
    transaction_id: txId,
    is_final: isFinal,
    notes: input.notes?.trim() ?? "",
  };
  const verb = debt.type === "PAYABLE" ? "Trả nợ" : "Thu nợ";
  const tx: Transaction = {
    id: txId,
    transaction_time: `${input.payment_date}T${time}`,
    date: input.payment_date,
    type: debt.type === "PAYABLE" ? "EXPENSE" : "INCOME",
    category_id: category.id,
    amount: input.amount,
    account_id: account.id,
    destination_account_id: null,
    item_detail: `${verb} ${debt.counterparty_name} · Đợt ${number}`,
    debt_id: debt.id,
    debt_installment_id: installmentId,
    notes: installment.notes,
    created_at: new Date().toISOString(),
  };
  return refresh(
    withActivity(
      {
        ...state,
        installments: [...state.installments, installment],
        transactions: [...state.transactions, tx],
      },
      {
        kind: "DEBT",
        action: "CREATE",
        target_id: installment.id,
        summary: `Ghi đợt ${number} nợ ${debt.debt_code}: ${formatVnd(input.amount)}.`,
      },
    ),
    today,
  );
}

export function deleteInstallment(state: AppState, id: string, today: string): AppState {
  const installment = state.installments.find((item) => item.id === id);
  if (!installment) throw new DomainError("Không tìm thấy đợt thanh toán.");
  const debt = state.debts.find((item) => item.id === installment.debt_id);
  return refresh(
    withActivity(
      {
        ...state,
        installments: state.installments.filter((item) => item.id !== id),
        transactions: state.transactions.filter((tx) => tx.id !== installment.transaction_id),
      },
      {
        kind: "DEBT",
        action: "DELETE",
        target_id: id,
        summary: `Xóa đợt ${installment.installment_number}${debt ? ` nợ ${debt.debt_code}` : ""}: ${formatVnd(installment.amount)}.`,
      },
    ),
    today,
  );
}

export function setBudget(state: AppState, month: string, categoryId: string, amount: number): AppState {
  if (!isMonth(month)) throw new DomainError("Tháng không hợp lệ.");
  if (!Number.isInteger(amount) || amount < 0) {
    throw new DomainError("Hạn mức phải là số nguyên từ 0 trở lên.");
  }
  const category = state.categories.find((item) => item.id === categoryId && !item.hidden);
  if (!category) throw new DomainError("Không tìm thấy danh mục.");
  const existing = state.budgets.find((row) => row.month_year === month && row.category_id === categoryId);
  const previous = existing?.budgeted_amount ?? 0;
  if (previous === amount) return state;
  const budgets = existing
    ? state.budgets.map((row) => (row.id === existing.id ? { ...row, budgeted_amount: amount } : row))
    : [...state.budgets, { id: uid(), month_year: month, category_id: categoryId, budgeted_amount: amount }];
  return withActivity(
    { ...state, budgets },
    {
      kind: "BUDGET",
      action: existing ? "UPDATE" : "CREATE",
      target_id: categoryId,
      summary: `Dự toán ${category.name} tháng ${month}: ${formatVnd(previous)} → ${formatVnd(amount)}.`,
    },
  );
}

export function addAccount(
  state: AppState,
  input: { name: string; type: AccountType; initial_balance: number; icon: string },
): AppState {
  if (!input.name.trim()) throw new DomainError("Hãy nhập tên ví.");
  assertBalance(input.initial_balance);
  const account: Account = {
    id: uid(),
    name: input.name.trim(),
    type: input.type,
    initial_balance: input.initial_balance,
    icon: input.icon || "wallet",
    is_active: true,
    sort: state.accounts.reduce((max, item) => Math.max(max, item.sort), 0) + 1,
  };
  const change = accountChange(account.id, "CREATE", `Tạo ví ${account.name}, số dư ban đầu ${formatVnd(account.initial_balance)}.`);
  return {
    ...state,
    accounts: [...state.accounts, account],
    accountChanges: [...(state.accountChanges ?? []), change],
    activity: [...(state.activity ?? []), ...walletActivity([change])],
  };
}

export function updateAccount(
  state: AppState,
  id: string,
  patch: Partial<Pick<Account, "name" | "type" | "initial_balance" | "icon" | "is_active">>,
): AppState {
  const current = state.accounts.find((account) => account.id === id);
  if (!current) throw new DomainError("Không tìm thấy ví.");
  if (patch.initial_balance != null) assertBalance(patch.initial_balance);
  if (patch.name != null && !patch.name.trim()) throw new DomainError("Hãy nhập tên ví.");
  if (patch.is_active === false) {
    const others = state.accounts.filter((account) => account.id !== id && account.is_active);
    if (others.length === 0) throw new DomainError("Cần giữ ít nhất một ví đang dùng.");
  }
  const nextAccount: Account = {
    ...current,
    ...patch,
    name: patch.name != null ? patch.name.trim() : current.name,
  };
  const lines: string[] = [];
  if (nextAccount.name !== current.name) lines.push(`Đổi tên “${current.name}” thành “${nextAccount.name}”`);
  if (nextAccount.type !== current.type) lines.push(`Đổi loại ${accountTypeLabel[current.type]} thành ${accountTypeLabel[nextAccount.type]}`);
  if (nextAccount.initial_balance !== current.initial_balance) {
    lines.push(`Số dư ban đầu ${formatVnd(current.initial_balance)} → ${formatVnd(nextAccount.initial_balance)}`);
  }
  if (nextAccount.is_active !== current.is_active) {
    lines.push(nextAccount.is_active ? "Hiện lại khi ghi giao dịch mới" : "Không hiện khi ghi giao dịch mới");
  }
  if (nextAccount.icon !== current.icon) lines.push("Đổi biểu tượng");
  if (lines.length === 0) return state;
  const change = accountChange(id, "UPDATE", `${lines.join(". ")}.`);
  return {
    ...state,
    accounts: state.accounts.map((account) => (account.id === id ? nextAccount : account)),
    accountChanges: [...(state.accountChanges ?? []), change],
    activity: [...(state.activity ?? []), ...walletActivity([change])],
  };
}

export function addCategory(
  state: AppState,
  input: { name: string; type: CategoryType; group: CategoryGroup; icon: string; color: string },
): AppState {
  if (!input.name.trim()) throw new DomainError("Hãy nhập tên danh mục.");
  if (!groupMatchesType(input.type, input.group)) {
    throw new DomainError("Nhóm không khớp loại thu hoặc chi.");
  }
  const category: Category = {
    id: uid(),
    code: `custom-${uid()}`,
    name: input.name.trim(),
    type: input.type,
    group: input.group,
    icon: input.icon || "circle-plus",
    color: input.color || "#1f6b4a",
    is_default: false,
    hidden: false,
    sort: state.categories.reduce((max, item) => Math.max(max, item.sort), 0) + 1,
  };
  return withActivity(
    { ...state, categories: [...state.categories, category] },
    { kind: "CATEGORY", action: "CREATE", target_id: category.id, summary: `Thêm danh mục ${category.name}.` },
  );
}

export function updateCategory(
  state: AppState,
  id: string,
  patch: Partial<Pick<Category, "name" | "type" | "group" | "icon" | "color">>,
): AppState {
  const current = state.categories.find((category) => category.id === id);
  if (!current || current.hidden) throw new DomainError("Không tìm thấy danh mục.");
  const next = { ...current, ...patch, name: patch.name != null ? patch.name.trim() : current.name };
  if (!next.name) throw new DomainError("Hãy nhập tên danh mục.");
  if (!groupMatchesType(next.type, next.group)) {
    throw new DomainError("Nhóm không khớp loại thu hoặc chi.");
  }
  const used = state.transactions.some((tx) => tx.category_id === id);
  if (used && next.type !== current.type) {
    throw new DomainError("Danh mục đã có giao dịch nên không đổi loại thu/chi.");
  }
  const lines: string[] = [];
  if (next.name !== current.name) lines.push(`tên “${current.name}” → “${next.name}”`);
  if (next.type !== current.type) lines.push("đổi loại thu/chi");
  if (next.group !== current.group) lines.push("đổi nhóm");
  if (next.icon !== current.icon || next.color !== current.color) lines.push("đổi biểu tượng hoặc màu");
  const replaced = { ...state, categories: state.categories.map((category) => (category.id === id ? next : category)) };
  if (lines.length === 0) return replaced;
  return withActivity(replaced, {
    kind: "CATEGORY",
    action: "UPDATE",
    target_id: id,
    summary: `Sửa danh mục ${current.name}: ${lines.join(". ")}.`,
  });
}

export function deleteCategory(state: AppState, id: string): AppState {
  const current = state.categories.find((category) => category.id === id);
  if (!current || current.hidden) throw new DomainError("Không tìm thấy danh mục.");
  if (protectedCategoryCodes.has(current.code) || current.is_default) {
    throw new DomainError("Danh mục mặc định được giữ lại. Bạn có thể đổi tên, nhóm và biểu tượng.");
  }
  if (state.transactions.some((tx) => tx.category_id === id) || state.budgets.some((row) => row.category_id === id)) {
    throw new DomainError("Danh mục đang được dùng, không thể xóa.");
  }
  return withActivity(
    { ...state, categories: state.categories.filter((category) => category.id !== id) },
    { kind: "CATEGORY", action: "DELETE", target_id: id, summary: `Xóa danh mục ${current.name}.` },
  );
}

export function closingOn(state: AppState, date: string): number | null {
  if (!state.settings.anchorDate) return null;
  const summaries = buildDailySummaries(
    state.settings.anchorDate,
    anchorOpening(state.accounts),
    state.transactions,
    date,
    state.dayNotes,
  );
  return summaries.get(date)?.closing_balance ?? null;
}
