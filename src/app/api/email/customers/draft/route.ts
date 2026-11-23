import { NextResponse } from "next/server";
import {
  emailIntegrationErrorResponse,
  EmailIntegrationError,
  generateOpenAiDraft,
  requireAiEmailAccess,
  requireAuthenticatedUser,
} from "@/lib/email/gmail-server";

type CustomerReminderInput = {
  name: string;
  contactName: string;
  inactiveMonths: number;
  language: "fr" | "en";
};

function parseInput(value: unknown): CustomerReminderInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new EmailIntegrationError("Les informations du client sont invalides.", 400);
  }
  const input = value as Record<string, unknown>;
  if (
    typeof input.name !== "string" ||
    !input.name.trim() ||
    input.name.length > 120 ||
    typeof input.contactName !== "string" ||
    input.contactName.length > 160 ||
    typeof input.inactiveMonths !== "number" ||
    !Number.isInteger(input.inactiveMonths) ||
    input.inactiveMonths < 6 ||
    input.inactiveMonths > 1200 ||
    (input.language !== "fr" && input.language !== "en")
  ) {
    throw new EmailIntegrationError("Les informations du client sont invalides.", 400);
  }
  return input as CustomerReminderInput;
}

export async function POST(request: Request) {
  try {
    const user = await requireAuthenticatedUser();
    await requireAiEmailAccess(user);
    const customer = parseInput(await request.json());
    const languageName = customer.language === "fr" ? "French" : "English";
    const draft = await generateOpenAiDraft(
      `Write a concise, warm, professional re-engagement email in ${languageName} to a former client. Return only a JSON object with string fields "subject" and "body". Use the company name, optional contact name, and inactivity period naturally. Address the contact by name when provided; otherwise use a neutral greeting. Do not invent purchases, projects, dates, discounts, or other facts. Keep the message low-pressure and invite a reply.`,
      {
        clientName: customer.name.trim(),
        contactName: customer.contactName.trim() || undefined,
        monthsSinceLastActivity: customer.inactiveMonths,
      },
    );
    return NextResponse.json(draft);
  } catch (error) {
    return emailIntegrationErrorResponse(error);
  }
}
