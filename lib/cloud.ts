import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isAppState, normalizeState, normalizeUsername } from "@/lib/state";
import type { AppState } from "@/lib/types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

type Row = { id: string };

function cloudOn(): boolean {
  return url.startsWith("https://") && key.startsWith("sb_publishable_");
}

let client: SupabaseClient | null = null;

function supabase(): SupabaseClient {
  if (!client) {
    client = createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    });
  }
  return client;
}

function emailFor(username: string): string {
  return `${normalizeUsername(username)}@users.ql-dong-tien.app`;
}

function stampKey(userId: string): string {
  return `thuchi.updated.${userId}`;
}

function pushedKey(userId: string): string {
  return `thuchi.pushed.${userId}`;
}

export function markLocalEdit(userId: string) {
  localStorage.setItem(stampKey(userId), new Date().toISOString());
}

function localStamp(userId: string): string {
  return localStorage.getItem(stampKey(userId)) ?? "";
}

function setLocalStamp(userId: string, stamp: string) {
  localStorage.setItem(stampKey(userId), stamp);
}

function pushedStamp(userId: string): string {
  return localStorage.getItem(pushedKey(userId)) ?? "";
}

function setPushedStamp(userId: string, stamp: string) {
  localStorage.setItem(pushedKey(userId), stamp);
}

function byId<T extends Row>(left: T[], right: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of left) map.set(item.id, item);
  for (const item of right) map.set(item.id, item);
  return [...map.values()];
}

function mergeBooks(local: AppState, remote: AppState): AppState {
  return normalizeState({
    ...remote,
    settings: remote.settings.onboarded ? remote.settings : local.settings,
    accounts: byId(local.accounts, remote.accounts),
    categories: byId(local.categories, remote.categories),
    transactions: byId(local.transactions, remote.transactions),
    debts: byId(local.debts, remote.debts),
    installments: byId(local.installments, remote.installments),
    budgets: byId(local.budgets, remote.budgets),
    accountChanges: byId(local.accountChanges ?? [], remote.accountChanges ?? []),
    activity: byId(local.activity ?? [], remote.activity ?? []),
    dayNotes: { ...local.dayNotes, ...remote.dayNotes },
  });
}

function freshBook(state: AppState): boolean {
  return !state.settings.onboarded && state.transactions.length === 0 && state.debts.length === 0;
}

function time(value: string): number {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function cloudFailure(error: { code?: string; message?: string } | null): string {
  const code = error?.code ?? "";
  const message = error?.message ?? "";
  if (code === "email_not_confirmed" || /not confirmed/i.test(message)) {
    return "Supabase đang chờ xác nhận email. Hãy tắt Confirm email rồi đăng nhập lại.";
  }
  if (code === "invalid_credentials" || /invalid login/i.test(message)) {
    return "Tên đăng nhập hoặc mật khẩu không đúng.";
  }
  return "Không kết nối được sổ trên mạng. Thử lại khi có mạng.";
}

export async function cloudLogin(username: string, password: string): Promise<string | null> {
  if (!cloudOn()) return "Không kết nối được sổ trên mạng. Thử lại khi có mạng.";
  try {
    const signed = await supabase().auth.signInWithPassword({ email: emailFor(username), password });
    if (!signed.error && signed.data.session) return null;
    return cloudFailure(signed.error);
  } catch {
    return "Không kết nối được sổ trên mạng. Thử lại khi có mạng.";
  }
}

export async function cloudSignIn(username: string, password: string): Promise<string | null> {
  if (!cloudOn()) return null;
  const email = emailFor(username);
  const sb = supabase();
  const signed = await sb.auth.signInWithPassword({ email, password });
  if (!signed.error && signed.data.session) return null;
  const created = await sb.auth.signUp({
    email,
    password,
    options: { data: { username: normalizeUsername(username) } },
  });
  if (created.error) {
    return "Không vào được sổ trên mạng. Kiểm tra lại mật khẩu, hoặc tắt Confirm email trong Supabase.";
  }
  if (!created.data.session) {
    const again = await sb.auth.signInWithPassword({ email, password });
    if (again.error || !again.data.session) {
      return "Supabase đang chờ xác nhận email. Hãy tắt Confirm email rồi đăng nhập lại.";
    }
  }
  return null;
}

export async function cloudSignOut() {
  if (!cloudOn()) return;
  await supabase().auth.signOut();
}

async function remoteBook(): Promise<{ state: AppState; updatedAt: string } | null> {
  const sb = supabase();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return null;
  const { data, error } = await sb.from("books").select("data, updated_at").eq("user_id", auth.user.id).maybeSingle();
  if (error || !data || !isAppState(data.data)) return null;
  return { state: normalizeState(data.data), updatedAt: String(data.updated_at) };
}

async function pushBook(username: string, state: AppState, updatedAt: string) {
  const sb = supabase();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return;
  const { error } = await sb.from("books").upsert(
    {
      user_id: auth.user.id,
      username: normalizeUsername(username),
      data: state,
      updated_at: updatedAt,
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(error.message);
}

export async function reconcileBook(userId: string, username: string, local: AppState): Promise<AppState> {
  if (!cloudOn()) return local;
  const { data: auth } = await supabase().auth.getUser();
  if (!auth.user) return local;
  const remote = await remoteBook();
  const localAt = localStamp(userId);
  const pushedAt = pushedStamp(userId);
  const publish = async (state: AppState) => {
    const now = new Date().toISOString();
    await pushBook(username, state, now);
    setLocalStamp(userId, now);
    setPushedStamp(userId, now);
    return state;
  };
  if (!remote) return publish(local);
  if (!localAt || !pushedAt) {
    if (freshBook(local)) {
      setLocalStamp(userId, remote.updatedAt);
      setPushedStamp(userId, remote.updatedAt);
      return remote.state;
    }
    if (freshBook(remote.state)) return publish(local);
    return publish(mergeBooks(local, remote.state));
  }
  const localChanged = time(localAt) > time(pushedAt);
  const remoteChanged = time(remote.updatedAt) > time(pushedAt);
  if (localChanged && remoteChanged) return publish(mergeBooks(local, remote.state));
  if (remoteChanged) {
    setLocalStamp(userId, remote.updatedAt);
    setPushedStamp(userId, remote.updatedAt);
    return remote.state;
  }
  if (localChanged) {
    await pushBook(username, local, localAt);
    setPushedStamp(userId, localAt);
  }
  return local;
}
