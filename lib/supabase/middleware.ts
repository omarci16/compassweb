import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PREFIXES = [
  "/erp/login",
  "/portal",
  "/api/portal",
  "/api/webhooks",
  "/api/leads/inbound",
  "/api/leads/brief",
  "/api/unsubscribe",
  "/_next",
  "/favicon",
];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Demo mode: no Supabase env → skip auth entirely. Safe locally, but the ERP
  // now shares a domain with the public marketing site, so a missing or
  // mistyped env var in production would otherwise serve the whole back-office
  // to anyone who guessed /erp. Fail closed instead.
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    if (process.env.NODE_ENV === "production") {
      return new NextResponse(
        "Compass ERP is not configured on this deployment.",
        { status: 503, headers: { "content-type": "text/plain" } },
      );
    }
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PREFIXES.some((p) => path.startsWith(p));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/erp/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (user && path === "/erp/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/erp";
    return NextResponse.redirect(url);
  }

  return response;
}
