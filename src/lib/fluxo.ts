import { getCopy, type Language } from "@/lib/locale";

export type QuoteStatus = "pending" | "followed-up" | "signed" | "lost";

export type Quote = {
  id: string;
  client: string;
  email?: string;
  customerId?: string;
  amount: number;
  probability: number;
  status: QuoteStatus;
  createdAt: string;
};

export type Expense = {
  id: string;
  supplier: string;
  label: string;
  amount: number;
  date: string;
};

export type Customer = {
  id: string;
  name: string;
  contact: string;
  contactName?: string;
  email?: string;
  lastAmount: number;
  inactiveMonths: number;
};

export type InvoiceStatus =
  | "never"
  | "relanced"
  | "relanced-with-response"
  | "ai-ready";

export type Invoice = {
  id: string;
  number: string;
  company: string;
  contact: string;
  email?: string;
  customerId?: string;
  quoteId?: string;
  amount: number;
  dueDate: string;
  daysLate: number;
  status: InvoiceStatus;
  paymentStatus?: "pending" | "paid";
  createdAt?: string;
};

export type ProjectStatus = "planned" | "in-progress" | "completed";

export type Project = {
  id: string;
  name: string;
  customerId?: string;
  client: string;
  quoteId?: string;
  budget: number;
  status: ProjectStatus;
};

export type RecurringExpense = {
  id: string;
  supplier: string;
  label: string;
  amount: number;
  frequency: "monthly" | "yearly";
  nextDate: string;
};

export type FluxoData = {
  quotes: Quote[];
  expenses: Expense[];
  customers: Customer[];
  invoices: Invoice[];
  projects: Project[];
  recurringExpenses: RecurringExpense[];
};

export const emptyData: FluxoData = {
  quotes: [],
  expenses: [],
  customers: [],
  invoices: [],
  projects: [],
  recurringExpenses: [],
};

export const demoData: FluxoData = {
  quotes: [
    { id: "demo-quote-1", client: "Atelier Nova", email: "camille@ateliernova.fr", amount: 3240, probability: 72, status: "pending", createdAt: "2026-11-18T09:30:00.000Z" },
    { id: "demo-quote-2", client: "Maison Lumen", email: "finance@maisonlumen.fr", amount: 1890, probability: 58, status: "followed-up", createdAt: "2026-11-16T14:15:00.000Z" },
    { id: "demo-quote-3", client: "Studio Rivage", email: "thomas@studiorivage.fr", amount: 4680, probability: 84, status: "signed", createdAt: "2026-11-10T10:00:00.000Z" },
  ],
  expenses: [
    { id: "demo-expense-1", supplier: "CloudBox", label: "Abonnement hébergement", amount: 420, date: "2026-11-19" },
    { id: "demo-expense-2", supplier: "Adélie Print", label: "Supports commerciaux", amount: 680, date: "2026-11-14" },
    { id: "demo-expense-3", supplier: "CloudBox", label: "Service premium", amount: 540, date: "2026-11-20" },
  ],
  customers: [
    { id: "demo-customer-1", name: "Atelier Sora", contact: "Léa Martin · lea@ateliersora.fr", lastAmount: 2860, inactiveMonths: 8 },
    { id: "demo-customer-2", name: "Maison Lumen", contact: "Inès Roux · finance@maisonlumen.fr", lastAmount: 1890, inactiveMonths: 6 },
    { id: "demo-customer-3", name: "Studio Rivage", contact: "Thomas Leroy · thomas@studiorivage.fr", lastAmount: 4680, inactiveMonths: 3 },
  ],
  invoices: [
    { id: "demo-invoice-1", number: "FA-2026-0421", company: "Maison Lumen", contact: "Inès Roux", amount: 1430, dueDate: "2026-11-13", daysLate: 8, status: "never" },
    { id: "demo-invoice-2", number: "FA-2026-0415", company: "Atelier Sora", contact: "Léa Martin", amount: 890, dueDate: "2026-11-09", daysLate: 12, status: "relanced" },
    { id: "demo-invoice-3", number: "FA-2026-0398", company: "Studio Nacre", contact: "Nora Petit", amount: 2280, dueDate: "2026-11-02", daysLate: 19, status: "ai-ready" },
    { id: "demo-invoice-4", number: "FA-2026-0368", company: "Cabinet Aster", contact: "Julien Morel", amount: 1750, dueDate: "2026-10-18", daysLate: 34, status: "relanced" },
    { id: "demo-invoice-5", number: "FA-2026-0332", company: "Horizon Conseil", contact: "Sarah Bernard", amount: 3240, dueDate: "2026-10-05", daysLate: 47, status: "never" },
  ],
  projects: [],
  recurringExpenses: [],
};

export const quoteStatusLabels: Record<QuoteStatus, string> = {
  pending: "En attente",
  "followed-up": "Relancé",
  signed: "Signé",
  lost: "Perdu",
};

export function getExpenseAnomalies(expenses: Expense[], language: Language = "fr") {
  const sorted = [...expenses].sort(
    (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
  );
  const previousBySupplier = new Map<string, Expense>();
  const seenAmounts = new Set<number>();
  const anomalies = new Map<string, string[]>();
  const copy = getCopy(language);

  for (const expense of sorted) {
    const reasons: string[] = [];
    const previous = previousBySupplier.get(expense.supplier.trim().toLocaleLowerCase());

    if (previous && expense.amount > previous.amount) {
      reasons.push(copy.common.higherReason);
    }
    if (seenAmounts.has(expense.amount)) {
      reasons.push(copy.common.duplicateReason);
    }

    if (reasons.length > 0) anomalies.set(expense.id, reasons);
    seenAmounts.add(expense.amount);
    previousBySupplier.set(expense.supplier.trim().toLocaleLowerCase(), expense);
  }

  return anomalies;
}

