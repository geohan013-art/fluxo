
import { NextResponse } from "next/server";
import {
  emailIntegrationErrorResponse,
  EmailIntegrationError,
  generateOpenAiDraft,
  requireAiEmailAccess,
  requireAuthenticatedUser,
} from "@/lib/email/gmail-server";

export async function POST(request: Request) {
  try {
    const user = await requireAuthenticatedUser();
    await requireAiEmailAccess(user);

    const input: unknown = await request.json();

    if (!input || typeof input !== "object" || Array.isArray(input)) {
      throw new EmailIntegrationError("Informations de facture invalides.", 400);
    }

    const invoice = input as Record<string, unknown>;

    if (
      typeof invoice.invoiceNumber !== "string" ||
      typeof invoice.company !== "string" ||
      typeof invoice.contact !== "string" ||
      typeof invoice.amount !== "number" ||
      typeof invoice.dueDate !== "string" ||
      typeof invoice.daysLate !== "number" ||
      (invoice.language !== "fr" && invoice.language !== "en")
    ) {
      throw new EmailIntegrationError("Informations de facture invalides.", 400);
    }

    const language = invoice.language === "fr" ? "French" : "English";

    const draft = await generateOpenAiDraft(
      `Write a concise, polite invoice payment reminder in ${language}. Return only a JSON object with string fields "subject" and "body". Mention the invoice number, company, amount, due date and days late. Do not invent payment details or links. If the invoice is not overdue, use a gentle reminder.`,
      {
        invoiceNumber: invoice.invoiceNumber,
        company: invoice.company,
        contact: invoice.contact,
        amount: invoice.amount,
        dueDate: invoice.dueDate,
        daysLate: invoice.daysLate,
      },
    );

    return NextResponse.json(draft);
  } catch (error) {
    return emailIntegrationErrorResponse(error);
  }
}

