import { NextRequest, NextResponse } from "next/server";
import { verifySession, SESSION_COOKIE_NAME } from "@/lib/auth";
import { isAllowed } from "@/lib/permissions";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/invoices",
  "/expenses",
  "/suppliers",
  "/purchase-orders",
  "/menu",
  "/ingredients",
  "/tables",
  "/orders",
  "/staff",
];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySession(token) : null;

  if (!session) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (!isAllowed(pathname, session.role)) {
    return NextResponse.redirect(new URL("/dashboard?denied=1", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/invoices/:path*",
    "/expenses/:path*",
    "/suppliers/:path*",
    "/purchase-orders/:path*",
    "/menu/:path*",
    "/ingredients/:path*",
    "/tables/:path*",
    "/orders/:path*",
    "/staff/:path*",
  ],
};
