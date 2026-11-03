"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { AuthScreen } from "@/components/AuthScreen";
import { Onboarding } from "@/components/Onboarding";
import { createInitialState } from "@/lib/defaults";
import {
  addAccount,
  addCategory,
  addDebt,
  addInstallment,
  addTransaction,
  completeSetup,
  deleteCategory,
  deleteDebt,
  deleteInstallment,
  deleteTransaction,
  DomainError,
  setAnchorDate,
  setBudget,
  setDayNote,
  updateAccount,
  updateCategory,
  updateDebt,
  updateTransaction,
} from "@/lib/domain";
import { cloudSignIn, cloudSignOut, markLocalEdit, reconcileBook } from "@/lib/cloud";
import { todayYmd } from "@/lib/dates";
import {
  destroySession,
  loginUser,
  readLedger,
  readSession,
  registerUser,
  writeLedger,
} from "@/lib/localDb";
import { isAppState, normalizeState } from "@/lib/state";
import type {
  Account,
  AccountType,
  AppState,
  Category,
  CategoryGroup,
  CategoryType,
  DebtInput,
  InstallmentInput,
  TxInput,
} from "@/lib/types";

export type ActionResult = { ok: true } | { ok: false; error: string };

export type SessionUser = { id: string; username: string };

type StoreValue = {
  state: AppState;
  today: string;
  user: SessionUser;
  actions: {
    completeSetup: (input: { anchorDate: string; balances: Record<string, number> }) => ActionResult;
    setAnchorDate: (date: string) => ActionResult;
    setDayNote: (date: string, note: string) => ActionResult;
    addTransaction: (input: TxInput) => ActionResult;
    updateTransaction: (id: string, input: TxInput) => ActionResult;
    deleteTransaction: (id: string) => ActionResult;
    addDebt: (input: DebtInput) => ActionResult;
    updateDebt: (id: string, input: Omit<DebtInput, "recordDisbursement" | "account_id">) => ActionResult;
    deleteDebt: (id: string) => ActionResult;
    addInstallment: (input: InstallmentInput) => ActionResult;
    deleteInstallment: (id: string) => ActionResult;
    setBudget: (month: string, categoryId: string, amount: number) => ActionResult;
    addAccount: (input: { name: string; type: AccountType; initial_balance: number; icon: string }) => ActionResult;
    updateAccount: (id: string, patch: Partial<Pick<Account, "name" | "type" | "initial_balance" | "icon" | "is_active">>) => ActionResult;
    addCategory: (input: { name: string; type: CategoryType; group: CategoryGroup; icon: string; color: string }) => ActionResult;
    updateCategory: (id: string, patch: Partial<Pick<Category, "name" | "type" | "group" | "icon" | "color">>) => ActionResult;
    deleteCategory: (id: string) => ActionResult;
    replaceAll: (next: unknown) => ActionResult;
    reset: () => void;
    logout: () => Promise<void>;
  };
};

const Ctx = createContext<StoreValue | null>(null);

