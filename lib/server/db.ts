import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createInitialState } from "@/lib/defaults";
import { isAppState, normalizeState, normalizeUsername, passwordError, usernameError } from "@/lib/state";
import type { AppState } from "@/lib/types";

const SESSION_DAYS = 30;

export type SessionUser = { id: string; username: string };

let database: DatabaseSync | null = null;

function db(): DatabaseSync {
  if (database) return database;
  const dir = path.join(process.cwd(), "data");
  mkdirSync(dir, { recursive: true });
  const next = new DatabaseSync(path.join(dir, "thuchi.sqlite"));
  next.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS ledgers (
      user_id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  database = next;
  return next;
}

function hashPassword(password: string, salt = randomBytes(16)) {
  return {
    salt: salt.toString("base64"),
    hash: scryptSync(password, salt, 32).toString("base64"),
  };
}

function passwordMatches(password: string, saltB64: string, hashB64: string) {
  const actual = scryptSync(password, Buffer.from(saltB64, "base64"), 32);
  const expected = Buffer.from(hashB64, "base64");
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

export function createSession(userId: string): { token: string; maxAge: number } {
  const token = randomBytes(32).toString("base64url");
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  const expires = new Date(Date.now() + maxAge * 1000).toISOString();
  db().prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)").run(token, userId, expires);
  return { token, maxAge };
}

export function userForToken(token: string | undefined): SessionUser | null {
  if (!token) return null;
  const row = db()
    .prepare(
      `SELECT u.id AS id, u.username AS username
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > ?`,
    )
    .get(token, new Date().toISOString()) as SessionUser | undefined;
  return row ?? null;
}

export function destroySession(token: string | undefined) {
  if (!token) return;
  db().prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

export function registerUser(rawUsername: string, password: string): { user: SessionUser } | { error: string } {
  const nameError = usernameError(rawUsername);
  if (nameError) return { error: nameError };
  const passError = passwordError(password);
  if (passError) return { error: passError };
  const username = normalizeUsername(rawUsername);
  const taken = db().prepare("SELECT id FROM users WHERE username = ?").get(username);
  if (taken) return { error: "Tên đăng nhập này đã có người dùng." };
  const id = crypto.randomUUID();
  const secret = hashPassword(password);
  const now = new Date().toISOString();
  const ledger = JSON.stringify(createInitialState());
  const connection = db();
  connection.exec("BEGIN");
  try {
    connection
      .prepare("INSERT INTO users (id, username, salt, password_hash, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(id, username, secret.salt, secret.hash, now);
    connection.prepare("INSERT INTO ledgers (user_id, data, updated_at) VALUES (?, ?, ?)").run(id, ledger, now);
    connection.exec("COMMIT");
  } catch (error) {
    connection.exec("ROLLBACK");
    throw error;
  }
  return { user: { id, username } };
}

export function confirmPassword(userId: string, password: string): boolean {
  if (!password) return false;
  const row = db().prepare("SELECT salt, password_hash FROM users WHERE id = ?").get(userId) as
    | { salt: string; password_hash: string }
    | undefined;
  if (!row) return false;
  return passwordMatches(password, row.salt, row.password_hash);
}

export function loginUser(rawUsername: string, password: string): { user: SessionUser } | { error: string } {
  const username = normalizeUsername(rawUsername);
  const row = db()
    .prepare("SELECT id, username, salt, password_hash FROM users WHERE username = ?")
    .get(username) as { id: string; username: string; salt: string; password_hash: string } | undefined;
  if (!row || !passwordMatches(password, row.salt, row.password_hash)) {
    return { error: "Tên đăng nhập hoặc mật khẩu không đúng." };
  }
  return { user: { id: row.id, username: row.username } };
}

export function readLedger(userId: string): AppState {
  const row = db().prepare("SELECT data FROM ledgers WHERE user_id = ?").get(userId) as { data: string } | undefined;
  if (!row) return createInitialState();
  const parsed = JSON.parse(row.data) as unknown;
  if (!isAppState(parsed)) return createInitialState();
  return normalizeState(parsed);
}

export function writeLedger(userId: string, value: unknown): { ok: true } | { error: string } {
  if (!isAppState(value)) return { error: "Sổ không đúng định dạng." };
  const payload = JSON.stringify(normalizeState(value));
  if (payload.length > 2_000_000) return { error: "Sổ quá lớn." };
  db()
    .prepare(
      `INSERT INTO ledgers (user_id, data, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
    )
    .run(userId, payload, new Date().toISOString());
  return { ok: true };
}
