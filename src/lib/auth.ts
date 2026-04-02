import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const SESSION_COOKIE = "ks_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export async function verifyAuth(): Promise<boolean> {
  const password = process.env.AUTH_PASSWORD;
  if (!password) return true; // no password set = open access

  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE);
  return session?.value === hashPassword(password);
}

export function hashPassword(password: string): string {
  // Simple hash for session token - not cryptographic security,
  // just prevents plaintext password in cookie
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return `ks_${Math.abs(hash).toString(36)}`;
}

export async function login(password: string): Promise<boolean> {
  const correct = process.env.AUTH_PASSWORD;
  if (!correct) return true;
  if (password !== correct) return false;

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, hashPassword(correct), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
  return true;
}

export function requireAuth() {
  return async function () {
    const authed = await verifyAuth();
    if (!authed) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return null;
  };
}
