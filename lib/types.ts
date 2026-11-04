export type AccountType = "BANK" | "CASH" | "E_WALLET" | "CREDIT_CARD";

export type CategoryType = "INCOME" | "EXPENSE";

export type CategoryGroup =
  | "ACTIVE_INCOME"
  | "BONUS_COMMISSION"
  | "OTHER_INCOME"
  | "NEEDS"
  | "WANTS"
  | "SAVINGS_DEBT";

export type TransactionType = "INCOME" | "EXPENSE" | "TRANSFER";

export type DebtType = "RECEIVABLE" | "PAYABLE";

export type DebtStatus = "ACTIVE" | "DUE_SOON" | "OVERDUE" | "COMPLETED";

export type Account = {
  id: string;
  name: string;
  type: AccountType;
  initial_balance: number;
  icon: string;
  is_active: boolean;
  sort: number;
};

export type AccountChange = {
  id: string;
  account_id: string;
  at: string;
  action: "CREATE" | "UPDATE";
  summary: string;
};

export type ActivityKind = "TX" | "WALLET" | "DEBT" | "BUDGET" | "CATEGORY" | "BOOK";

export type Activity = {
  id: string;
  at: string;
  kind: ActivityKind;
  action: "CREATE" | "UPDATE" | "DELETE";
  target_id: string;
  summary: string;
};

export type Category = {
  id: string;
  code: string;
  name: string;
  type: CategoryType;
  group: CategoryGroup;
  icon: string;
  color: string;
  is_default: boolean;
  hidden: boolean;
  sort: number;
};

export type DailyBalanceSummary = {
  id: string;
  date: string;
  opening_balance: number;
  total_income: number;
  total_expense: number;
  net_change: number;
  closing_balance: number;
  notes?: string;
};

export type Transaction = {
  id: string;
  transaction_time: string;
  date: string;
  type: TransactionType;
  category_id: string | null;
  amount: number;
  account_id: string;
  destination_account_id: string | null;
  item_detail: string;
  debt_id: string | null;
  debt_installment_id: string | null;
  notes: string;
  created_at: string;
};

export type Debt = {
  id: string;
  debt_code: string;
  type: DebtType;
  counterparty_name: string;
  counterparty_contact: string;
  purpose: string;
  start_date: string;
  due_date: string;
  principal_amount: number;
  total_paid: number;
  remaining_amount: number;
  installment_count: number;
  status: DebtStatus;
  notes: string;
};

export type DebtInstallment = {
  id: string;
  debt_id: string;
  installment_number: number;
  payment_date: string;
  amount: number;
  account_id: string;
  transaction_id: string;
  is_final: boolean;
  notes: string;
};

export type MonthlyBudget = {
  id: string;
  month_year: string;
  category_id: string;
  budgeted_amount: number;
};

export type AppSettings = {
  onboarded: boolean;
  anchorDate: string | null;
};

export type AppState = {
  version: 1;
  settings: AppSettings;
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  debts: Debt[];
  installments: DebtInstallment[];
  budgets: MonthlyBudget[];
  dayNotes: Record<string, string>;
  accountChanges: AccountChange[];
  activity: Activity[];
};

export type TxInput = {
  transaction_time: string;
  type: TransactionType;
  category_id: string | null;
  amount: number;
  account_id: string;
  destination_account_id?: string | null;
  item_detail: string;
  notes?: string;
};

export type DebtInput = {
  type: DebtType;
  counterparty_name: string;
  counterparty_contact?: string;
  purpose: string;
  start_date: string;
  due_date: string;
  principal_amount: number;
  notes?: string;
  recordDisbursement?: boolean;
  account_id?: string | null;
};

export type InstallmentInput = {
  debt_id: string;
  amount: number;
  payment_date: string;
  payment_time?: string;
  account_id: string;
  is_final: boolean;
  notes?: string;
};

export type BudgetLine = {
  category: Category;
  budgeted: number;
  actual: number;
  variance: number;
  percentage: number | null;
};

export type AccountSnapshot = {
  account: Account;
  opening: number;
  income: number;
  expense: number;
  transferIn: number;
  transferOut: number;
  balance: number;
};
