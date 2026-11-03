import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BANK_ID, CASH_ID, createInitialState } from "./defaults";
import {
  addDebt,
  addInstallment,
  addTransaction,
  completeSetup,
  deleteInstallment,
  deleteTransaction,
  DomainError,
  setBudget,
  updateAccount,
  updateTransaction,
} from "./domain";
import { accountSnapshots, anchorOpening, budgetLines, buildDailySummaries, debtPosition, debtStatus } from "./finance";
import type { AppState } from "./types";

const TODAY = "2026-11-03";

function ready(balances: Record<string, number> = { [BANK_ID]: 10_000_000, [CASH_ID]: 500_000 }): AppState {
  return completeSetup(
    createInitialState(),
    { anchorDate: "2026-11-01", balances },
    TODAY,
  );
}

function cat(state: AppState, code: string) {
  const found = state.categories.find((item) => item.code === code);
  if (!found) throw new Error(code);
  return found.id;
}

describe("số dư gối đầu", () => {
  it("cộng thu chi và chuyển số dư sang ngày sau", () => {
    let state = ready();
    state = addTransaction(state, {
      transaction_time: "2026-11-01T08:00",
      type: "INCOME",
      category_id: cat(state, "salary"),
      amount: 20_000_000,
      account_id: BANK_ID,
      item_detail: "Lương tháng 11",
    }, TODAY);
    state = addTransaction(state, {
      transaction_time: "2026-11-01T07:15",
      type: "EXPENSE",
      category_id: cat(state, "food"),
      amount: 30_000,
      account_id: CASH_ID,
      item_detail: "Ăn sáng",
    }, TODAY);
    state = addTransaction(state, {
      transaction_time: "2026-11-02T09:00",
      type: "EXPENSE",
      category_id: cat(state, "drink"),
      amount: 15_000,
      account_id: CASH_ID,
      item_detail: "Nước mía",
    }, TODAY);

    const days = buildDailySummaries("2026-11-01", anchorOpening(state.accounts), state.transactions, "2026-11-03");
    const d1 = days.get("2026-11-01")!;
    const d2 = days.get("2026-11-02")!;
    const d3 = days.get("2026-11-03")!;
    assert.equal(d1.opening_balance, 10_500_000);
    assert.equal(d1.total_income, 20_000_000);
    assert.equal(d1.total_expense, 30_000);
    assert.equal(d1.net_change, 19_970_000);
    assert.equal(d1.closing_balance, 30_470_000);
    assert.equal(d2.opening_balance, d1.closing_balance);
    assert.equal(d2.closing_balance, 30_455_000);
    assert.equal(d3.opening_balance, d2.closing_balance);
    assert.equal(d3.closing_balance, 30_455_000);
  });

  it("sửa giao dịch quá khứ thì tính lại mọi ngày phía sau", () => {
    let state = ready();
    state = addTransaction(state, {
      transaction_time: "2026-11-01T07:15",
      type: "EXPENSE",
      category_id: cat(state, "food"),
      amount: 30_000,
      account_id: CASH_ID,
      item_detail: "Ăn sáng",
    }, TODAY);
    state = addTransaction(state, {
      transaction_time: "2026-11-02T09:00",
      type: "EXPENSE",
      category_id: cat(state, "drink"),
      amount: 15_000,
      account_id: CASH_ID,
      item_detail: "Nước",
    }, TODAY);
    const breakfast = state.transactions.find((tx) => tx.item_detail === "Ăn sáng")!;
    state = updateTransaction(state, breakfast.id, {
      transaction_time: breakfast.transaction_time,
      type: "EXPENSE",
      category_id: breakfast.category_id,
      amount: 50_000,
      account_id: CASH_ID,
      item_detail: "Ăn sáng",
    }, TODAY);
    const days = buildDailySummaries("2026-11-01", anchorOpening(state.accounts), state.transactions, "2026-11-03");
    assert.equal(days.get("2026-11-01")!.closing_balance, 10_450_000);
    assert.equal(days.get("2026-11-02")!.opening_balance, 10_450_000);
    assert.equal(days.get("2026-11-03")!.opening_balance, days.get("2026-11-02")!.closing_balance);
    assert.equal(days.get("2026-11-03")!.closing_balance, 10_435_000);
  });

  it("xóa giao dịch quá khứ thì số dư các ngày sau tăng lại", () => {
    let state = ready();
    state = addTransaction(state, {
      transaction_time: "2026-11-01T07:15",
      type: "EXPENSE",
      category_id: cat(state, "food"),
      amount: 30_000,
      account_id: CASH_ID,
      item_detail: "Ăn sáng",
    }, TODAY);
    const id = state.transactions[0].id;
    state = deleteTransaction(state, id, TODAY);
    const days = buildDailySummaries("2026-11-01", anchorOpening(state.accounts), state.transactions, "2026-11-02");
    assert.equal(days.get("2026-11-01")!.closing_balance, 10_500_000);
    assert.equal(days.get("2026-11-02")!.opening_balance, 10_500_000);
  });

  it("chuyển khoản không đổi tổng tiền nhưng đổi số dư từng ví", () => {
    let state = ready();
    state = addTransaction(state, {
      transaction_time: "2026-11-03T10:00",
      type: "TRANSFER",
      category_id: null,
      amount: 200_000,
      account_id: BANK_ID,
      destination_account_id: CASH_ID,
      item_detail: "Rút tiền mặt",
    }, TODAY);
    const days = buildDailySummaries("2026-11-01", anchorOpening(state.accounts), state.transactions, TODAY);
    assert.equal(days.get(TODAY)!.total_income, 0);
    assert.equal(days.get(TODAY)!.total_expense, 0);
    assert.equal(days.get(TODAY)!.closing_balance, 10_500_000);
    const snaps = accountSnapshots(state.accounts, state.transactions, TODAY);
    const bank = snaps.find((row) => row.account.id === BANK_ID)!;
    const cash = snaps.find((row) => row.account.id === CASH_ID)!;
    assert.equal(bank.balance, 9_800_000);
    assert.equal(cash.balance, 700_000);
    assert.equal(bank.balance + cash.balance, days.get(TODAY)!.closing_balance);
  });
});

