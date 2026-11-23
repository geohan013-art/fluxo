import "server-only";

import { EmailIntegrationError } from "@/lib/email/gmail-server";

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new EmailIntegrationError("Le service Resend n’est pas configuré.", 503);
  }
  return value;
}

export async function sendResendMessage(message: {
  to: string;
  subject: string;
  body: string;
}) {
  const apiKey = requiredEnv("RESEND_API_KEY");
  const from = requiredEnv("RESEND_FROM_EMAIL");

  if (/[\r\n]/.test(from) || from.length > 254) {
    throw new EmailIntegrationError("L’adresse expéditeur Resend est invalide.", 503);
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [message.to],
      subject: message.subject,
      text: message.body,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new EmailIntegrationError("Resend n’a pas pu envoyer le message.", 502);
  }
}
