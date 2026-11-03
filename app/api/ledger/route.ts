import { NextResponse } from "next/server";
import { readLedger, writeLedger } from "@/lib/server/db";
import { readSession } from "@/lib/server/http";

export const runtime = "nodejs";

export async function GET() {
  const session = await readSession();
  if (!session.user) return NextResponse.json({ error: "Hãy đăng nhập." }, { status: 401 });
  return NextResponse.json({ state: readLedger(session.user.id) });
}

export async function PUT(request: Request) {
  const session = await readSession();
  if (!session.user) return NextResponse.json({ error: "Hãy đăng nhập." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as unknown;
  const result = writeLedger(session.user.id, body);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
