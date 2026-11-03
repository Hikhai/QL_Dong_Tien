import { uid } from "@/lib/domain";
import { createInitialState } from "@/lib/defaults";
import { isAppState, normalizeState, normalizeUsername, passwordError, usernameError } from "@/lib/state";
import type { AppState } from "@/lib/types";

export type SessionUser = { id: string; username: string };

type UserRow = {
  id: string;
  username: string;
  salt: string;
  password_hash: string;
  created_at: string;
};

type SessionRow = {
  token: string;
  user_id: string;
  expires_at: string;
};

type DeviceDb = {
  users: UserRow[];
  sessions: SessionRow[];
  ledgers: { user_id: string; data: string; updated_at: string }[];
};

const DB_KEY = "thuchi.books.v1";
const SESSION_KEY = "thuchi.session";
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;

function emptyDb(): DeviceDb {
  return { users: [], sessions: [], ledgers: [] };
}

function readDb(): DeviceDb {
  if (typeof localStorage === "undefined") return emptyDb();
  try {
    const parsed = JSON.parse(localStorage.getItem(DB_KEY) || "") as DeviceDb;
    if (!parsed || !Array.isArray(parsed.users) || !Array.isArray(parsed.sessions) || !Array.isArray(parsed.ledgers)) {
      return emptyDb();
    }
    return parsed;
  } catch {
    return emptyDb();
  }
}

function writeDb(db: DeviceDb) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function hashPassword(password: string, saltBase64?: string): Promise<{ salt: string; hash: string }> {
  const salt = saltBase64 ? base64ToBytes(saltBase64) : crypto.getRandomValues(new Uint8Array(16));
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: 120_000, hash: "SHA-256" },
    material,
    256,
  );
  return { salt: bytesToBase64(salt), hash: bytesToBase64(new Uint8Array(bits)) };
}

function currentToken(): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(SESSION_KEY);
}

function saveSession(userId: string): void {
  const token = uid();
  const db = readDb();
  const expires = new Date(Date.now() + SESSION_MS).toISOString();
  db.sessions = db.sessions.filter((session) => session.expires_at > new Date().toISOString() && session.user_id !== userId);
  db.sessions.push({ token, user_id: userId, expires_at: expires });
  writeDb(db);
  localStorage.setItem(SESSION_KEY, token);
}

export async function registerUser(rawUsername: string, password: string): Promise<{ user: SessionUser } | { error: string }> {
  const nameError = usernameError(rawUsername);
  if (nameError) return { error: nameError };
  const passError = passwordError(password);
  if (passError) return { error: passError };
  const username = normalizeUsername(rawUsername);
  const db = readDb();
  if (db.users.some((user) => user.username === username)) {
    return { error: "Tên đăng nhập này đã có trên điện thoại này." };
  }
  const secret = await hashPassword(password);
  const user: UserRow = {
    id: uid(),
    username,
    salt: secret.salt,
    password_hash: secret.hash,
    created_at: new Date().toISOString(),
  };
  db.users.push(user);
  db.ledgers.push({
    user_id: user.id,
    data: JSON.stringify(createInitialState()),
    updated_at: user.created_at,
  });
  writeDb(db);
  saveSession(user.id);
  return { user: { id: user.id, username: user.username } };
}

export async function rememberCloudUser(rawUsername: string, password: string): Promise<{ user: SessionUser } | { error: string }> {
  const nameError = usernameError(rawUsername);
  if (nameError) return { error: nameError };
  const passError = passwordError(password);
  if (passError) return { error: passError };
  const username = normalizeUsername(rawUsername);
  const db = readDb();
  const existing = db.users.find((user) => user.username === username);
  const secret = await hashPassword(password, existing?.salt);
  if (existing) {
    existing.salt = secret.salt;
    existing.password_hash = secret.hash;
    writeDb(db);
    saveSession(existing.id);
    return { user: { id: existing.id, username } };
  }
  const createdAt = new Date().toISOString();
  const user: UserRow = {
    id: uid(),
    username,
    salt: secret.salt,
    password_hash: secret.hash,
    created_at: createdAt,
  };
  db.users.push(user);
  db.ledgers.push({
    user_id: user.id,
    data: JSON.stringify(createInitialState()),
    updated_at: createdAt,
  });
  writeDb(db);
  saveSession(user.id);
  return { user: { id: user.id, username } };
}

export async function loginUser(
  rawUsername: string,
  password: string,
): Promise<{ user: SessionUser } | { error: string; missing?: boolean }> {
  const username = normalizeUsername(rawUsername);
  const db = readDb();
  const row = db.users.find((user) => user.username === username);
  if (!row) return { error: "Tên đăng nhập hoặc mật khẩu không đúng.", missing: true };
  const secret = await hashPassword(password, row.salt);
  if (secret.hash !== row.password_hash) return { error: "Tên đăng nhập hoặc mật khẩu không đúng." };
  saveSession(row.id);
  return { user: { id: row.id, username: row.username } };
}

export async function confirmPassword(userId: string, password: string): Promise<boolean> {
  if (!password) return false;
  const row = readDb().users.find((user) => user.id === userId);
  if (!row) return false;
  const secret = await hashPassword(password, row.salt);
  return secret.hash === row.password_hash;
}

export function readSession(): SessionUser | null {
  const token = currentToken();
  if (!token) return null;
  const db = readDb();
  const now = new Date().toISOString();
  const session = db.sessions.find((item) => item.token === token && item.expires_at > now);
  if (!session) return null;
  const user = db.users.find((item) => item.id === session.user_id);
  if (!user) return null;
  return { id: user.id, username: user.username };
}

export function destroySession() {
  const token = currentToken();
  const db = readDb();
  if (token) db.sessions = db.sessions.filter((session) => session.token !== token);
  writeDb(db);
  localStorage.removeItem(SESSION_KEY);
}

export function readLedger(userId: string): AppState {
  const row = readDb().ledgers.find((item) => item.user_id === userId);
  if (!row) return createInitialState();
  try {
    const parsed = JSON.parse(row.data) as unknown;
    if (!isAppState(parsed)) return createInitialState();
    return normalizeState(parsed);
  } catch {
    return createInitialState();
  }
}

export function writeLedger(userId: string, value: unknown): { ok: true } | { error: string } {
  if (!isAppState(value)) return { error: "Sổ không đúng định dạng." };
  const payload = JSON.stringify(normalizeState(value));
  if (payload.length > 2_000_000) return { error: "Sổ quá lớn." };
  const db = readDb();
  const now = new Date().toISOString();
  const existing = db.ledgers.find((item) => item.user_id === userId);
  if (existing) {
    existing.data = payload;
    existing.updated_at = now;
  } else {
    db.ledgers.push({ user_id: userId, data: payload, updated_at: now });
  }
  writeDb(db);
  return { ok: true };
}