describe("công nợ", () => {
  it("ghi nhận đợt trả thì trừ ví, giảm dư nợ và sinh giao dịch chi", () => {
    let state = ready();
    state = addDebt(state, {
      type: "PAYABLE",
      counterparty_name: "Anh Minh",
      purpose: "Mua laptop trả góp",
      start_date: "2026-11-01",
      due_date: "2026-12-01",
      principal_amount: 1_000_000,
      recordDisbursement: true,
      account_id: BANK_ID,
    }, TODAY);
    const debt = state.debts[0];
    assert.equal(debt.debt_code, "CN01");
    assert.equal(state.transactions.some((tx) => tx.debt_id === debt.id && tx.type === "INCOME"), true);

    state = addInstallment(state, {
      debt_id: debt.id,
      amount: 400_000,
      payment_date: "2026-11-02",
      account_id: CASH_ID,
      is_final: false,
    }, TODAY);

    const updated = state.debts[0];
    assert.equal(updated.total_paid, 400_000);
    assert.equal(updated.remaining_amount, 600_000);
    assert.equal(updated.installment_count, 1);
    assert.equal(updated.status, "ACTIVE");
    const payment = state.transactions.find((tx) => tx.debt_installment_id)!;
    assert.equal(payment.type, "EXPENSE");
    assert.equal(payment.category_id, cat(state, "debt_payment"));
    assert.equal(payment.amount, 400_000);

    const days = buildDailySummaries("2026-11-01", anchorOpening(state.accounts), state.transactions, TODAY);
    assert.equal(days.get("2026-11-01")!.total_income, 1_000_000);
    assert.equal(days.get("2026-11-02")!.total_expense, 400_000);
    assert.equal(days.get("2026-11-02")!.opening_balance, days.get("2026-11-01")!.closing_balance);

    state = setBudget(state, "2026-11", cat(state, "debt_payment"), 500_000);
    const lines = budgetLines(state.categories, state.budgets, state.transactions, "2026-11", "EXPENSE");
    const debtLine = lines.find((line) => line.category.code === "debt_payment")!;
    assert.equal(debtLine.actual, 400_000);
    assert.equal(debtLine.variance, 100_000);
    assert.equal(debtLine.percentage, 80);
  });

  it("không cho trả quá dư nợ và tất toán khi trả hết", () => {
    let state = ready();
    state = addDebt(state, {
      type: "RECEIVABLE",
      counterparty_name: "Bạn Hà",
      purpose: "Bạn mượn gấp",
      start_date: "2026-11-01",
      due_date: "2026-11-06",
      principal_amount: 200_000,
    }, TODAY);
    const debt = state.debts[0];
    assert.equal(debt.status, "DUE_SOON");
    assert.throws(
      () => addInstallment(state, {
        debt_id: debt.id,
        amount: 250_000,
        payment_date: "2026-11-03",
        account_id: BANK_ID,
        is_final: false,
      }, TODAY),
      DomainError,
    );
    assert.throws(
      () => addInstallment(state, {
        debt_id: debt.id,
        amount: 50_000,
        payment_date: "2026-11-03",
        account_id: BANK_ID,
        is_final: true,
      }, TODAY),
      DomainError,
    );
    state = addInstallment(state, {
      debt_id: debt.id,
      amount: 200_000,
      payment_date: "2026-11-03",
      account_id: BANK_ID,
      is_final: true,
    }, TODAY);
    assert.equal(state.debts[0].status, "COMPLETED");
    assert.equal(state.debts[0].remaining_amount, 0);
    assert.equal(state.transactions.filter((tx) => tx.type === "INCOME").length, 1);
    const position = debtPosition(state.debts);
    assert.equal(position.receivable.remaining, 0);
    assert.equal(position.net, 0);
  });

  it("xóa đợt thanh toán thì hoàn dư nợ và xóa giao dịch", () => {
    let state = ready();
    state = addDebt(state, {
      type: "PAYABLE",
      counterparty_name: "Chị Lan",
      purpose: "Vay tiêu dùng",
      start_date: "2026-10-01",
      due_date: "2026-11-01",
      principal_amount: 300_000,
    }, TODAY);
    state = addInstallment(state, {
      debt_id: state.debts[0].id,
      amount: 100_000,
      payment_date: "2026-11-02",
      account_id: BANK_ID,
      is_final: false,
    }, TODAY);
    assert.equal(state.debts[0].status, "OVERDUE");
    const installmentId = state.installments[0].id;
    state = deleteInstallment(state, installmentId, TODAY);
    assert.equal(state.installments.length, 0);
    assert.equal(state.transactions.length, 0);
    assert.equal(state.debts[0].remaining_amount, 300_000);
    assert.equal(debtStatus(state.debts[0], TODAY), "OVERDUE");
  });
});

