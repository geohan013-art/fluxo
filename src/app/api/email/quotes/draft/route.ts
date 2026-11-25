import { NextResponse } from "next/server";
import {
  emailIntegrationErrorResponse,
  EmailIntegrationError,
  generateDraftWithFallback,
  requireAiEmailAccess,
  requireAuthenticatedUser,
} from "@/lib/email/gmail-server";

type QuoteReminderInput = {
  client: string;
  contactName: string;
  amount: number;
  probability: number;
  status: "pending" | "followed-up";
  createdAt: string;
  language: "fr" | "en";
};

function parseInput(value: unknown): QuoteReminderInput {
  if (!value || typeof value !== "object") {
    throw new EmailIntegrationError("Les informations du devis sont invalides.", 400);
  }
  const input = value as Record<string, unknown>;
  if (
    typeof input.client !== "string" ||
    !input.client.trim() ||
    input.client.length > 120 ||
    typeof input.contactName !== "string" ||
    input.contactName.length > 160 ||
    typeof input.amount !== "number" ||
    !Number.isFinite(input.amount) ||
    input.amount <= 0 ||
    typeof input.probability !== "number" ||
    !Number.isFinite(input.probability) ||
    input.probability < 0 ||
    input.probability > 100 ||
    (input.status !== "pending" && input.status !== "followed-up") ||
    typeof input.createdAt !== "string" ||
    Number.isNaN(Date.parse(input.createdAt)) ||
    (input.language !== "fr" && input.language !== "en")
  ) {
    throw new EmailIntegrationError("Les informations du devis sont invalides.", 400);
  }
  return input as QuoteReminderInput;
}

export async function POST(request: Request) {
  try {
    const user = await requireAuthenticatedUser();
    await requireAiEmailAccess(user);
    const quote = parseInput(await request.json());
    const languageName = quote.language === "fr" ? "French" : "English";
    const draft = await generateDraftWithFallback(
      `Write a concise, polite follow-up email about a business quote in ${languageName}. Return only a JSON object with string fields "subject" and "body". Personalize it using the provided client and contact names and quote details. Adapt the wording to the current quote status and likelihood. Do not invent dates, commitments, discounts, or facts. Keep the tone professional and non-pressuring.`,
      {
        client: quote.client.trim(),
        contactName: quote.contactName.trim() || undefined,
        amount: quote.amount,
        probability: quote.probability,
        status: quote.status,
        createdAt: quote.createdAt,
        language: quote.language,
      },
      "quote"
    );
    return NextResponse.json(draft);
  } catch (error) {
    return emailIntegrationErrorResponse(error);
  }
}
