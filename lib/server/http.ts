import { cookies } from "next/headers";
import { userForToken, type SessionUser } from "@/lib/server/db";

export const SESSION_COOKIE = "thuchi_session";

export async function readSession(): Promise<{ token?: string; user: SessionUser | null }> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  return { token, user: userForToken(token) };
}

export function sessionCookie(token: string, maxAge: number) {
  return {
    name: SESSION_COOKIE,
    value: token,
    options: {
      httpOnly: true,
      sameSite: "lax" as const,
      path: "/",
      maxAge,
    },
  };
}
