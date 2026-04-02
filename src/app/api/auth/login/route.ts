import { NextRequest, NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth";

const SESSION_COOKIE = "ks_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export async function POST(request: NextRequest) {
  const { password } = await request.json();
  const correct = process.env.AUTH_PASSWORD;

  if (!correct) {
    return NextResponse.json({ ok: true });
  }

  if (password !== correct) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, hashPassword(correct), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });

  return response;
}