describe("nhật ký ví", () => {
  it("ghi lại lần đổi số dư ban đầu", () => {
    const state = ready();
    assert.equal(state.accountChanges.length, 2);
    const next = updateAccount(state, BANK_ID, { initial_balance: 12_000_000 });
    const last = next.accountChanges.at(-1);
    assert.equal(last?.action, "UPDATE");
    assert.equal(last?.account_id, BANK_ID);
    assert.match(last?.summary ?? "", /10\.000\.000 ₫ → 12\.000\.000 ₫/);
    assert.equal(updateAccount(next, BANK_ID, { initial_balance: 12_000_000 }).accountChanges.length, next.accountChanges.length);
  });
});

describe("ràng buộc", () => {
  it("chặn số tiền không hợp lệ và ngày tương lai quá xa", () => {
    const state = ready();
    assert.throws(
      () => addTransaction(state, {
        transaction_time: "2026-11-03T08:00",
        type: "EXPENSE",
        category_id: cat(state, "food"),
        amount: 0,
        account_id: CASH_ID,
        item_detail: "Ăn",
      }, TODAY),
      DomainError,
    );
    assert.throws(
      () => addTransaction(state, {
        transaction_time: "2026-11-20T08:00",
        type: "EXPENSE",
        category_id: cat(state, "food"),
        amount: 10_000,
        account_id: CASH_ID,
        item_detail: "Ăn",
      }, TODAY),
      DomainError,
    );
  });
});
