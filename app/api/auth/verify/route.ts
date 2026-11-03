import { NextResponse } from "next/server";
import { confirmPassword } from "@/lib/server/db";
import { readSession } from "@/lib/server/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { user } = await readSession();
  if (!user) return NextResponse.json({ error: "Hãy đăng nhập lại." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { password?: string } | null;
  if (!confirmPassword(user.id, body?.password ?? "")) {
    return NextResponse.json({ error: "Mật khẩu không đúng." }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
