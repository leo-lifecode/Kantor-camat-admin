import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Demo mode is only allowed outside production. In production the admin pages fail closed when the
  // Supabase environment variables are missing, instead of being served without session and role checks.
  if (!supabaseUrl || !supabaseAnonKey) {
    if (process.env.NODE_ENV !== "production" || request.nextUrl.pathname === "/login") {
      return response;
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("error", "configuration");
    return NextResponse.redirect(url);
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  const isLoginPage = request.nextUrl.pathname === "/login";

  if (authError || !user) {
    if (isLoginPage) return response;
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || profile?.role !== "ADMIN") {
    await supabase.auth.signOut();
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("error", "forbidden");
    return NextResponse.redirect(url);
  }

  if (isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/login",
    "/dashboard/:path*",
    "/antrian/:path*",
    "/layanan/:path*",
    "/pengumuman/:path*",
    "/pengguna/:path*",
    "/laporan/:path*",
    "/analitik-fcfs/:path*",
    "/profil/:path*",
  ],
};
