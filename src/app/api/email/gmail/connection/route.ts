import { NextResponse } from "next/server";
import {
  emailIntegrationErrorResponse,
  getAdminClient,
  requireAuthenticatedUser,
} from "@/lib/email/gmail-server";

export async function DELETE() {
  try {
    const user = await requireAuthenticatedUser();
    const { error } = await getAdminClient()
      .from("email_connections")
      .delete()
      .eq("user_id", user.id)
      .eq("provider", "gmail");
    if (error) throw new Error("Impossible de déconnecter Gmail.");
    return NextResponse.json({ disconnected: true });
  } catch (error) {
    return emailIntegrationErrorResponse(error);
  }
}
