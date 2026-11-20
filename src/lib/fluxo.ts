import { getCopy, type Language } from "@/lib/locale";

export type QuoteStatus = "pending" | "followed-up" | "signed" | "lost";

export type Quote = {
  id: string;
  client: string;
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
  lastAmount: number;
  inactiveMonths: number;
};

export type FluxoData = {
  quotes: Quote[];
  expenses: Expense[];
  customers: Customer[];
};

export const emptyData: FluxoData = {
  quotes: [],
  expenses: [],
  customers: [],
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

