import "server-only";

import { NextResponse } from "next/server";
import {
  emailIntegrationErrorResponse,
  EmailIntegrationError,
  requireAiEmailAccess,
  requireAuthenticatedUser,
} from "@/lib/email/gmail-server";
import { sendResendMessage } from "@/lib/email/resend-server";

function parseMessage(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new EmailIntegrationError("Le message est invalide.", 400);
  }
  const message = value as Record<string, unknown>;
  if (
    typeof message.to !== "string" ||
    message.to.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(message.to) ||
    typeof message.subject !== "string" ||
    !message.subject.trim() ||
    message.subject.length > 200 ||
    /[\r\n]/.test(message.subject) ||
    typeof message.body !== "string" ||
    !message.body.trim() ||
    message.body.length > 8000
  ) {
    throw new EmailIntegrationError("Vérifiez l’adresse, l’objet et le contenu du message.", 400);
  }
  return {
    to: message.to.trim(),
    subject: message.subject.trim(),
    body: message.body.trim(),
  };
}

export async function sendResendRequest(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (origin && new URL(origin).origin !== new URL(request.url).origin) {
      throw new EmailIntegrationError("Origine de requête invalide.", 403);
    }
    const user = await requireAuthenticatedUser();
    await requireAiEmailAccess(user);
    await sendResendMessage(parseMessage(await request.json()));
    return NextResponse.json({ sent: true });
  } catch (error) {
    if (
      error instanceof EmailIntegrationError &&
      error.message === "Le service Resend n’est pas configuré."
    ) {
      return NextResponse.json(
        { error: error.message, code: "RESEND_NOT_CONFIGURED" },
        { status: error.status },
      );
    }
    return emailIntegrationErrorResponse(error);
  }
}
