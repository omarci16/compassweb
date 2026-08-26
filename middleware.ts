import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Scoped deliberately. The marketing site is static HTML served from public/
  // — if middleware ran on it, every page hit would pay a Supabase auth
  // round-trip and unauthenticated visitors would be redirected to the ERP
  // login. Only the ERP itself and the API need a session.
  matcher: ["/erp/:path*", "/api/:path*"],
};
