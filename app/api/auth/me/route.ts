import { NextResponse } from "next/server";
import { readSession } from "@/lib/server/http";

export const runtime = "nodejs";

export async function GET() {
  const session = await readSession();
  if (!session.user) return NextResponse.json({ user: null }, { status: 401 });
  return NextResponse.json({ user: session.user });
}