export function useStore() {
  const value = useContext(Ctx);
  if (!value) throw new Error("Thiếu bộ nhớ ứng dụng");
  return value;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState | null>(null);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [phase, setPhase] = useState<"loading" | "anon" | "ready">("loading");
  const ref = useRef<AppState | null>(null);
  const ready = useRef(false);
  const cloudReady = useRef(false);
  const [notice, setNotice] = useState("");

  const openLedger = (nextUser: SessionUser) => {
    const ledger = readLedger(nextUser.id);
    ref.current = ledger;
    ready.current = true;
    setUser(nextUser);
    setState(ledger);
    setPhase("ready");
  };

  const syncCloud = async (session: SessionUser, local: AppState) => {
    try {
      const next = await reconcileBook(session.id, session.username, local);
      writeLedger(session.id, next);
      ref.current = next;
      setState(next);
      setNotice("");
    } catch {
      setNotice("Chưa đồng bộ được lên mạng. Sổ trên máy này vẫn được giữ.");
    } finally {
      cloudReady.current = true;
    }
  };

  useEffect(() => {
    const session = readSession();
    if (!session) {
      setPhase("anon");
      return;
    }
    openLedger(session);
    cloudReady.current = false;
    void syncCloud(session, readLedger(session.id));
  }, []);

  useEffect(() => {
    if (phase !== "ready" || !state || !user || !ready.current || !cloudReady.current) return;
    const timer = window.setTimeout(() => {
      markLocalEdit(user.id);
      const saved = writeLedger(user.id, state);
      if ("error" in saved) ready.current = false;
      void reconcileBook(user.id, user.username, state)
        .then((next) => {
          if (next === state) return;
          writeLedger(user.id, next);
          ref.current = next;
          setState(next);
        })
        .catch(() => {
          setNotice("Chưa đồng bộ được lên mạng. Sổ trên máy này vẫn được giữ.");
        });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [state, phase, user]);

  const actions = useMemo<StoreValue["actions"]>(() => {
    const run = (recipe: (current: AppState, today: string) => AppState): ActionResult => {
      const current = ref.current;
      if (!current) return { ok: false, error: "Sổ chưa mở xong." };
      try {
        const next = recipe(current, todayYmd());
        ref.current = next;
        setState(next);
        return { ok: true };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof DomainError ? error.message : "Không lưu được dữ liệu.",
        };
      }
    };
    return {
      completeSetup: (input) => run((current, today) => completeSetup(current, input, today)),
      setAnchorDate: (date) => run((current, today) => setAnchorDate(current, date, today)),
      setDayNote: (date, note) => run((current) => setDayNote(current, date, note)),
      addTransaction: (input) => run((current, today) => addTransaction(current, input, today)),
      updateTransaction: (id, input) => run((current, today) => updateTransaction(current, id, input, today)),
      deleteTransaction: (id) => run((current, today) => deleteTransaction(current, id, today)),
      addDebt: (input) => run((current, today) => addDebt(current, input, today)),
      updateDebt: (id, input) => run((current, today) => updateDebt(current, id, input, today)),
      deleteDebt: (id) => run((current, today) => deleteDebt(current, id, today)),
      addInstallment: (input) => run((current, today) => addInstallment(current, input, today)),
      deleteInstallment: (id) => run((current, today) => deleteInstallment(current, id, today)),
      setBudget: (month, categoryId, amount) => run((current) => setBudget(current, month, categoryId, amount)),
      addAccount: (input) => run((current) => addAccount(current, input)),
      updateAccount: (id, patch) => run((current) => updateAccount(current, id, patch)),
      addCategory: (input) => run((current) => addCategory(current, input)),
      updateCategory: (id, patch) => run((current) => updateCategory(current, id, patch)),
      deleteCategory: (id) => run((current) => deleteCategory(current, id)),
      replaceAll: (next) => {
        if (!isAppState(next)) return { ok: false, error: "Tệp không đúng định dạng sổ thu chi." };
        const normalized = normalizeState(next);
        ref.current = normalized;
        setState(normalized);
        return { ok: true };
      },
      reset: () => {
        const fresh = createInitialState();
        ref.current = fresh;
        setState(fresh);
      },
      logout: async () => {
        await cloudSignOut();
        destroySession();
        cloudReady.current = false;
        ready.current = false;
        ref.current = null;
        setState(null);
        setUser(null);
        setPhase("anon");
      },
    };
  }, []);

  const signIn = async (mode: "login" | "register", username: string, password: string) => {
    const result = mode === "login" ? await loginUser(username, password) : await registerUser(username, password);
    if ("error" in result) return result.error;
    const cloudError = await cloudSignIn(username, password);
    openLedger(result.user);
    cloudReady.current = false;
    await syncCloud(result.user, readLedger(result.user.id));
    if (cloudError) setNotice(cloudError);
    return null;
  };

  if (phase === "loading" || (phase === "ready" && (!state || !user))) {
    return (
      <div className="grid min-h-dvh place-items-center px-6 text-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--brand)]">Thu Chi</p>
          <p className="mt-2 text-lg font-semibold">Đang mở sổ…</p>
        </div>
      </div>
    );
  }

  if (phase === "anon" || !state || !user) {
    return <AuthScreen onSubmit={signIn} />;
  }

  return (
    <Ctx.Provider value={{ state, today: todayYmd(), user, actions }}>
      {state.settings.onboarded ? (
        <AppShell>
          {notice ? <p className="mb-3 rounded-2xl bg-amber-50 px-3 py-2 text-sm text-amber-950">{notice}</p> : null}
          {children}
        </AppShell>
      ) : (
        <Onboarding />
      )}
    </Ctx.Provider>
  );
}
