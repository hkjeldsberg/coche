import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

export async function proxy(request: NextRequest) {
  if (await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  // Public: login, Next assets, icons/manifest (needed before login for home-screen install).
  matcher: ["/((?!login|_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|.*\\.png$).*)"],
};
