import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/menu", "/auth", "/api", "/customer"];

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p));
  if (isPublic) return supabaseResponse;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (path === "/") return supabaseResponse;
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    return NextResponse.redirect(url);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, cafe_id")
    .eq("id", user.id)
    .single();

  const role = profile?.role;

  if (role === "super_admin") return supabaseResponse;

  if (role === "cafe_admin") {
    if (path.startsWith("/admin")) {
      const url = request.nextUrl.clone();
      url.pathname = "/cafe/dashboard";
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  if (role === "cashier") {
    if (path.startsWith("/admin")) {
      const url = request.nextUrl.clone();
      url.pathname = "/counter";
      return NextResponse.redirect(url);
    }
    if (path.startsWith("/cafe") && !path.startsWith("/cafe/orders") && !path.startsWith("/cafe/pos")) {
      const url = request.nextUrl.clone();
      url.pathname = "/counter";
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  if (role === "customer") {
    if (
      path.startsWith("/admin") ||
      path.startsWith("/cafe") ||
      path.startsWith("/counter")
    ) {
      const url = request.nextUrl.clone();
      url.pathname = "/menu";
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  const url = request.nextUrl.clone();
  url.pathname = "/auth/login";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
