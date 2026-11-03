import { NextResponse } from "next/server";
import { destroySession } from "@/lib/server/db";
import { readSession, SESSION_COOKIE } from "@/lib/server/http";

export const runtime = "nodejs";

export async function POST() {
  const session = await readSession();
  destroySession(session.token);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}
