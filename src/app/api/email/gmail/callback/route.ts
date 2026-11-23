import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import {
  encryptRefreshToken,
  getAdminClient,
  getGmailOAuthConfig,
  requireAuthenticatedUser,
  verifyOAuthState,
} from "@/lib/email/gmail-server";

type GoogleTokenResponse = {
  access_token?: string;
  refresh_token?: string;
};

function callbackRedirect(request: NextRequest, result: "connected" | "error") {
  const response = NextResponse.redirect(new URL(`/?gmail=${result}`, request.url));
  response.cookies.set("gmail_oauth_state", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/api/email/gmail/callback",
  });
  return response;
}

export async function GET(request: NextRequest) {
  const stateCookie = (await cookies()).get("gmail_oauth_state")?.value;
  try {
    const user = await requireAuthenticatedUser();
    const state = request.nextUrl.searchParams.get("state");
    if (!state || !stateCookie || state !== stateCookie || verifyOAuthState(state) !== user.id) {
      return callbackRedirect(request, "error");
    }
    if (request.nextUrl.searchParams.has("error")) {
      return callbackRedirect(request, "error");
    }
    const code = request.nextUrl.searchParams.get("code");
    if (!code) return callbackRedirect(request, "error");

    const config = getGmailOAuthConfig();
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        grant_type: "authorization_code",
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!tokenResponse.ok) return callbackRedirect(request, "error");
    const tokenResult: GoogleTokenResponse = await tokenResponse.json();
    if (!tokenResult.access_token || !tokenResult.refresh_token) {
      return callbackRedirect(request, "error");
    }

    const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${tokenResult.access_token}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!profileResponse.ok) return callbackRedirect(request, "error");
    const profile: unknown = await profileResponse.json();
    if (
      !profile ||
      typeof profile !== "object" ||
      !("email" in profile) ||
      typeof profile.email !== "string"
    ) {
      return callbackRedirect(request, "error");
    }

    const encryptedToken = encryptRefreshToken(tokenResult.refresh_token);
    const { error } = await getAdminClient().from("email_connections").upsert({
      user_id: user.id,
      provider: "gmail",
      email: profile.email,
      refresh_token_ciphertext: encryptedToken.ciphertext,
      refresh_token_nonce: encryptedToken.nonce,
      refresh_token_tag: encryptedToken.tag,
      connected_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (error) {
      throw new Error("Impossible d’enregistrer la connexion Gmail.");
    }
    return callbackRedirect(request, "connected");
  } catch (error) {
    console.error("La connexion OAuth Gmail a échoué.", error);
    return callbackRedirect(request, "error");
  }
}
