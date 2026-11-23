import { NextResponse } from "next/server";
import {
  emailIntegrationErrorResponse,
  EmailIntegrationError,
  requireAiEmailAccess,
  requireAuthenticatedUser,
  sendGmailMessage,
} from "@/lib/email/gmail-server";

function parseMessage(value: unknown) {
  if (!value || typeof value !== "object") {
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

export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (origin && new URL(origin).origin !== new URL(request.url).origin) {
      throw new EmailIntegrationError("Origine de requête invalide.", 403);
    }
    const user = await requireAuthenticatedUser();
    await requireAiEmailAccess(user);
    const message = parseMessage(await request.json());
    const from = await sendGmailMessage(user.id, message);
    return NextResponse.json({ sent: true, from });
  } catch (error) {
    return emailIntegrationErrorResponse(error);
  }
}
