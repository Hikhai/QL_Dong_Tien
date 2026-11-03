import { NextResponse } from "next/server";
import { createSession, registerUser } from "@/lib/server/db";
import { sessionCookie } from "@/lib/server/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { username?: string; password?: string } | null;
  const result = registerUser(body?.username ?? "", body?.password ?? "");
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
  const session = createSession(result.user.id);
  const response = NextResponse.json({ user: result.user });
  const cookie = sessionCookie(session.token, session.maxAge);
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}
