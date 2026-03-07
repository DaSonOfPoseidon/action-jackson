import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const PORTFOLIO_HOSTS = [
  "dev.actionjacksoninstalls.com",
  "dev.localhost",
];

function isPortfolioHost(hostname: string): boolean {
  return PORTFOLIO_HOSTS.some(
    (h) => hostname === h || hostname.startsWith(h + ":")
  );
}

export async function middleware(request: NextRequest) {
  const hostname = request.headers.get("host") || "";
  const { pathname } = request.nextUrl;

  // Portfolio domain detection: rewrite / -> /portfolio transparently
  if (isPortfolioHost(hostname) && !pathname.startsWith("/portfolio")) {
    const url = request.nextUrl.clone();
    url.pathname = `/portfolio${pathname}`;
    return NextResponse.rewrite(url);
  }

  // Admin JWT auth (skip login page)
  if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login")) {
    const secret = process.env.ADMIN_JWT_SECRET;
    if (!secret) {
      console.error("ADMIN_JWT_SECRET not configured");
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }

    const token = request.cookies.get("adminAccessToken")?.value;
    if (!token) {
      const loginUrl = new URL("/admin/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }

    try {
      await jwtVerify(
        token,
        new TextEncoder().encode(secret),
        { issuer: "action-jackson-admin", audience: "action-jackson-admin" }
      );
      return NextResponse.next();
    } catch {
      const loginUrl = new URL("/admin/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico|api/).*)",
};
