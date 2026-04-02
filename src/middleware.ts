import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "ks_session";

function hashPassword(password: string): string {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return `ks_${Math.abs(hash).toString(36)}`;
}

export function middleware(request: NextRequest) {
  const password = process.env.AUTH_PASSWORD;

  // No password set = no auth required
  if (!password) return NextResponse.next();

  // Allow login page and login API
  const { pathname } = request.nextUrl;
  if (pathname === "/login" || pathname === "/api/auth/login") {
    return NextResponse.next();
  }

  // Check session cookie
  const session = request.cookies.get(SESSION_COOKIE);
  if (session?.value === hashPassword(password)) {
    return NextResponse.next();
  }

  // Redirect to login for pages, 401 for API
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    // Protect all routes except static files
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
