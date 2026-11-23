import { connection, NextResponse } from "next/server";
import {
  emailIntegrationErrorResponse,
  getAdminClient,
  isGmailConfigurationAvailable,
  requireAuthenticatedUser,
} from "@/lib/email/gmail-server";

export async function GET() {
  await connection();
  try {
    const user = await requireAuthenticatedUser();
    if (!isGmailConfigurationAvailable()) {
      return NextResponse.json(
        { configured: false, connected: false, email: null },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    const { data, error } = await getAdminClient()
      .from("email_connections")
      .select("email")
      .eq("user_id", user.id)
      .eq("provider", "gmail")
      .maybeSingle();
    if (error) throw new Error("Impossible de lire la connexion Gmail.");
    return NextResponse.json(
      { configured: true, connected: Boolean(data), email: data?.email ?? null },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return emailIntegrationErrorResponse(error);
  }
}
