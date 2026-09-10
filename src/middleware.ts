import { NextResponse, type NextRequest } from "next/server";

/**
 * Server-side guard for the reception panel.
 *
 * The real session is a Bearer token in the browser's own storage — the server
 * never sees it — so this middleware works off a **non-credential hint cookie**
 * the client sets alongside the token (`da_session`). It grants nothing and
 * proves nothing; it exists so an unauthenticated visitor is redirected before
 * a protected page paints, instead of flashing the shell and then bouncing.
 *
 * `AuthGate` on the client is the authority: a forged or stale cookie gets past
 * here and is refused there, and a valid session whose cookie was cleared (a
 * privacy setting, a manual wipe) is redirected here and let straight back in.
 *
 * Every route except `/login` is protected — this panel has no public pages.
 */
const SESSION_HINT = "da_session";
const LOGIN = "/login";
/** Removed screen; old bookmarks land on the CRM list rather than a 404. */
const LEGACY_CLIENT_ACCOUNTS = "/client-accounts";

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (
    pathname === LEGACY_CLIENT_ACCOUNTS ||
    pathname.startsWith(`${LEGACY_CLIENT_ACCOUNTS}/`)
  ) {
    return NextResponse.redirect(new URL("/clients", request.url));
  }

  const hasHint = request.cookies.get(SESSION_HINT)?.value === "1";
  const atLogin = pathname === LOGIN;

  if (!hasHint && !atLogin) {
    // Remember where they were heading so the login screen can return them
    // there — this is what makes a browser refresh on /doctors land back on
    // /doctors instead of the dashboard.
    const url = new URL(LOGIN, request.url);
    url.searchParams.set("from", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  if (hasHint && atLogin) {
    const from = request.nextUrl.searchParams.get("from");
    const target = from && from.startsWith("/") && from !== LOGIN ? from : "/";
    return NextResponse.redirect(new URL(target, request.url));
  }

  return NextResponse.next();
}

export const config = {
  /**
   * Everything except Next's own assets, static files and the crawler
   * metadata.
   *
   * `/api` and `/media` are the proxy paths (see `next.config.ts`): they are
   * requests to the backend, not pages, and redirecting one to `/login` is what
   * makes a login attempt answer with the login page instead of a token.
   *
   * `_next/image` is excluded so an avatar request is never redirected to the
   * login page, and `robots.txt` / `sitemap.xml` are excluded because a
   * redirect there is what makes them invalid: a crawler asking for the policy
   * would be answered with the login page's HTML.
   */
  matcher: [
    "/((?!api/|media/|_next/static|_next/image|robots\\.txt|sitemap\\.xml|manifest\\.webmanifest|favicon\\.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)",
  ],
};
