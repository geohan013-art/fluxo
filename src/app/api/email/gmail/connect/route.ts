import { connection, NextResponse } from "next/server";
import {
  createOAuthState,
  emailIntegrationErrorResponse,
  getGmailOAuthConfig,
  requireAuthenticatedUser,
} from "@/lib/email/gmail-server";

export async function GET() {
  await connection();
  try {
    const user = await requireAuthenticatedUser();
    const config = getGmailOAuthConfig();
    const state = createOAuthState(user.id);
    const authorizationUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authorizationUrl.search = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: "code",
      scope: "openid email https://www.googleapis.com/auth/gmail.send",
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
      state,
    }).toString();
    const response = NextResponse.redirect(authorizationUrl);
    response.cookies.set("gmail_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
      path: "/api/email/gmail/callback",
    });
    return response;
  } catch (error) {
    return emailIntegrationErrorResponse(error);
  }
}
