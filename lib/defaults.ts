import type { Account, AppState, Category } from "./types";

export const BANK_ID = "11111111-1111-4111-8111-111111111111";
export const CASH_ID = "22222222-2222-4222-8222-222222222222";

const incomeGroups = new Set(["ACTIVE_INCOME", "BONUS_COMMISSION", "OTHER_INCOME"]);

export function groupMatchesType(type: Category["type"], group: Category["group"]): boolean {
  return type === "INCOME" ? incomeGroups.has(group) : !incomeGroups.has(group);
}

function category(
  id: string,
  code: string,
  name: string,
  type: Category["type"],
  group: Category["group"],
  icon: string,
  color: string,
  sort: number,
  hidden = false,
): Category {
  return {
    id,
    code,
    name,
    type,
    group,
    icon,
    color,
    is_default: true,
    hidden,
    sort,
  };
}

export const defaultCategories: Category[] = [
  category("cat-salary", "salary", "Lương cố định", "INCOME", "ACTIVE_INCOME", "briefcase", "#1f6b4a", 10),
  category("cat-bonus", "bonus", "Thưởng Target", "INCOME", "BONUS_COMMISSION", "gift", "#b45309", 20),
  category("cat-other-income", "other_income", "Thu nhập khác", "INCOME", "OTHER_INCOME", "circle-plus", "#0f766e", 30),
  category("cat-debt-collection", "debt_collection", "Thu hồi nợ", "INCOME", "OTHER_INCOME", "hand-coins", "#0369a1", 40),
  category("cat-loan-in", "loan_in", "Nhận khoản vay", "INCOME", "OTHER_INCOME", "landmark", "#1d4ed8", 50),
  category("cat-rent", "rent", "Tiền nhà", "EXPENSE", "NEEDS", "house", "#9a3412", 110),
  category("cat-food", "food", "Ăn uống", "EXPENSE", "NEEDS", "utensils", "#c2410c", 120),
  category("cat-drink", "drink", "Uống nước", "EXPENSE", "NEEDS", "cup-soda", "#0284c7", 130),
  category("cat-cigarette", "cigarette", "Mua thuốc lá", "EXPENSE", "NEEDS", "cigarette", "#64748b", 140),
  category("cat-utilities", "utilities", "Điện nước internet", "EXPENSE", "NEEDS", "zap", "#a16207", 150),
  category("cat-transport", "transport", "Đi lại xăng xe", "EXPENSE", "NEEDS", "fuel", "#b45309", 160),
  category("cat-clothes", "clothes", "Quần áo", "EXPENSE", "WANTS", "shirt", "#7c3aed", 210),
  category("cat-coffee", "coffee", "Cà phê giải trí", "EXPENSE", "WANTS", "coffee", "#92400e", 220),
  category("cat-debt-payment", "debt_payment", "Trả nợ vay", "EXPENSE", "SAVINGS_DEBT", "hand-coins", "#be123c", 310),
  category("cat-saving", "saving", "Tiết kiệm", "EXPENSE", "SAVINGS_DEBT", "piggy-bank", "#047857", 320),
  category("cat-emergency", "emergency", "Quỹ khẩn cấp", "EXPENSE", "SAVINGS_DEBT", "shield", "#0f766e", 330),
  category("cat-loan-out", "loan_out", "Cho vay", "EXPENSE", "SAVINGS_DEBT", "wallet", "#1e40af", 340),
  category("cat-transfer", "transfer", "Chuyển khoản", "EXPENSE", "SAVINGS_DEBT", "arrow-left-right", "#57534e", 900, true),
];

export const quickCategoryCodes = ["food", "drink", "cigarette", "transport", "clothes", "coffee"];

export const defaultAccounts: Account[] = [
  {
    id: BANK_ID,
    name: "Tài khoản ngân hàng",
    type: "BANK",
    initial_balance: 0,
    icon: "landmark",
    is_active: true,
    sort: 1,
  },
  {
    id: CASH_ID,
    name: "Tiền mặt",
    type: "CASH",
    initial_balance: 0,
    icon: "wallet",
    is_active: true,
    sort: 2,
  },
];

export function createInitialState(): AppState {
  return {
    version: 1,
    settings: { onboarded: false, anchorDate: null },
    accounts: defaultAccounts.map((account) => ({ ...account })),
    categories: defaultCategories.map((item) => ({ ...item })),
    transactions: [],
    debts: [],
    installments: [],
    budgets: [],
    dayNotes: {},
    accountChanges: [],
    activity: [],
  };
}

export const accountTypeLabel: Record<Account["type"], string> = {
  BANK: "Ngân hàng",
  CASH: "Tiền mặt",
  E_WALLET: "Ví điện tử",
  CREDIT_CARD: "Thẻ tín dụng",
};

export const groupMeta: Record<
  Category["group"],
  { label: string; hint: string; ratio?: number }
> = {
  ACTIVE_INCOME: { label: "Lương cố định", hint: "Thu định kỳ hàng tháng" },
  BONUS_COMMISSION: { label: "Thưởng Target / KPI", hint: "Nhập dự toán vào tháng nhận thưởng" },
  OTHER_INCOME: { label: "Thu nhập khác", hint: "Thu hồi nợ, khoản vay, thu phụ" },
  NEEDS: { label: "Nhu cầu thiết yếu", hint: "50%", ratio: 0.5 },
  WANTS: { label: "Mong muốn cá nhân", hint: "30%", ratio: 0.3 },
  SAVINGS_DEBT: { label: "Tích lũy & Công nợ", hint: "20%", ratio: 0.2 },
};

export const incomeGroupOrder: Category["group"][] = [
  "ACTIVE_INCOME",
  "BONUS_COMMISSION",
  "OTHER_INCOME",
];

export const expenseGroupOrder: Category["group"][] = ["NEEDS", "WANTS", "SAVINGS_DEBT"];

export const protectedCategoryCodes = new Set([
  "debt_payment",
  "debt_collection",
  "loan_in",
  "loan_out",
  "transfer",
]);
