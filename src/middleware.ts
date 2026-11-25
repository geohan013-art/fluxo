import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({
            name,
            value: "",
            ...options,
          });
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Routes publiques (accès sans authentification)
  const publicRoutes = ["/connexion", "/inscription", "/"];
  const isPublicRoute = publicRoutes.includes(pathname);

  // Si l'utilisateur n'est pas connecté
  if (!user) {
    if (isPublicRoute) {
      return response;
    }
    // Redirection vers la connexion pour toutes les autres routes
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/connexion";
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Utilisateur connecté : vérifier l'accès via l'API d'abonnement
  try {
    const subscriptionResponse = await fetch(
      `${request.nextUrl.origin}/api/stripe/subscription`,
      {
        headers: {
          cookie: request.headers.get("cookie") || "",
        },
        cache: "no-store",
      },
    );

    if (subscriptionResponse.ok) {
      const access = await subscriptionResponse.json();
      const hasAccess =
        access.active ||
        access.isCreator ||
        access.isSimulated ||
        access.isAuthorized;

      // Si pas d'accès et qu'on n'est pas déjà sur la page de paramètres (plans)
      if (!hasAccess && pathname !== "/settings") {
        const pricingUrl = request.nextUrl.clone();
        pricingUrl.pathname = "/settings";
        pricingUrl.searchParams.set("reason", "subscription_required");
        return NextResponse.redirect(pricingUrl);
      }
    }
  } catch {
    // En cas d'erreur, on laisse passer : le client gérera le mode dégradé
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
