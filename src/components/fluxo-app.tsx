"use client";

import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import Image from "next/image";
import {
  getExpenseAnomalies,
  type Customer,
  type Expense,
  type Invoice,
  type InvoiceStatus,
  type Project,
  type ProjectStatus,
  type Quote,
  type QuoteStatus,
  type RecurringExpense,
} from "@/lib/fluxo";
import {
  formatCurrency,
  getCopy,
  getQuoteStatusLabel,
  type Copy,
  type Language,
  type Theme,
} from "@/lib/locale";
import { useFluxoData } from "@/lib/use-fluxo-data";
import { useFluxoSettings } from "@/lib/use-fluxo-settings";
import {
  canCreateWithinQuota,
  getMinimumPlanForFeature,
  getMinimumPlanForModule,
  getPlanForQuotaUpgrade,
  hasModuleAccess,
  hasPlanFeature,
  isPlanId,
  planFeatures,
  type ModuleId,
  type PlanFeature,
  type PlanId,
  type QuotaId,
} from "@/lib/plans";
import SettingsPage from "@/components/settings-page";

type Section =
  | "cockpit"
  | "quotes"
  | "clients"
  | "invoices"
  | "projects"
  | "expenses"
  | "recurring"
  | "customers"
  | "settings";
type UpgradeTarget =
  | { kind: "module"; module: ModuleId }
  | { kind: "feature"; feature: PlanFeature }
  | { kind: "quota"; quota: QuotaId; limit: number };
type DialogState =
  | { kind: "quote"; item?: Quote; customerId?: string }
  | { kind: "quote-generating"; item: Quote }
  | { kind: "expense"; item?: Expense }
  | { kind: "customer"; item?: Customer }
  | { kind: "invoice"; item?: Invoice }
  | { kind: "invoice-generating"; item: Invoice }
  | { kind: "invoice-draft"; item: Invoice }
  | { kind: "customer-message"; item: Customer }
  | { kind: "project"; item?: Project }
  | { kind: "recurring"; item?: RecurringExpense }
  | { kind: "quote-draft"; item: Quote }
  | { kind: "upgrade"; requiredPlan: PlanId; target: UpgradeTarget }
  | null;
type EmailDraft = { email: string; subject: string; body: string };
type GmailStatus = { configured: boolean; connected: boolean; email: string | null };

function getInvoiceReminderLabel(status: InvoiceStatus, copy: Copy) {
  if (status === "never") return copy.invoices.reminderNever;
  if (status === "relanced") return copy.invoices.reminderSent;
  if (status === "relanced-with-response") return copy.invoices.reminderReplied;
  return copy.invoices.reminderReady;
}

function getEmailSendError(result: unknown, fallback: string, notConfigured: string) {
  if (!result || typeof result !== "object") return fallback;
  if ("code" in result && result.code === "RESEND_NOT_CONFIGURED") return notConfigured;
  if ("error" in result && typeof result.error === "string") return result.error;
  return fallback;
}

type IconName =
  | "grid"
  | "document"
  | "wallet"
  | "users"
  | "plus"
  | "arrow"
  | "clock"
  | "trend"
  | "check"
  | "alert"
  | "trash"
  | "edit"
  | "send"
  | "close"
  | "calendar"
  | "spark"
  | "settings"
  | "sun"
  | "moon"
  | "briefcase"
  | "lock"
  | "repeat";

const iconShapes: Record<IconName, ReactNode> = {
  grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  document: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h8" /></>,
  wallet: <><rect x="3" y="5" width="18" height="15" rx="2" /><path d="M3 9h18M16 15h.01M7 5V3h11" /></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  arrow: <><path d="M7 17 17 7M7 7h10v10" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  trend: <><path d="m3 17 6-6 4 4 8-8" /><path d="M15 7h6v6" /></>,
  check: <><path d="m5 12 4 4L19 6" /></>,
  alert: <><path d="M10.3 3.9 2.5 18a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" /></>,
  trash: <><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5" /></>,
  edit: <><path d="m15 5 4 4M4 20l4-.8L19 8a2.1 2.1 0 0 0-3-3L5 16l-1 4Z" /></>,
  send: <><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></>,
  close: <><path d="m18 6-12 12M6 6l12 12" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
  spark: <><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-2-5.8L4 11l6-2.2L12 3ZM19 14l1.2 2.8L23 18l-2.8 1.2L19 22l-1.2-2.8L15 18l2.8-1.2L19 14Z" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.7a8 8 0 0 1-1.7 1l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.7-1l-1.7.7-1.4-2.4 1.4-1.1a7 7 0 0 1 0-2l-1.4-1.1 1.4-2.4 1.7.7a8 8 0 0 1 1.7-1l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.7 1l1.7-.7 1.4 2.4-1.4 1.1a7 7 0 0 1 0 2Z" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" /></>,
  moon: <><path d="M20.2 15.1A8.3 8.3 0 0 1 8.9 3.8 8.5 8.5 0 1 0 20.2 15.1Z" /></>,
  briefcase: <><rect x="3" y="7" width="18" height="14" rx="2" /><path d="M8 7V4h8v3M3 12h18M10 12v2h4v-2" /></>,
  lock: <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 1 1 8 0v3m-4 5v2" /></>,
  repeat: <><path d="m17 2 4 4-4 4" /><path d="M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4" /><path d="M21 13v2a3 3 0 0 1-3 3H3" /></>,
};

const sectionModules: Partial<Record<Section, ModuleId>> = {
  quotes: "sales",
  clients: "sales",
  invoices: "sales",
  projects: "projects",
  expenses: "control",
  recurring: "recurring",
  customers: "recover",
};

function Icon({
  name,
  size = 18,
}: {
  name: IconName;
  size?: number;
}) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {iconShapes[name]}
    </svg>
  );
}

function moneyInput(value: number) {
  return Number.isInteger(value) ? String(value) : String(value);
}

function makeId() {
  return window.crypto.randomUUID();
}

function getCustomerEmail(customer: Customer) {
  if (customer.email) return customer.email;
  return customer.contact.split("·").map((part) => part.trim()).find((part) => part.includes("@"));
}

function getCustomerContactName(customer: Customer) {
  if (customer.contactName) return customer.contactName;
  const contactParts = customer.contact.split("·").map((part) => part.trim());
  return contactParts.find((part) => part && !part.includes("@")) ?? "";
}

function combineAiNotes(...notes: Array<string | undefined>) {
  return notes.map((note) => note?.trim()).filter(Boolean).join("\n");
}

function copyTextFallback(text: string) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  try {
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    return document.execCommand("copy");
  } finally {
    textarea.remove();
  }
}

export default function FluxoApp() {
  const { data, updateData, isLoaded, storageError } = useFluxoData();
  const {
    settings,
    updateSettings,
    isLoaded: settingsLoaded,
    storageError: settingsError,
  } = useFluxoSettings();
  const [section, setSection] = useState<Section>("cockpit");
  const [dialog, setDialog] = useState<DialogState>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [copiedCustomerId, setCopiedCustomerId] = useState<string | null>(null);
  const [quoteAiNotice, setQuoteAiNotice] = useState<string | null>(null);
  const [quoteDraftError, setQuoteDraftError] = useState<string | null>(null);
  const [isGeneratingQuoteDraft, setIsGeneratingQuoteDraft] = useState(false);
  const [isSendingQuoteDraft, setIsSendingQuoteDraft] = useState(false);
  const [gmailStatus, setGmailStatus] = useState<GmailStatus>({
    configured: false,
    connected: false,
    email: null,
  });
  const [gmailStatusError, setGmailStatusError] = useState<string | null>(null);
  const [mailNotice, setMailNotice] = useState<string | null>(null);
  const [isDisconnectingGmail, setIsDisconnectingGmail] = useState(false);
  const [invoiceDraft, setInvoiceDraft] = useState<EmailDraft | null>(null);
  const [invoiceDraftError, setInvoiceDraftError] = useState<string | null>(null);
  const [customerMessageDraft, setCustomerMessageDraft] = useState<EmailDraft | null>(null);
  const [customerMessageError, setCustomerMessageError] = useState<string | null>(null);
  const [isGeneratingCustomerMessage, setIsGeneratingCustomerMessage] = useState(false);
  const [isSendingCustomerMessage, setIsSendingCustomerMessage] = useState(false);
  const [isGeneratingInvoiceDraft, setIsGeneratingInvoiceDraft] = useState(false);
  const [isSendingInvoiceDraft, setIsSendingInvoiceDraft] = useState(false);
  const scrollToPlans = useRef(false);
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  const [isCreatorAccount, setIsCreatorAccount] = useState(false);
  const [isPlanSimulated, setIsPlanSimulated] = useState(false);
  const [hasResolvedSubscription, setHasResolvedSubscription] = useState(false);
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null);
  const [isGmailStatusLoading, setIsGmailStatusLoading] = useState(true);
  const copy = getCopy(settings.language);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/stripe/subscription", { cache: "no-store" })
      .then(async (response) => {
        const result: unknown = await response.json();
        if (!response.ok) {
          const message = result && typeof result === "object" && "error" in result &&
            typeof result.error === "string"
            ? result.error
            : "Impossible de vérifier l’abonnement.";
          throw new Error(message);
        }
        return result;
      })
      .then((result: unknown) => {
        if (cancelled) return;
        if (!result || typeof result !== "object" || Array.isArray(result)) {
          throw new Error("Réponse d’abonnement invalide.");
        }
        const subscription = result as Record<string, unknown>;
        const active = subscription.active === true && isPlanId(subscription.plan);
        const plan: PlanId = isPlanId(subscription.plan)
          ? subscription.plan
          : "standard";
        const effectivePlan: PlanId = active ? plan : "standard";
        const isPlanSimulated = active && subscription.isSimulated === true;
        const isCreator = active && !isPlanSimulated &&
          subscription.isCreator === true && effectivePlan === "pro_max";
        setHasActiveSubscription(active);
        setIsCreatorAccount(isCreator);
        setIsPlanSimulated(isPlanSimulated);
        setSubscriptionError(null);
        updateSettings((current) => ({ ...current, plan: effectivePlan }));
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setHasActiveSubscription(false);
          setIsCreatorAccount(false);
          setIsPlanSimulated(false);
          setSubscriptionError(error instanceof Error
            ? error.message
            : "Impossible de vérifier l’abonnement.");
          updateSettings((current) => ({ ...current, plan: "standard" }));
        }
      })
      .finally(() => {
        if (!cancelled) setHasResolvedSubscription(true);
      });
    return () => { cancelled = true; };
  }, []);
  const [quoteDraft, setQuoteDraft] = useState<EmailDraft | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/email/gmail/status", { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401) {
          if (!cancelled) setGmailStatusError(copy.settings.gmailAuthRequired);
          return null;
        }
        if (!response.ok) {
          const result = await response.json() as { error?: string };
          throw new Error(result.error ?? copy.settings.gmailStatusError);
        }
        return response.json() as Promise<GmailStatus>;
      })
      .then((result) => {
        if (!cancelled && result) {
          setGmailStatus(result);
          setGmailStatusError(null);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setGmailStatusError(
            error instanceof Error ? error.message : copy.settings.gmailStatusError,
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsGmailStatusLoading(false);
      });
    return () => { cancelled = true; };
  }, [copy.settings.gmailAuthRequired, copy.settings.gmailStatusError]);

  useEffect(() => {
    if (!dialog) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    let focusFrame = 0;
    if (window.matchMedia("(pointer: fine)").matches) {
      focusFrame = window.requestAnimationFrame(() => {
        document.querySelector<HTMLElement>(".dialog-card [data-dialog-autofocus]")?.focus();
      });
    }
    return () => {
      if (focusFrame) window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
    };
  }, [dialog]);

  useEffect(() => {
    const result = new URLSearchParams(window.location.search).get("gmail");
    if (!result) return;
    const timer = window.setTimeout(() => {
      setSection("settings");
      setMailNotice(result === "connected" ? copy.settings.gmailConnected : copy.settings.gmailConnectionFailed);
    }, 0);
    const url = new URL(window.location.href);
    url.searchParams.delete("gmail");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    return () => window.clearTimeout(timer);
  }, [copy.settings.gmailConnected, copy.settings.gmailConnectionFailed]);
  const anomalies = useMemo(
    () => hasPlanFeature(settings.plan, "duplicatePriceDetection")
      ? getExpenseAnomalies(data.expenses, settings.language)
      : new Map<string, string[]>(),
    [data.expenses, settings.language, settings.plan],
  );
  const inactiveCustomers = data.customers.filter(
    (customer) => customer.inactiveMonths >= 6,
  );
  const page = copy.pages[section];

  useEffect(() => {
    if (section !== "settings" || !scrollToPlans.current) return;
    document.getElementById("plan-options")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    scrollToPlans.current = false;
  }, [section]);

  if (!isLoaded || !settingsLoaded || !hasResolvedSubscription) {
    return <main className="loading-screen" aria-label={copy.shell.loading}><span className="loading-mark">F</span></main>;
  }

  function requestUpgrade(target: UpgradeTarget) {
    const requiredPlan = target.kind === "module"
      ? getMinimumPlanForModule(target.module)
      : target.kind === "feature"
        ? getMinimumPlanForFeature(target.feature)
        : getPlanForQuotaUpgrade(settings.plan, target.quota);
    setDialog({ kind: "upgrade", requiredPlan, target });
  }

  function requireModuleAccess(module: ModuleId): boolean {
    if (hasModuleAccess(settings.plan, module)) return true;
    requestUpgrade({ kind: "module", module });
    return false;
  }

  function canAddQuota(quota: QuotaId, currentCount: number): boolean {
    const limit = planFeatures[settings.plan].quotas[quota];
    if (canCreateWithinQuota(settings.plan, quota, currentCount)) return true;
    if (limit === null) return true;
    setDialog({
      kind: "upgrade",
      requiredPlan: getPlanForQuotaUpgrade(settings.plan, quota),
      target: { kind: "quota", quota, limit },
    });
    return false;
  }

  function openQuoteDialog(item?: Quote, customerId?: string) {
    if (!requireModuleAccess("sales")) return;
    if (!item && !canAddQuota("quotesPerMonth", quotesThisMonth)) return;
    setDialog({ kind: "quote", item, customerId });
  }

  function openExpenseDialog(item?: Expense) {
    if (!requireModuleAccess("control")) return;
    setDialog({ kind: "expense", item });
  }

  function openCustomerDialog(item?: Customer) {
    if (!requireModuleAccess("sales")) return;
    if (!item && !canAddQuota("customers", data.customers.length)) return;
    setDialog({ kind: "customer", item });
  }

  function openInvoiceDialog(item?: Invoice) {
    if (!requireModuleAccess("sales")) return;
    if (!item && !canAddQuota("invoicesPerMonth", invoicesThisMonth)) return;
    setDialog({ kind: "invoice", item });
  }

  function openProjectDialog(item?: Project) {
    if (!requireModuleAccess("projects")) return;
    if (!item && !canAddQuota("projects", data.projects.length)) return;
    setDialog({ kind: "project", item });
  }

  function openRecurringDialog(item?: RecurringExpense) {
    if (!requireModuleAccess("recurring")) return;
    setDialog({ kind: "recurring", item });
  }

  function getInvoiceCustomer(invoice: Invoice) {
    return data.customers.find((item) =>
      (invoice.customerId && item.id === invoice.customerId) ||
      item.name.trim().toLocaleLowerCase() === invoice.company.trim().toLocaleLowerCase(),
    );
  }

  function getInvoiceEmail(invoice: Invoice) {
    const customer = getInvoiceCustomer(invoice);
    const quote = data.quotes.find((item) => item.id === invoice.quoteId);
    return invoice.email?.trim() || (customer ? getCustomerEmail(customer) : undefined) ||
      quote?.email?.trim() || "";
  }

  async function generateInvoiceFollowUp(invoice: Invoice, recipient = getInvoiceEmail(invoice)) {
    if (isGeneratingInvoiceDraft || isSendingInvoiceDraft) return;
    if (!hasPlanFeature(settings.plan, "aiEmailReminders")) {
      requestUpgrade({ kind: "feature", feature: "aiEmailReminders" });
      return;
    }
    if (!requireModuleAccess("recover")) return;
    setMailNotice(null);
    setInvoiceDraftError(null);
    setInvoiceDraft(null);
    setDialog({ kind: "invoice-generating", item: invoice });
    setIsGeneratingInvoiceDraft(true);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 35_000);
    try {
      const response = await fetch("/api/email/invoices/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          invoiceNumber: invoice.number,
          company: invoice.company,
          contact: invoice.contact,
          amount: invoice.amount,
          dueDate: invoice.dueDate,
          daysLate: getInvoiceDaysLate(invoice),
          language: settings.language,
          note: combineAiNotes(invoice.note, getInvoiceCustomer(invoice)?.note),
        }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const message = result && typeof result === "object" && "error" in result &&
          typeof result.error === "string"
          ? result.error
          : copy.invoices.aiDraftError;
        throw new Error(message);
      }
      if (
        !result ||
        typeof result !== "object" ||
        !("subject" in result) ||
        typeof result.subject !== "string" ||
        !("body" in result) ||
        typeof result.body !== "string"
      ) {
        throw new Error(copy.invoices.aiDraftError);
      }
      setInvoiceDraft({ email: recipient, subject: result.subject, body: result.body });
      setDialog({ kind: "invoice-draft", item: invoice });
    } catch (error) {
      setDialog(null);
      setMailNotice(
        error instanceof Error && error.name === "AbortError"
          ? copy.invoices.aiDraftTimeout
          : error instanceof Error
            ? error.message
            : copy.invoices.aiDraftError,
      );
    } finally {
      window.clearTimeout(timeoutId);
      setIsGeneratingInvoiceDraft(false);
    }
  }

  async function sendInvoiceFollowUp() {
    if (dialog?.kind !== "invoice-draft" || !invoiceDraft || isSendingInvoiceDraft) return;
    setInvoiceDraftError(null);
    setIsSendingInvoiceDraft(true);
    try {
      const response = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: invoiceDraft.email,
          subject: invoiceDraft.subject,
          body: invoiceDraft.body,
        }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        throw new Error(getEmailSendError(result, copy.invoices.emailSendError, copy.invoices.emailNotConfigured));
      }
      updateInvoiceStatus(dialog.item.id, "relanced", invoiceDraft.email.trim());
      setMailNotice(copy.invoices.emailSent(invoiceDraft.email));
      setInvoiceDraft(null);
      setDialog(null);
    } catch (error) {
      setInvoiceDraftError(error instanceof Error ? error.message : copy.invoices.emailSendError);
    } finally {
      setIsSendingInvoiceDraft(false);
    }
  }

  async function disconnectGmail() {
    setGmailStatusError(null);
    setIsDisconnectingGmail(true);
    try {
      const response = await fetch("/api/email/gmail/connection", { method: "DELETE" });
      const result: unknown = await response.json();
      if (!response.ok) {
        const message = result && typeof result === "object" && "error" in result &&
          typeof result.error === "string"
          ? result.error
          : copy.settings.gmailDisconnectError;
        throw new Error(message);
      }
      setGmailStatus((current) => ({ ...current, connected: false, email: null }));
      setMailNotice(copy.settings.gmailDisconnected);
    } catch (error) {
      setGmailStatusError(error instanceof Error ? error.message : copy.settings.gmailDisconnectError);
    } finally {
      setIsDisconnectingGmail(false);
    }
  }

  function closeDialog() {
    if (
      isGeneratingInvoiceDraft ||
      isSendingInvoiceDraft ||
      isGeneratingCustomerMessage ||
      isSendingCustomerMessage ||
      isGeneratingQuoteDraft ||
      isSendingQuoteDraft
    ) return;
    setDialog(null);
    setQuoteDraft(null);
    setQuoteDraftError(null);
    setInvoiceDraft(null);
    setInvoiceDraftError(null);
    setCustomerMessageDraft(null);
    setCustomerMessageError(null);
    setCopyError(null);
  }

  function saveQuote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (dialog?.kind !== "quote") return;
    if (!requireModuleAccess("sales")) return;
    if (!dialog.item && !canAddQuota("quotesPerMonth", quotesThisMonth)) return;
    const form = new FormData(event.currentTarget);
    const customerId = String(form.get("customerId") ?? "");
    const customer = data.customers.find((item) => item.id === customerId);
    const enteredClient = String(form.get("client")).trim();
    if (!customer && !enteredClient) {
      const input = event.currentTarget.elements.namedItem("client");
      if (input instanceof HTMLInputElement) {
        input.setCustomValidity(copy.forms.customerRequired);
        input.reportValidity();
        input.setCustomValidity("");
      }
      return;
    }
    const quote: Quote = {
      id: dialog.item?.id ?? makeId(),
      client: customer?.name ?? enteredClient,
      email: customer
        ? getCustomerEmail(customer) ?? (String(form.get("email")).trim() || undefined)
        : String(form.get("email")).trim() || undefined,
      note: String(form.get("note") ?? "").trim() || undefined,
      customerId: customer?.id,
      amount: Number(form.get("amount")),
      probability: Number(form.get("probability")),
      status: String(form.get("status")) as QuoteStatus,
      createdAt: dialog.item?.createdAt ?? new Date().toISOString(),
    };
    updateData((current) => ({
      ...current,
      quotes: dialog.item
        ? current.quotes.map((item) => (item.id === quote.id ? quote : item))
        : [quote, ...current.quotes],
    }));
    setDialog(null);
  }

  function saveExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (dialog?.kind !== "expense") return;
    if (!requireModuleAccess("control")) return;
    const form = new FormData(event.currentTarget);
    const expense: Expense = {
      id: dialog.item?.id ?? makeId(),
      supplier: String(form.get("supplier")).trim(),
      label: String(form.get("label")).trim(),
      amount: Number(form.get("amount")),
      date: String(form.get("date")),
    };
    updateData((current) => ({
      ...current,
      expenses: dialog.item
        ? current.expenses.map((item) => (item.id === expense.id ? expense : item))
        : [expense, ...current.expenses],
    }));
    setDialog(null);
  }

  function saveCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (dialog?.kind !== "customer") return;
    if (!requireModuleAccess("sales")) return;
    if (!dialog.item && !canAddQuota("customers", data.customers.length)) return;
    const form = new FormData(event.currentTarget);
    const customer: Customer = {
      id: dialog.item?.id ?? makeId(),
      name: String(form.get("name")).trim(),
      contact: String(form.get("contact")).trim(),
      contactName: String(form.get("contactName")).trim() || undefined,
      email: String(form.get("email")).trim() || undefined,
      note: String(form.get("note") ?? "").trim() || undefined,
      lastAmount: Number(form.get("lastAmount")),
      inactiveMonths: Number(form.get("inactiveMonths")),
    };
    updateData((current) => ({
      ...current,
      customers: dialog.item
        ? current.customers.map((item) =>
            item.id === customer.id ? customer : item,
          )
        : [customer, ...current.customers],
    }));
    setDialog(null);
  }

  function saveInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (dialog?.kind !== "invoice" || !requireModuleAccess("sales")) return;
    if (!dialog.item && !canAddQuota("invoicesPerMonth", invoicesThisMonth)) return;
    const form = new FormData(event.currentTarget);
    const dueDate = String(form.get("dueDate"));
    const dueTime = new Date(`${dueDate}T12:00:00`).getTime();
    const daysLate = Math.max(0, Math.floor((new Date().getTime() - dueTime) / 86400000));
    const customerId = String(form.get("customerId") ?? "");
    const customer = data.customers.find((item) => item.id === customerId);
    const company = String(form.get("company")).trim();
    if (!customer && !company) {
      const input = event.currentTarget.elements.namedItem("company");
      if (input instanceof HTMLInputElement) {
        input.setCustomValidity(copy.forms.customerRequired);
        input.reportValidity();
        input.setCustomValidity("");
      }
      return;
    }
    const invoice: Invoice = {
      id: dialog.item?.id ?? makeId(),
      number: String(form.get("number")).trim(),
      company: customer?.name ?? company,
      contact: customer ? getCustomerContactName(customer) : String(form.get("contact")).trim(),
      email: String(form.get("email") ?? "").trim() || (customer ? getCustomerEmail(customer) : undefined),
      note: String(form.get("note") ?? "").trim() || undefined,
      customerId: customer?.id,
      amount: Number(form.get("amount")),
      dueDate,
      daysLate,
      quoteId: dialog.item?.quoteId,
      status: dialog.item?.status ?? "never",
      paymentStatus: dialog.item?.paymentStatus ?? "pending",
      createdAt: dialog.item?.createdAt ?? new Date().toISOString(),
    };
    updateData((current) => ({
      ...current,
      invoices: dialog.item
        ? current.invoices.map((item) => (item.id === invoice.id ? invoice : item))
        : [invoice, ...current.invoices],
    }));
    setDialog(null);
  }

  function saveProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (dialog?.kind !== "project" || !requireModuleAccess("projects")) return;
    if (!dialog.item && !canAddQuota("projects", data.projects.length)) return;
    const form = new FormData(event.currentTarget);
    const customerId = String(form.get("customerId") ?? "");
    const customer = data.customers.find((item) => item.id === customerId);
    const enteredClient = String(form.get("client")).trim();
    if (!customer && !enteredClient) {
      const input = event.currentTarget.elements.namedItem("client");
      if (input instanceof HTMLInputElement) {
        input.setCustomValidity(copy.forms.customerRequired);
        input.reportValidity();
        input.setCustomValidity("");
      }
      return;
    }
    const project: Project = {
      id: dialog.item?.id ?? makeId(),
      name: String(form.get("name")).trim(),
      customerId: customer?.id,
      client: customer?.name ?? enteredClient,
      budget: Number(form.get("budget")),
      status: String(form.get("status")) as ProjectStatus,
      quoteId: dialog.item?.quoteId,
    };
    updateData((current) => ({
      ...current,
      projects: dialog.item
        ? current.projects.map((item) => item.id === project.id ? project : item)
        : [project, ...current.projects],
    }));
    setDialog(null);
  }

  function saveRecurringExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (dialog?.kind !== "recurring" || !requireModuleAccess("recurring")) return;
    const form = new FormData(event.currentTarget);
    const expense: RecurringExpense = {
      id: dialog.item?.id ?? makeId(),
      supplier: String(form.get("supplier")).trim(),
      label: String(form.get("label")).trim(),
      amount: Number(form.get("amount")),
      frequency: String(form.get("frequency")) as RecurringExpense["frequency"],
      nextDate: String(form.get("nextDate")),
    };
    updateData((current) => ({
      ...current,
      recurringExpenses: dialog.item
        ? current.recurringExpenses.map((item) => item.id === expense.id ? expense : item)
        : [expense, ...current.recurringExpenses],
    }));
    setDialog(null);
  }

  function createInvoiceFromQuote(quote: Quote) {
    if (!requireModuleAccess("sales") || !canAddQuota("invoicesPerMonth", invoicesThisMonth)) return;
    if (quote.status !== "signed" || data.invoices.some((invoice) => invoice.quoteId === quote.id)) return;
    const customer = data.customers.find((item) =>
      item.id === quote.customerId ||
      item.name.trim().toLocaleLowerCase() === quote.client.trim().toLocaleLowerCase(),
    );
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);
    const year = new Date().getFullYear();
    updateData((current) => {
      let sequence = current.invoices.length + 1;
      let number = `FA-${year}-${String(sequence).padStart(4, "0")}`;
      while (current.invoices.some((invoice) => invoice.number === number)) {
        sequence += 1;
        number = `FA-${year}-${String(sequence).padStart(4, "0")}`;
      }
      return {
        ...current,
        invoices: [{
          id: makeId(),
          number,
          company: customer?.name ?? quote.client,
          contact: customer?.contactName ?? customer?.contact ?? quote.email ?? "",
          email: customer ? getCustomerEmail(customer) : quote.email,
          customerId: customer?.id ?? quote.customerId,
          quoteId: quote.id,
          amount: quote.amount,
          dueDate: dueDate.toISOString().slice(0, 10),
          daysLate: 0,
          status: "never",
          paymentStatus: "pending",
          createdAt: new Date().toISOString(),
        }, ...current.invoices],
      };
    });
    setSection("invoices");
  }

  function createProjectFromQuote(quote: Quote) {
    if (!requireModuleAccess("projects")) return;
    if (!canAddQuota("projects", data.projects.length)) return;
    if (quote.status !== "signed" || data.projects.some((project) => project.quoteId === quote.id)) return;
    const customer = data.customers.find((item) =>
      item.id === quote.customerId ||
      item.name.trim().toLocaleLowerCase() === quote.client.trim().toLocaleLowerCase(),
    );
    updateData((current) => ({
      ...current,
      projects: [{
        id: makeId(),
        name: quote.client,
        customerId: customer?.id ?? quote.customerId,
        client: customer?.name ?? quote.client,
        quoteId: quote.id,
        budget: quote.amount,
        status: "planned",
      }, ...current.projects],
    }));
    setSection("projects");
  }

  function updateQuoteStatus(id: string, status: QuoteStatus) {
    if (!requireModuleAccess("sales")) return;
    updateData((current) => ({
      ...current,
      quotes: current.quotes.map((quote) =>
        quote.id === id ? { ...quote, status } : quote,
      ),
    }));
  }

  function updateInvoiceStatus(id: string, status: InvoiceStatus, email?: string) {
    if (!requireModuleAccess("recover")) return;
    updateData((current) => ({
      ...current,
      invoices: current.invoices.map((invoice) =>
        invoice.id === id
          ? { ...invoice, status, ...(email === undefined ? {} : { email }) }
          : invoice,
      ),
    }));
  }

  function updateInvoicePaymentStatus(id: string, paymentStatus: "pending" | "paid") {
    if (!requireModuleAccess("sales")) return;
    updateData((current) => ({
      ...current,
      invoices: current.invoices.map((invoice) =>
        invoice.id === id ? { ...invoice, paymentStatus } : invoice,
      ),
    }));
  }

  async function generateQuoteFollowUp(quote: Quote) {
    if (isGeneratingQuoteDraft || isSendingQuoteDraft) return;
    if (!hasPlanFeature(settings.plan, "aiEmailReminders")) {
      requestUpgrade({ kind: "feature", feature: "aiEmailReminders" });
      return;
    }
    if (!requireModuleAccess("sales")) return;
    setMailNotice(null);
    setQuoteAiNotice(null);
    setQuoteDraftError(null);
    setQuoteDraft(null);
    setDialog({ kind: "quote-generating", item: quote });
    setIsGeneratingQuoteDraft(true);
    const customer = data.customers.find((item) =>
      (quote.customerId && item.id === quote.customerId) ||
      item.name.trim().toLocaleLowerCase() === quote.client.trim().toLocaleLowerCase(),
    );
    const recipient = quote.email?.trim() || (customer ? getCustomerEmail(customer)?.trim() : undefined) || "";
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 35_000);
    try {
      const response = await fetch("/api/email/quotes/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          client: quote.client,
          contactName: customer ? getCustomerContactName(customer) : "",
          amount: quote.amount,
          probability: quote.probability,
          status: quote.status,
          createdAt: quote.createdAt,
          language: settings.language,
          note: combineAiNotes(quote.note, customer?.note),
        }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const message = result && typeof result === "object" && "error" in result &&
          typeof result.error === "string"
          ? result.error
          : copy.quotes.aiDraftError;
        throw new Error(message);
      }
      if (
        !result ||
        typeof result !== "object" ||
        !("subject" in result) ||
        typeof result.subject !== "string" ||
        !("body" in result) ||
        typeof result.body !== "string"
      ) {
        throw new Error(copy.quotes.aiDraftError);
      }
      setQuoteDraft({
        email: recipient,
        subject: result.subject,
        body: result.body,
      });
      setDialog({ kind: "quote-draft", item: quote });
    } catch (error) {
      const message = error instanceof Error && error.name === "AbortError"
        ? copy.quotes.aiDraftTimeout
        : error instanceof Error
          ? error.message
          : copy.quotes.aiDraftError;
      setDialog(null);
      setQuoteAiNotice(message);
      setMailNotice(message);
    } finally {
      window.clearTimeout(timeoutId);
      setIsGeneratingQuoteDraft(false);
    }
  }

  async function sendQuoteDraft() {
    if (dialog?.kind !== "quote-draft" || !quoteDraft || isSendingQuoteDraft) return;
    setQuoteDraftError(null);
    setIsSendingQuoteDraft(true);
    try {
      const response = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: quoteDraft.email,
          subject: quoteDraft.subject,
          body: quoteDraft.body,
        }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        throw new Error(getEmailSendError(result, copy.quotes.emailSendError, copy.invoices.emailNotConfigured));
      }
      updateData((current) => ({
        ...current,
        quotes: current.quotes.map((quote) =>
          quote.id === dialog.item.id
            ? { ...quote, email: quoteDraft.email.trim(), status: "followed-up" }
            : quote,
        ),
      }));
      const notice = copy.quotes.emailSent(quoteDraft.email.trim());
      setQuoteAiNotice(notice);
      setMailNotice(notice);
      setDialog(null);
      setQuoteDraft(null);
    } catch (error) {
      setQuoteDraftError(error instanceof Error ? error.message : copy.quotes.emailSendError);
    } finally {
      setIsSendingQuoteDraft(false);
    }
  }

  function deleteItem(kind: "quotes", id: string): void;
  function deleteItem(kind: "expenses", id: string): void;
  function deleteItem(kind: "customers", id: string): void;
  function deleteItem(kind: "invoices", id: string): void;
  function deleteItem(kind: "projects", id: string): void;
  function deleteItem(kind: "recurringExpenses", id: string): void;
  function deleteItem(
    kind: "quotes" | "expenses" | "customers" | "invoices" | "projects" | "recurringExpenses",
    id: string,
  ) {
    const moduleId = kind === "quotes" || kind === "invoices"
      ? "sales"
      : kind === "expenses"
        ? "control"
        : kind === "projects"
          ? "projects"
          : kind === "recurringExpenses"
            ? "recurring"
            : "sales";
    if (!requireModuleAccess(moduleId)) return;
    updateData((current) => ({
      ...current,
      [kind]: current[kind].filter((item) => item.id !== id),
    }));
  }

  function openCustomerMessage(customer: Customer) {
    setCopyError(null);
    setCustomerMessageError(null);
    setCustomerMessageDraft({
      email: getCustomerEmail(customer)?.trim() ?? "",
      subject: "",
      body: "",
    });
    setDialog({ kind: "customer-message", item: customer });
    void generateCustomerMessage(customer);
  }

  async function generateCustomerMessage(customer: Customer) {
    if (isGeneratingCustomerMessage || isSendingCustomerMessage) return;
    if (!hasPlanFeature(settings.plan, "aiEmailReminders")) {
      requestUpgrade({ kind: "feature", feature: "aiEmailReminders" });
      return;
    }
    if (!requireModuleAccess("recover")) return;

    setCustomerMessageError(null);
    setMailNotice(null);
    setIsGeneratingCustomerMessage(true);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 35_000);
    try {
      const response = await fetch("/api/email/customers/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          name: customer.name,
          contactName: getCustomerContactName(customer),
          inactiveMonths: customer.inactiveMonths,
          language: settings.language,
          note: customer.note,
        }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const message = result && typeof result === "object" && "error" in result &&
          typeof result.error === "string"
          ? result.error
          : copy.invoices.aiDraftError;
        throw new Error(message);
      }
      if (
        !result ||
        typeof result !== "object" ||
        !("subject" in result) ||
        typeof result.subject !== "string" ||
        !result.subject.trim() ||
        !("body" in result) ||
        typeof result.body !== "string" ||
        !result.body.trim()
      ) {
        throw new Error(copy.invoices.aiDraftError);
      }
      const subject = result.subject;
      const body = result.body;
      setCustomerMessageDraft((current) => current
        ? { ...current, subject, body }
        : current);
    } catch (error) {
      setCustomerMessageError(
        error instanceof Error && error.name === "AbortError"
          ? copy.invoices.aiDraftTimeout
          : error instanceof Error
            ? error.message
            : copy.invoices.aiDraftError,
      );
    } finally {
      window.clearTimeout(timeoutId);
      setIsGeneratingCustomerMessage(false);
    }
  }

  async function copyCustomerMessage() {
    if (
      dialog?.kind !== "customer-message" ||
      !customerMessageDraft?.body.trim() ||
      isGeneratingCustomerMessage ||
      isSendingCustomerMessage
    ) return;
    const body = customerMessageDraft.body.trim();
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(body);
      } else if (!copyTextFallback(body)) {
        setCopyError(copy.customers.copyError);
        return;
      }
    } catch {
      try {
        if (!copyTextFallback(body)) {
          setCopyError(copy.customers.copyError);
          return;
        }
      } catch {
        setCopyError(copy.customers.copyError);
        return;
      }
    }
    setCopiedCustomerId(dialog.item.id);
    setCopyError(null);
    setCustomerMessageDraft(null);
    setDialog(null);
    window.setTimeout(() => setCopiedCustomerId(null), 2200);
  }

  async function sendCustomerMessage() {
    if (
      dialog?.kind !== "customer-message" ||
      !customerMessageDraft ||
      isGeneratingCustomerMessage ||
      isSendingCustomerMessage
    ) return;
    const customerId = dialog.item.id;
    setCustomerMessageError(null);
    setIsSendingCustomerMessage(true);
    try {
      const response = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: customerMessageDraft.email,
          subject: customerMessageDraft.subject,
          body: customerMessageDraft.body,
        }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        throw new Error(getEmailSendError(result, copy.invoices.emailSendError, copy.invoices.emailNotConfigured));
      }
      updateData((current) => ({
        ...current,
        customers: current.customers.map((customer) =>
          customer.id === customerId
            ? { ...customer, email: customerMessageDraft.email.trim() }
            : customer,
        ),
      }));
      setMailNotice(copy.invoices.emailSent(customerMessageDraft.email.trim()));
      setCustomerMessageDraft(null);
      setDialog(null);
    } catch (error) {
      setCustomerMessageError(error instanceof Error ? error.message : copy.invoices.emailSendError);
    } finally {
      setIsSendingCustomerMessage(false);
    }
  }

  function showSection(next: Section) {
    const moduleId = sectionModules[next];
    if (moduleId && !requireModuleAccess(moduleId)) return;
    if (section !== next) window.scrollTo(0, 0);
    setSection(next);
    setCopyError(null);
  }

  const priorityItems = [
    ...(hasModuleAccess(settings.plan, "sales") ? data.quotes : [])
      .filter((quote) => quote.status === "pending")
      .map((quote) => ({
        key: `quote-${quote.id}`,
        icon: "document" as const,
        title: `${copy.cockpit.quoteAction} ${quote.client}`,
        detail: `${formatCurrency(quote.amount, settings.language)} · ${copy.cockpit.pending}`,
        action: () => showSection("quotes"),
        tone: "amber",
      })),
    ...(hasModuleAccess(settings.plan, "control") ? [...anomalies.entries()] : []).map(([id, reasons]) => {
      const expense = data.expenses.find((item) => item.id === id);
      return expense
        ? {
            key: `expense-${id}`,
            icon: "alert" as const,
            title: `${copy.cockpit.reviewExpense} ${expense.supplier}`,
            detail: reasons.join(" · "),
            action: () => showSection("expenses"),
            tone: "rose",
          }
        : null;
    }).filter((item): item is NonNullable<typeof item> => item !== null),
      ...(hasModuleAccess(settings.plan, "recover")
        ? inactiveCustomers.map((customer) => ({
            key: `customer-${customer.id}`,
            icon: "users" as const,
            title: `${copy.cockpit.contactCustomer} ${customer.name}`,
            detail: `${customer.inactiveMonths} ${copy.cockpit.monthsInactive} · ${formatCurrency(customer.lastAmount, settings.language)}`,
            action: () => showSection("customers"),
            tone: "sage",
          }))
        : []),
    ...(hasModuleAccess(settings.plan, "recover")
        ? data.invoices
            .filter((invoice) => getInvoicePaymentState(invoice) !== "paid")
            .filter((invoice) => invoice.status !== "relanced" || getInvoiceDaysLate(invoice) >= 30)
            .slice(0, 3)
            .map((invoice) => ({
              key: `invoice-${invoice.id}`,
              icon: "send" as const,
              title: `${copy.cockpit.followInvoice} ${invoice.number}`,
              detail: `${invoice.company} · ${formatCurrency(invoice.amount, settings.language)} · ${getInvoiceDaysLate(invoice)}d`,
              action: () => showSection("customers"),
              tone: getInvoiceDaysLate(invoice) >= 30 ? "rose" : "amber",
            }))
        : []),
  ].slice(0, 6);

  const recentQuotes = hasModuleAccess(settings.plan, "sales")
    ? [...data.quotes]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    : [];

  const monthKey = new Date().toISOString().slice(0, 7);
  const quotesThisMonth = data.quotes.filter((quote) =>
    quote.createdAt.slice(0, 7) === monthKey,
  ).length;
  const invoicesThisMonth = data.invoices.filter((invoice) =>
    (invoice.createdAt ?? invoice.dueDate).slice(0, 7) ===
    monthKey,
  ).length;

  const navItems: { id: Section; label: string; icon: IconName }[] = [
    { id: "cockpit", label: copy.navigation.cockpit, icon: "grid" },
    { id: "quotes", label: copy.navigation.quotes, icon: "document" },
    { id: "clients", label: copy.navigation.clients, icon: "users" },
    { id: "invoices", label: copy.navigation.invoices, icon: "document" },
    { id: "projects", label: copy.navigation.projects, icon: "briefcase" },
    { id: "recurring", label: copy.navigation.recurring, icon: "repeat" },
    { id: "expenses", label: copy.navigation.expenses, icon: "wallet" },
    { id: "customers", label: copy.navigation.customers, icon: "send" },
  ];
  const availableNavItems = navItems.filter((item) => {
    const moduleId = sectionModules[item.id];
    return !moduleId || hasModuleAccess(settings.plan, moduleId);
  });
  const lockedNavItems = navItems.filter((item) => {
    const moduleId = sectionModules[item.id];
    return Boolean(moduleId && !hasModuleAccess(settings.plan, moduleId));
  });
  const newItemLabel = section === "expenses"
    ? copy.shell.expense
    : section === "clients" || section === "customers"
      ? copy.shell.customer
      : section === "invoices"
        ? copy.shell.invoice
        : section === "projects"
          ? copy.shell.project
          : section === "recurring"
            ? copy.shell.recurringExpense
            : copy.shell.quote;
  const topAddModule: ModuleId = sectionModules[section] ?? "sales";
  const currentQuota = section === "clients"
    ? { id: "customers" as const, count: data.customers.length }
    : section === "invoices"
      ? { id: "invoicesPerMonth" as const, count: invoicesThisMonth }
      : section === "projects"
        ? { id: "projects" as const, count: data.projects.length }
        : { id: "quotesPerMonth" as const, count: quotesThisMonth };
  const canAddCurrentItem =
    hasModuleAccess(settings.plan, topAddModule) &&
    (section === "expenses" || section === "recurring" ||
      canCreateWithinQuota(settings.plan, currentQuota.id, currentQuota.count));

  function renderNavItem(item: { id: Section; label: string; icon: IconName }, locked = false) {
    return (
      <button
        key={item.id}
        className={`nav-link ${section === item.id ? "active" : ""} ${locked ? "locked" : ""}`}
        onClick={() => showSection(item.id)}
        aria-current={section === item.id ? "page" : undefined}
        aria-label={locked ? `${item.label} — ${copy.access.locked}` : undefined}
      >
        <Icon name={item.icon} size={19} />
        <span>{item.label}</span>
        {locked && <Icon name="lock" size={14} />}
        {item.id === "expenses" && anomalies.size > 0 && (
          <span className="nav-count">{anomalies.size}</span>
        )}
      </button>
    );
  }

  return (
    <main className="app-shell" data-theme={settings.theme}>
      <aside className="sidebar">
        <button className="brand" onClick={() => showSection("cockpit")} aria-label={copy.shell.brandLabel}>
          <span className="brand-mark" aria-hidden="true">
            <Image src="/flux-logo.png" width={36} height={36} alt="" priority />
          </span>
          <span className="brand-name">Flux</span>
        </button>

        <div className="workspace-label">{copy.navigation.workspace}</div>
        <nav className="primary-nav" aria-label={copy.navigation.label}>
          <div className="nav-group">
            <span className="nav-group-label">{copy.navigation.activeModules}</span>
            {availableNavItems.map((item) => renderNavItem(item))}
          </div>
          {lockedNavItems.length > 0 && (
            <div className="nav-group nav-locked-group">
              <span className="nav-group-label">{copy.navigation.lockedModules}</span>
              {lockedNavItems.map((item) => renderNavItem(item, true))}
            </div>
          )}
          <div className="nav-group nav-settings-group">
            {renderNavItem({ id: "settings", label: copy.navigation.settings, icon: "settings" })}
          </div>
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-divider" />
          <div className="sidebar-version">FLUX · {copy.shell.private}</div>
        </div>
      </aside>

      <section className="main-panel">
        <header className="topbar">
          <div className="mobile-brand-group">
            <button className="mobile-brand" onClick={() => showSection("cockpit")} aria-label={copy.shell.brandLabel}>
              <span className="brand-mark" aria-hidden="true">
                <Image src="/flux-logo.png" width={28} height={28} alt="" priority />
              </span>
              <span className="brand-name">Flux</span>
            </button>
            <span className="mobile-workspace" title={settings.workspaceName || copy.shell.private}>
              {settings.workspaceName || copy.shell.private}
            </span>
          </div>
          <div className="breadcrumb">
            <span>Flux</span>
            <span className="breadcrumb-separator">/</span>
            <strong>{page.title}</strong>
          </div>
          <div className="topbar-actions">
            <span className="today-label">
              <Icon name="calendar" size={16} />
              {new Intl.DateTimeFormat(settings.language === "fr" ? "fr-FR" : "en-GB", {
                weekday: "long",
                day: "numeric",
                month: "long",
              }).format(new Date())}
            </span>
            <div className="toolbar-controls">
              <div className="language-switch" role="group" aria-label={copy.settings.selectLanguage}>
                {(["fr", "en"] as const).map((language) => (
                  <button
                    key={language}
                    className={settings.language === language ? "active" : ""}
                    aria-pressed={settings.language === language}
                    onClick={() => updateSettings((current) => ({ ...current, language }))}
                  >
                    {language.toUpperCase()}
                  </button>
                ))}
              </div>
              <button
                className="theme-toggle"
                aria-label={copy.settings[settings.theme === "dark" ? "light" : "dark"]}
                title={copy.settings[settings.theme === "dark" ? "light" : "dark"]}
                onClick={() => updateSettings((current) => ({
                  ...current,
                  theme: current.theme === "dark" ? "light" : "dark",
                }))}
              >
                <Icon name={settings.theme === "dark" ? "sun" : "moon"} size={17} />
              </button>
            </div>
            {section !== "settings" && section !== "customers" && <button className="button button-primary top-add" onClick={() => {
              if (!requireModuleAccess(topAddModule)) return;
              if (section === "expenses") openExpenseDialog();
              else if (section === "clients") openCustomerDialog();
              else if (section === "invoices") openInvoiceDialog();
              else if (section === "projects") openProjectDialog();
              else if (section === "recurring") openRecurringDialog();
              else openQuoteDialog();
            }} aria-label={canAddCurrentItem ? newItemLabel : copy.access.viewPlans}>
              <Icon name={canAddCurrentItem ? "plus" : "lock"} size={17} />
              <span>{canAddCurrentItem ? newItemLabel : copy.access.viewPlans}</span>
            </button>}
          </div>
        </header>

        <div className="page-content">
          {(storageError || settingsError) && (
            <div className="storage-alert" role="alert">
              <Icon name="alert" size={18} />
              <span>{copy.shell.storageError} {storageError || settingsError}</span>
            </div>
          )}
          {subscriptionError && (
            <div className="copy-alert" role="alert">{subscriptionError}</div>
          )}
          {mailNotice && section !== "settings" && section !== "quotes" && (
            <div className="copy-alert" role="status">{mailNotice}</div>
          )}

          {section === "cockpit" && (
            <Cockpit
              quotes={data.quotes}
              customers={data.customers}
              invoices={data.invoices}
              anomaliesCount={anomalies.size}
              priorities={priorityItems}
              recentQuotes={recentQuotes}
              copy={copy}
              language={settings.language}
              plan={settings.plan}
              onNavigate={showSection}
              onCreateQuote={openQuoteDialog}
              onAiFollowUp={generateQuoteFollowUp}
            />
          )}

          {section === "quotes" && (
            <QuotesPage
              quotes={data.quotes}
              copy={copy}
              language={settings.language}
              aiNotice={quoteAiNotice}
              onDismissAiNotice={() => setQuoteAiNotice(null)}
              onCreate={() => openQuoteDialog()}
              onEdit={openQuoteDialog}
              onDelete={(id) => deleteItem("quotes", id)}
              onStatusChange={updateQuoteStatus}
              onAiFollowUp={generateQuoteFollowUp}
              onCreateInvoice={createInvoiceFromQuote}
              onCreateProject={createProjectFromQuote}
              canCreateProject={
                hasModuleAccess(settings.plan, "projects") &&
                canCreateWithinQuota(settings.plan, "projects", data.projects.length)
              }
              canCreateInvoice={canCreateWithinQuota(
                settings.plan,
                "invoicesPerMonth",
                invoicesThisMonth,
              )}
              invoiceQuoteIds={new Set(data.invoices.flatMap((invoice) => invoice.quoteId ? [invoice.quoteId] : []))}
              projectQuoteIds={new Set(data.projects.flatMap((project) => project.quoteId ? [project.quoteId] : []))}
            />
          )}

          {section === "clients" && (
            <ClientsPage
              customers={data.customers}
              quotes={data.quotes}
              invoices={data.invoices}
              projects={data.projects}
              copy={copy}
              language={settings.language}
              onCreate={() => openCustomerDialog()}
              onEdit={openCustomerDialog}
              onCreateQuote={(customerId) => openQuoteDialog(undefined, customerId)}
            />
          )}

          {section === "invoices" && (
            <InvoicesPage
              invoices={data.invoices}
              copy={copy}
              language={settings.language}
              onCreate={openInvoiceDialog}
              onEdit={openInvoiceDialog}
              onPaymentStatusChange={updateInvoicePaymentStatus}
              onDelete={(id) => deleteItem("invoices", id)}
              onAiFollowUp={generateInvoiceFollowUp}
              isAiDraftGenerating={isGeneratingInvoiceDraft}
            />
          )}

          {section === "projects" && (
            <ProjectsPage
              projects={data.projects}
              copy={copy}
              language={settings.language}
              onCreate={() => openProjectDialog()}
              onEdit={openProjectDialog}
              onStatusChange={(id, status) => {
                if (!requireModuleAccess("projects")) return;
                updateData((current) => ({
                  ...current,
                  projects: current.projects.map((project) =>
                    project.id === id ? { ...project, status } : project,
                  ),
                }));
              }}
              onDelete={(id) => deleteItem("projects", id)}
            />
          )}

          {section === "expenses" && (
            <ExpensesPage
              expenses={data.expenses}
              anomalies={anomalies}
              copy={copy}
              language={settings.language}
              canDetectAnomalies={hasPlanFeature(settings.plan, "duplicatePriceDetection")}
              onRequestUpgrade={() => requestUpgrade({ kind: "feature", feature: "duplicatePriceDetection" })}
              onCreate={() => openExpenseDialog()}
              onEdit={openExpenseDialog}
              onDelete={(id) => deleteItem("expenses", id)}
            />
          )}

          {section === "recurring" && (
            <RecurringExpensesPage
              expenses={data.recurringExpenses}
              copy={copy}
              language={settings.language}
              onCreate={() => openRecurringDialog()}
              onEdit={openRecurringDialog}
              onDelete={(id) => deleteItem("recurringExpenses", id)}
            />
          )}

          {section === "customers" && (
            <CustomersPage
              customers={data.customers}
              invoices={data.invoices}
              copy={copy}
              language={settings.language}
              copiedCustomerId={copiedCustomerId}
              copyError={copyError}
              isAiDraftGenerating={isGeneratingInvoiceDraft}
              isCustomerMessageBusy={isGeneratingCustomerMessage || isSendingCustomerMessage}
              onCreate={() => openCustomerDialog()}
              onAddInvoice={openInvoiceDialog}
              onEdit={openCustomerDialog}
              onDelete={(id) => deleteItem("customers", id)}
              onPrepareMessage={openCustomerMessage}
              onAiFollowUp={generateInvoiceFollowUp}
              onStatusChange={updateInvoiceStatus}
              onEditInvoice={openInvoiceDialog}
            />
          )}
          {section === "settings" && (
            <SettingsPage
              copy={copy}
              language={settings.language}
              theme={settings.theme}
              plan={settings.plan}
              hasActiveSubscription={hasActiveSubscription}
              isCreator={isCreatorAccount}
              isPlanSimulated={isPlanSimulated}
              workspaceName={settings.workspaceName}
              gmailStatus={gmailStatus}
              gmailStatusError={gmailStatusError}
              isGmailStatusLoading={isGmailStatusLoading}
              mailNotice={mailNotice}
              isDisconnectingGmail={isDisconnectingGmail}
              onLanguageChange={(language) => updateSettings((current) => ({ ...current, language }))}
              onThemeChange={(theme: Theme) => updateSettings((current) => ({ ...current, theme }))}
              onCheckout={(selectedPlan) => { window.location.assign(`/api/stripe/checkout?plan=${selectedPlan}`); }}
              onWorkspaceNameChange={(workspaceName) => updateSettings((current) => ({ ...current, workspaceName }))}
              onDisconnectGmail={disconnectGmail}
            />
          )}
        </div>
      </section>

      {dialog && (
        <div className="dialog-backdrop" onClick={(event) => {
          if (event.target === event.currentTarget) {
            closeDialog();
          }
        }}>
          <section className="dialog-card" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
            <div className="dialog-heading">
              <div>
                <span className="eyebrow">
                  {dialog.kind === "upgrade"
                    ? copy.access.locked
                    : dialog.kind === "quote-draft" || dialog.kind === "invoice-draft" || dialog.kind === "quote-generating"
                      ? "IA"
                    : dialog.kind === "invoice-generating"
                      ? "IA"
                    : dialog.kind === "customer-message"
                      ? copy.customers.eyebrow
                    : dialog.item ? copy.forms.edit : copy.forms.create}
                </span>
                <h2 id="dialog-title">
                  {dialog.kind === "upgrade"
                    ? copy.access.upgradeTitle(copy.access.planNames[dialog.requiredPlan])
                    : dialog.kind === "quote-draft"
                      ? copy.quotes.draftTitle
                    : dialog.kind === "quote-generating"
                      ? copy.quotes.generating
                    : dialog.kind === "invoice-generating"
                      ? copy.invoices.generating
                    : dialog.kind === "invoice-draft"
                      ? copy.invoices.draftTitle
                    : dialog.kind === "customer-message"
                      ? copy.invoices.draftTitle
                    : dialog.kind === "quote"
                      ? dialog.item ? copy.forms.editQuote : copy.forms.addQuote
                      : dialog.kind === "expense"
                        ? dialog.item ? copy.forms.editExpense : copy.forms.addExpense
                      : dialog.kind === "customer"
                        ? dialog.item ? copy.forms.editCustomer : copy.forms.addCustomer
                        : dialog.kind === "invoice"
                          ? dialog.item ? copy.forms.editInvoice : copy.shell.invoice
                          : dialog.kind === "project"
                            ? dialog.item ? copy.forms.editProject : copy.forms.addProject
                            : dialog.kind === "recurring"
                              ? dialog.item ? copy.forms.editRecurringExpense : copy.forms.addRecurringExpense
                              : ""}
                </h2>
              </div>
              <button
                type="button"
                className="icon-button dialog-close"
                disabled={
                  isGeneratingInvoiceDraft ||
                  isSendingInvoiceDraft ||
                  isGeneratingCustomerMessage ||
                  isSendingCustomerMessage ||
                  isGeneratingQuoteDraft ||
                  isSendingQuoteDraft
                }
                onClick={closeDialog}
                aria-label={copy.forms.close}
              >
                <Icon name="close" />
              </button>
            </div>

            {dialog.kind === "upgrade" && (
              <div className="upgrade-content">
                <span className="upgrade-lock"><Icon name="lock" size={20} /></span>
                <p>
                  {dialog.target.kind === "quota"
                    ? copy.access.quotaUpgradeDescription(
                        copy.access.quotaNames[dialog.target.quota],
                        new Intl.NumberFormat(settings.language === "fr" ? "fr-FR" : "en-GB")
                          .format(dialog.target.limit),
                        copy.access.planNames[dialog.requiredPlan],
                      )
                    : copy.access.upgradeDescription(
                        dialog.target.kind === "module"
                          ? copy.access.moduleNames[dialog.target.module]
                          : copy.access.featureNames[dialog.target.feature],
                        copy.access.planNames[dialog.requiredPlan],
                      )}
                </p>
                <div className="upgrade-actions">
                  <button className="button button-quiet" onClick={() => setDialog(null)}>
                    {copy.common.close}
                  </button>
                  <button
                    className="button button-primary"
                    onClick={() => {
                      setDialog(null);
                      showSection("settings");
                      scrollToPlans.current = true;
                    }}
                  >
                    {copy.access.viewPlans}
                  </button>
                </div>
              </div>
            )}

            {dialog.kind === "invoice-generating" && (
              <div className="invoice-draft-loading" role="status" aria-live="polite">
                <span className="loading-mark">F</span>
                <p>{copy.invoices.generating}</p>
              </div>
            )}

            {dialog.kind === "quote-generating" && (
              <div className="invoice-draft-loading" role="status" aria-live="polite">
                <span className="loading-mark">F</span>
                <p>{copy.quotes.generating}</p>
              </div>
            )}

            {dialog.kind === "invoice-draft" && invoiceDraft && (
              <form className="quote-draft" onSubmit={(event) => {
                event.preventDefault();
                void sendInvoiceFollowUp();
              }}>
                <label className="field field-wide">
                  {copy.invoices.recipientEmail}
                  <input
                    type="email"
                    required
                    value={invoiceDraft.email}
                    placeholder={copy.forms.customerEmailPlaceholder}
                    onChange={(event) => setInvoiceDraft((current) => current ? { ...current, email: event.target.value } : current)}
                  />
                </label>
                <label className="field field-wide">
                  {copy.invoices.subject}
                  <input
                    type="text"
                    required
                    value={invoiceDraft.subject}
                    onChange={(event) => setInvoiceDraft((current) => current ? { ...current, subject: event.target.value } : current)}
                  />
                </label>
                <label className="field field-wide">
                  {copy.invoices.message}
                  <textarea
                    className="quote-draft-body"
                    required
                    value={invoiceDraft.body}
                    onChange={(event) => setInvoiceDraft((current) => current ? { ...current, body: event.target.value } : current)}
                  />
                </label>
                {invoiceDraftError && <p className="form-error" role="alert">{invoiceDraftError}</p>}
                <div className="quote-draft-actions">
                  <button
                    type="button"
                    className="button button-quiet"
                    disabled={isGeneratingInvoiceDraft || isSendingInvoiceDraft}
                    onClick={() => generateInvoiceFollowUp(dialog.item, invoiceDraft.email)}
                  >
                    <Icon name="spark" size={15} />
                    {copy.invoices.regenerate}
                  </button>
                  <div>
                    <button type="button" className="button button-quiet" onClick={closeDialog}>
                      {copy.forms.cancel}
                    </button>
                    <button
                      type="submit"
                      className="button button-primary"
                      disabled={isSendingInvoiceDraft || !invoiceDraft.subject.trim() || !invoiceDraft.body.trim()}
                    >
                      <Icon name="send" size={15} />
                      {isSendingInvoiceDraft ? copy.invoices.sending : copy.invoices.sendEmail}
                    </button>
                  </div>
                </div>
              </form>
            )}

            {dialog.kind === "customer-message" && customerMessageDraft !== null && (
              <form className="quote-draft" onSubmit={(event) => {
                event.preventDefault();
                void sendCustomerMessage();
              }}>
                <label className="field field-wide">
                  {copy.invoices.recipientEmail}
                  <input
                    type="email"
                    maxLength={254}
                    required
                    value={customerMessageDraft.email}
                    placeholder={copy.forms.customerEmailPlaceholder}
                    disabled={isGeneratingCustomerMessage || isSendingCustomerMessage}
                    onChange={(event) => setCustomerMessageDraft((current) => current
                      ? { ...current, email: event.target.value }
                      : current)}
                    data-dialog-autofocus
                  />
                </label>
                <label className="field field-wide">
                  {copy.invoices.subject}
                  <input
                    type="text"
                    maxLength={200}
                    required
                    value={customerMessageDraft.subject}
                    disabled={isGeneratingCustomerMessage || isSendingCustomerMessage}
                    onChange={(event) => setCustomerMessageDraft((current) => current
                      ? { ...current, subject: event.target.value }
                      : current)}
                  />
                </label>
                <label className="field field-wide">
                  {copy.invoices.message}
                  <textarea
                    className="quote-draft-body"
                    required
                    maxLength={8000}
                    value={customerMessageDraft.body}
                    disabled={isGeneratingCustomerMessage || isSendingCustomerMessage}
                    onChange={(event) => setCustomerMessageDraft((current) => current
                      ? { ...current, body: event.target.value }
                      : current)}
                  />
                </label>
                {copyError && <p className="form-error" role="alert">{copyError}</p>}
                {customerMessageError && <p className="form-error" role="alert">{customerMessageError}</p>}
                <div className="quote-draft-actions customer-message-actions">
                  <button
                    type="button"
                    className="button button-quiet"
                    disabled={isGeneratingCustomerMessage || isSendingCustomerMessage}
                    onClick={() => generateCustomerMessage(dialog.item)}
                  >
                    <Icon name="spark" size={15} />
                    {isGeneratingCustomerMessage
                      ? copy.customers.generateWithAiLoading
                      : copy.customers.generateWithAi}
                  </button>
                  <div>
                    <button
                      type="button"
                      className="button button-quiet"
                      disabled={isGeneratingCustomerMessage || isSendingCustomerMessage}
                      onClick={closeDialog}
                    >
                      {copy.forms.cancel}
                    </button>
                    <button
                      type="button"
                      className="button button-quiet"
                      disabled={!customerMessageDraft.body.trim() || isGeneratingCustomerMessage || isSendingCustomerMessage}
                      onClick={() => void copyCustomerMessage()}
                    >
                      <Icon name="document" size={15} />
                      {copy.customers.copyMessage}
                    </button>
                    <button
                      type="submit"
                      className="button button-primary"
                      disabled={isGeneratingCustomerMessage || isSendingCustomerMessage || !customerMessageDraft.email.trim() || !customerMessageDraft.subject.trim() || !customerMessageDraft.body.trim()}
                    >
                      <Icon name="send" size={15} />
                      {isSendingCustomerMessage ? copy.invoices.sending : copy.customers.sendMessage}
                    </button>
                  </div>
                </div>
              </form>
            )}

            {dialog.kind === "quote-draft" && quoteDraft && (
              <form className="quote-draft" onSubmit={(event) => {
                event.preventDefault();
                void sendQuoteDraft();
              }}>
                <label className="field field-wide">
                  {copy.quotes.recipientEmail}
                  <input
                    type="email"
                    required
                    value={quoteDraft.email}
                    placeholder={copy.forms.customerEmailPlaceholder}
                    onChange={(event) => setQuoteDraft((current) => current ? { ...current, email: event.target.value } : current)}
                  />
                </label>
                <label className="field field-wide">
                  {copy.quotes.subject}
                  <input
                    type="text"
                    required
                    value={quoteDraft.subject}
                    onChange={(event) => setQuoteDraft((current) => current ? { ...current, subject: event.target.value } : current)}
                  />
                </label>
                <label className="field field-wide">
                  {copy.quotes.message}
                  <textarea
                    className="quote-draft-body"
                    required
                    value={quoteDraft.body}
                    onChange={(event) => setQuoteDraft((current) => current ? { ...current, body: event.target.value } : current)}
                  />
                </label>
                {quoteDraftError && <p className="form-error" role="alert">{quoteDraftError}</p>}
                <div className="quote-draft-actions">
                  <button
                    type="button"
                    className="button button-quiet"
                    disabled={isGeneratingQuoteDraft || isSendingQuoteDraft}
                    onClick={() => generateQuoteFollowUp(dialog.item)}
                  >
                    <Icon name="spark" size={15} />
                    {copy.quotes.regenerate}
                  </button>
                  <div>
                    <button type="button" className="button button-quiet" onClick={closeDialog}>
                      {copy.forms.cancel}
                    </button>
                    <button
                      type="submit"
                      className="button button-primary"
                      disabled={isSendingQuoteDraft || !quoteDraft.email.trim() || !quoteDraft.subject.trim() || !quoteDraft.body.trim()}
                    >
                      <Icon name="send" size={15} />
                      {isSendingQuoteDraft ? copy.quotes.sending : copy.quotes.confirmAndSend}
                    </button>
                  </div>
                </div>
              </form>
            )}

            {dialog.kind === "quote" && (
              <form className="form-grid" onSubmit={saveQuote}>
                {data.customers.length > 0 && <label className="field field-wide">{copy.forms.selectClient}
                  <select name="customerId" defaultValue={dialog.customerId ?? dialog.item?.customerId ?? data.customers.find((customer) => customer.name.trim().toLocaleLowerCase() === dialog.item?.client.trim().toLocaleLowerCase())?.id ?? ""}>
                    <option value="">{copy.forms.newCustomer}</option>
                    {data.customers.map((customer) => <option value={customer.id} key={customer.id}>{customer.name}{getCustomerEmail(customer) ? ` · ${getCustomerEmail(customer)}` : ""}</option>)}
                  </select>
                </label>}
                <label className="field field-wide">{copy.forms.customerName}
                  <input name="client" maxLength={120} placeholder={copy.forms.namePlaceholder} defaultValue={dialog.item?.client ?? data.customers.find((customer) => customer.id === dialog.customerId)?.name ?? ""} data-dialog-autofocus />
                </label>
                <label className="field field-wide">{copy.forms.customerEmail}
                  <input name="email" type="email" maxLength={254} placeholder={copy.forms.customerEmailPlaceholder} defaultValue={dialog.item?.email ?? ""} />
                </label>
                <label className="field">{copy.forms.amount}
                  <input name="amount" type="number" min="0.01" step="0.01" required placeholder={copy.forms.amountPlaceholder} defaultValue={dialog.item ? moneyInput(dialog.item.amount) : ""} />
                </label>
                <label className="field">{copy.forms.probability}
                  <input name="probability" type="number" min="0" max="100" step="1" required placeholder={copy.forms.probabilityPlaceholder} defaultValue={dialog.item?.probability ?? ""} />
                </label>
                <label className="field field-wide">{copy.forms.status}
                  <select name="status" defaultValue={dialog.item?.status ?? "pending"}>
                    {(["pending", "followed-up", "signed", "lost"] as const).map((value) => <option value={value} key={value}>{getQuoteStatusLabel(value, copy)}</option>)}
                  </select>
                </label>
                <FormActions copy={copy} onCancel={() => setDialog(null)} />
              </form>
            )}

            {dialog.kind === "expense" && (
              <form className="form-grid" onSubmit={saveExpense}>
                <label className="field">{copy.forms.supplier}
                  <input name="supplier" required maxLength={120} placeholder={copy.forms.supplierPlaceholder} defaultValue={dialog.item?.supplier ?? ""} data-dialog-autofocus />
                </label>
                <label className="field">{copy.forms.label}
                  <input name="label" required maxLength={160} placeholder={copy.forms.labelPlaceholder} defaultValue={dialog.item?.label ?? ""} />
                </label>
                <label className="field">{copy.forms.amount}
                  <input name="amount" type="number" min="0.01" step="0.01" required placeholder={copy.forms.amountPlaceholder} defaultValue={dialog.item ? moneyInput(dialog.item.amount) : ""} />
                </label>
                <label className="field">{copy.forms.date}
                  <input name="date" type="date" required defaultValue={dialog.item?.date ?? new Date().toISOString().slice(0, 10)} />
                </label>
                <FormActions copy={copy} onCancel={() => setDialog(null)} />
              </form>
            )}

            {dialog.kind === "customer" && (
              <form className="form-grid" onSubmit={saveCustomer}>
                <label className="field field-wide">{copy.forms.customerName}
                  <input name="name" required maxLength={120} placeholder={copy.forms.namePlaceholder} defaultValue={dialog.item?.name ?? ""} data-dialog-autofocus />
                </label>
                <label className="field">{copy.forms.contactName}
                  <input name="contactName" maxLength={120} placeholder={copy.forms.contactName} defaultValue={dialog.item?.contactName ?? ""} />
                </label>
                <label className="field">{copy.forms.customerEmail}
                  <input name="email" type="email" maxLength={254} placeholder={copy.forms.customerEmailPlaceholder} defaultValue={dialog.item?.email ?? ""} />
                </label>
                <label className="field field-wide">{copy.forms.contact}
                  <input name="contact" required maxLength={160} placeholder={copy.forms.contactPlaceholder} defaultValue={dialog.item?.contact ?? ""} />
                </label>
                <label className="field">{copy.forms.lastAmount}
                  <input name="lastAmount" type="number" min="0" step="0.01" required placeholder={copy.forms.amountPlaceholder} defaultValue={dialog.item ? moneyInput(dialog.item.lastAmount) : ""} />
                </label>
                <label className="field">{copy.forms.inactivity}
                  <input name="inactiveMonths" type="number" min="0" step="1" required placeholder="0" defaultValue={dialog.item?.inactiveMonths ?? ""} />
                </label>
                <FormActions copy={copy} onCancel={() => setDialog(null)} />
              </form>
            )}

            {dialog.kind === "invoice" && (
              <form className="form-grid" onSubmit={saveInvoice}>
                {data.customers.length > 0 && <label className="field field-wide">{copy.forms.selectClient}
                  <select name="customerId" defaultValue={dialog.item?.customerId ?? ""}>
                    <option value="">{copy.forms.newCustomer}</option>
                    {data.customers.map((customer) => <option value={customer.id} key={customer.id}>{customer.name}</option>)}
                  </select>
                </label>}
                <label className="field">{copy.forms.invoiceNumber}
                  <input name="number" required maxLength={40} placeholder="FA-2026-0438" defaultValue={dialog.item?.number ?? ""} />
                </label>
                <label className="field">{copy.forms.company}
                  <input name="company" maxLength={120} placeholder={copy.forms.companyPlaceholder} defaultValue={dialog.item?.company ?? ""} />
                </label>
                <label className="field field-wide">{copy.forms.contactName}
                  <input name="contact" maxLength={160} placeholder={copy.forms.contactPlaceholder} defaultValue={dialog.item?.contact ?? ""} />
                </label>
                <label className="field field-wide">{copy.forms.customerEmail}
                  <input name="email" type="email" maxLength={254} placeholder={copy.forms.customerEmailPlaceholder} defaultValue={dialog.item?.email ?? ""} />
                </label>
                <label className="field">{settings.language === "fr" ? "Montant (€)" : "Amount (€)"}
                  <input name="amount" type="number" min="0.01" step="0.01" required placeholder="0,00" defaultValue={dialog.item?.amount ?? ""} />
                </label>
                <label className="field">{copy.forms.dueDate}
                  <input name="dueDate" type="date" required defaultValue={dialog.item?.dueDate ?? new Date().toISOString().slice(0, 10)} />
                </label>
                <FormActions copy={copy} onCancel={() => setDialog(null)} />
              </form>
            )}

            {dialog.kind === "project" && (
              <form className="form-grid" onSubmit={saveProject}>
                <label className="field field-wide">{copy.forms.projectName}
                  <input name="name" required maxLength={120} defaultValue={dialog.item?.name ?? ""} data-dialog-autofocus />
                </label>
                {data.customers.length > 0 && <label className="field field-wide">{copy.forms.selectClient}
                  <select name="customerId" defaultValue={dialog.item?.customerId ?? ""}>
                    <option value="">{copy.forms.newCustomer}</option>
                    {data.customers.map((customer) => <option value={customer.id} key={customer.id}>{customer.name}</option>)}
                  </select>
                </label>}
                <label className="field field-wide">{copy.forms.customerName}
                  <input name="client" maxLength={120} defaultValue={dialog.item?.client ?? data.customers.find((customer) => customer.id === dialog.item?.customerId)?.name ?? ""} />
                </label>
                <label className="field">{copy.forms.amount}
                  <input name="budget" type="number" min="0" step="0.01" required defaultValue={dialog.item ? moneyInput(dialog.item.budget) : ""} />
                </label>
                <label className="field">{copy.forms.projectStatus}
                  <select name="status" defaultValue={dialog.item?.status ?? "planned"}>
                    <option value="planned">{copy.projects.planned}</option>
                    <option value="in-progress">{copy.projects.inProgress}</option>
                    <option value="completed">{copy.projects.completed}</option>
                  </select>
                </label>
                <FormActions copy={copy} onCancel={() => setDialog(null)} />
              </form>
            )}

            {dialog.kind === "recurring" && (
              <form className="form-grid" onSubmit={saveRecurringExpense}>
                <label className="field">{copy.forms.supplier}
                  <input name="supplier" required maxLength={120} defaultValue={dialog.item?.supplier ?? ""} data-dialog-autofocus />
                </label>
                <label className="field">{copy.forms.label}
                  <input name="label" required maxLength={160} defaultValue={dialog.item?.label ?? ""} />
                </label>
                <label className="field">{copy.forms.amount}
                  <input name="amount" type="number" min="0.01" step="0.01" required defaultValue={dialog.item ? moneyInput(dialog.item.amount) : ""} />
                </label>
                <label className="field">{copy.forms.recurringFrequency}
                  <select name="frequency" defaultValue={dialog.item?.frequency ?? "monthly"}>
                    <option value="monthly">{copy.recurring.monthly}</option>
                    <option value="yearly">{copy.recurring.yearly}</option>
                  </select>
                </label>
                <label className="field field-wide">{copy.forms.nextDate}
                  <input name="nextDate" type="date" required defaultValue={dialog.item?.nextDate ?? new Date().toISOString().slice(0, 10)} />
                </label>
                <FormActions copy={copy} onCancel={() => setDialog(null)} />
              </form>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

type PriorityItem = {
  key: string;
  icon: IconName;
  title: string;
  detail: string;
  action: () => void;
  tone: string;
};

function Cockpit({
  quotes,
  customers,
  invoices,
  anomaliesCount,
  priorities,
  recentQuotes,
  copy,
  language,
  plan,
  onNavigate,
  onCreateQuote,
  onAiFollowUp,
}: {
  quotes: Quote[];
  customers: Customer[];
  invoices: Invoice[];
  anomaliesCount: number;
  priorities: PriorityItem[];
  recentQuotes: Quote[];
  copy: Copy;
  language: Language;
  plan: PlanId;
  onNavigate: (section: Section) => void;
  onCreateQuote: () => void;
  onAiFollowUp: (quote: Quote) => void;
}) {
  const potential = customers
    .filter((customer) => customer.inactiveMonths >= 6)
    .reduce((total, customer) => total + customer.lastAmount, 0);
  const unpaidInvoices = invoices.filter((invoice) => getInvoicePaymentState(invoice) !== "paid");
  const overdueInvoices = unpaidInvoices.filter((invoice) => getInvoiceDaysLate(invoice) > 0);
  const overdueAmount = unpaidInvoices.reduce((total, invoice) => total + invoice.amount, 0);
  const pendingQuotes = quotes.filter((quote) => quote.status === "pending" || quote.status === "followed-up");
  const cashToCollect = overdueAmount + pendingQuotes.reduce((total, quote) => total + quote.amount, 0);
  const lossesAvoidable = potential + anomaliesCount * 120;
  const lostQuotes = quotes.filter((quote) => quote.status === "lost").length;
  const signedQuotes = quotes.filter((quote) => quote.status === "signed").length;
  const healthScore = Math.max(35, 100 - (lostQuotes * 10) - (unpaidInvoices.filter((invoice) => getInvoiceDaysLate(invoice) >= 30).length * 4) + (signedQuotes * 2));
  const priorityCount = priorities.length;

  const metrics: {
    label: string;
    value: string;
    note: string;
    icon: IconName;
    tone: string;
    section: Section;
    module: ModuleId;
    feature?: PlanFeature;
  }[] = [
    { label: language === "fr" ? "Cash à encaisser" : "Cash to collect", value: formatCurrency(cashToCollect, language), note: `${overdueInvoices.length} ${language === "fr" ? "factures en retard" : "overdue invoices"} · ${pendingQuotes.length} ${language === "fr" ? "devis" : "quotes"}`, icon: "wallet", tone: "green", section: "invoices", module: "sales" },
    { label: language === "fr" ? "Pertes évitables" : "Preventable losses", value: formatCurrency(lossesAvoidable, language), note: `${customers.filter((customer) => customer.inactiveMonths >= 6).length} relances · ${anomaliesCount} anomalies`, icon: "trend", tone: "amber", section: "customers", module: "recover" },
    { label: language === "fr" ? "Score de santé" : "Health score", value: `${healthScore}/100`, note: healthScore >= 75 ? (language === "fr" ? "Fiable" : "Reliable") : (language === "fr" ? "À renforcer" : "Needs attention"), icon: "check", tone: "violet", section: "cockpit", module: "sales", feature: "healthScore" },
    { label: language === "fr" ? "Actions prioritaires" : "Priority actions", value: String(priorityCount), note: priorityCount ? (language === "fr" ? "À traiter aujourd'hui" : "To handle today") : (language === "fr" ? "Rien d'urgent" : "Nothing urgent"), icon: "alert", tone: "blue", section: "cockpit", module: "sales" },
  ];
  const canAccessActionFeed = hasPlanFeature(plan, "realTimeActionFeed");
  const visiblePriorities = canAccessActionFeed ? priorities : [];
  const visibleMetrics = metrics.filter((metric) => {
    const moduleAccess = hasModuleAccess(plan, metric.module);
    const featureAccess = !metric.feature || hasPlanFeature(plan, metric.feature);
    return moduleAccess && featureAccess;
  });

  return (
    <>
      <div className="page-intro cockpit-intro">
        <div>
          <span className="eyebrow">{copy.cockpit.eyebrow}</span>
          <h1>{copy.pages.cockpit.title}</h1>
          <p>{copy.pages.cockpit.description}</p>
        </div>
        <button className="button button-primary" onClick={onCreateQuote}>
          <Icon name="plus" size={17} />
          {copy.cockpit.createQuote}
        </button>
      </div>

      <div className={`metrics-grid metrics-grid-count-${visibleMetrics.length}`}>
        {visibleMetrics.map((metric) => {
          return (
            <button
              key={metric.label}
              className="metric-card"
              aria-label={metric.label}
              onClick={() => onNavigate(metric.section)}
            >
              <div className="metric-top">
                <span className={`metric-icon ${metric.tone}`}>
                  <Icon name={metric.icon} size={19} />
                </span>
                <Icon name="arrow" size={15} />
              </div>
              <span className="metric-label">{metric.label}</span>
              <strong className="metric-value">{metric.value}</strong>
              <span className="metric-note">{metric.note}</span>
            </button>
          );
        })}
      </div>

      <div className={`dashboard-columns ${canAccessActionFeed ? "" : "dashboard-columns-single"}`}>
        {canAccessActionFeed && <section className="surface priority-panel">
          <div className="surface-heading">
            <div>
              <div className="section-title-row"><h2>{copy.cockpit.actions}</h2><span className="subtle-count">{visiblePriorities.length}</span></div>
              <p>{copy.cockpit.actionDescription}</p>
            </div>
            <span className="heading-mark"><Icon name="spark" size={18} /></span>
          </div>
          {visiblePriorities.length > 0 ? (
            <div className="priority-list">
              {visiblePriorities.map((item) => (
                <button className="priority-row" key={item.key} onClick={item.action}>
                  <span className={`priority-icon ${item.tone}`}><Icon name={item.icon} size={17} /></span>
                  <span className="priority-copy"><strong>{item.title}</strong><span>{item.detail}</span></span>
                  <Icon name="arrow" size={15} />
                </button>
              ))}
            </div>
          ) : (
            <div className="empty-inline">
              <span className="empty-symbol"><Icon name="check" size={20} /></span>
              <div><strong>{copy.cockpit.noActions}</strong><p>{copy.cockpit.noActionsDescription}</p></div>
            </div>
          )}
        </section>}

        {hasModuleAccess(plan, "sales") ? (
          <section className="surface recent-panel">
            <div className="surface-heading">
              <div><h2>{copy.cockpit.recentQuotes}</h2><p>{copy.cockpit.recentDescription}</p></div>
              <button className="text-button" onClick={() => onNavigate("quotes")}>{copy.cockpit.seeAll} <Icon name="arrow" size={14} /></button>
            </div>
            {recentQuotes.length > 0 ? (
              <div className="recent-table-scroll">
                <div className="recent-table">
                  <div className="recent-table-head" aria-hidden="true">
                    <span>{copy.quotes.client}</span>
                    <span>{copy.quotes.amount}</span>
                    <span>{copy.quotes.probability}</span>
                    <span>{copy.quotes.status}</span>
                    <span>{copy.cockpit.followUpPossibility}</span>
                    <span>{copy.quotes.added}</span>
                  </div>
                  {recentQuotes.map((quote) => {
                  const canFollowUp = quote.status === "pending" || quote.status === "followed-up";
                  const probability = Number.isFinite(quote.probability) ? quote.probability : 50;
                  const parsedDate = new Date(quote.createdAt);
                  const date = Number.isNaN(parsedDate.getTime())
                    ? new Date()
                    : parsedDate;
                  const dateLabel = new Intl.DateTimeFormat(
                    language === "fr" ? "fr-FR" : "en-GB",
                    { day: "numeric", month: "short", year: "numeric" },
                  ).format(date);
                  return (
                    <div className="recent-table-row" key={quote.id}>
                      <span className="recent-client">
                        <span className="recent-avatar">{quote.client.trim().slice(0, 1).toLocaleUpperCase() || "?"}</span>
                        <span className="recent-client-copy">
                          <strong>{quote.client || "—"}</strong>
                          <small>{quote.email?.trim() || "—"}</small>
                        </span>
                      </span>
                      <strong className="recent-amount">{Number.isFinite(quote.amount) ? formatCurrency(quote.amount, language) : "—"}</strong>
                      <span className="recent-probability">
                        <span><i style={{ width: `${Math.max(0, Math.min(100, probability))}%` }} /></span>
                        {probability}%
                      </span>
                      <span className={`recent-status status-${quote.status}`}>{getQuoteStatusLabel(quote.status, copy)}</span>
                      <span className="recent-follow-up">
                        <span className={`follow-up-badge ${canFollowUp ? "available" : "unavailable"}`}>
                          {quote.status === "pending"
                            ? copy.cockpit.followUpAvailable
                            : quote.status === "followed-up"
                              ? copy.cockpit.followUpAlreadySent
                              : copy.cockpit.followUpNotRelevant}
                        </span>
                        {canFollowUp && (
                          <button
                            type="button"
                            className="button button-quiet recent-ai-follow-up"
                            onClick={() => onAiFollowUp(quote)}
                            aria-label={`${copy.cockpit.aiFollowUp}: ${quote.client}`}
                          >
                            <Icon name="spark" size={13} />
                            <span>{copy.cockpit.aiFollowUp}</span>
                          </button>
                        )}
                      </span>
                      <time className="recent-date" dateTime={date.toISOString()}>{dateLabel}</time>
                    </div>
                  );
                  })}
                </div>
              </div>
            ) : (
              <div className="recent-empty">
                <span className="empty-document"><Icon name="document" size={22} /></span>
                <strong>{copy.cockpit.firstQuote}</strong>
                <p>{copy.cockpit.firstQuoteDescription}</p>
                <button className="text-button" onClick={onCreateQuote}>{copy.cockpit.createQuote} <Icon name="arrow" size={14} /></button>
              </div>
            )}
          </section>
        ) : null}
      </div>

      <section className="bottom-note">
        <span className="bottom-note-mark">f.</span>
        <div><strong>{copy.cockpit.noteTitle}</strong><span>{copy.cockpit.noteDescription}</span></div>
        {hasModuleAccess(plan, "sales") && (
          <button className="text-button" onClick={() => onNavigate("clients")}>{copy.cockpit.addCustomer} <Icon name="arrow" size={14} /></button>
        )}
      </section>
    </>
  );
}

function PageIntro({
  eyebrow,
  title,
  description,
  buttonLabel,
  onCreate,
}: {
  eyebrow: string;
  title: string;
  description: string;
  buttonLabel: string;
  onCreate: () => void;
}) {
  return (
    <div className="page-intro">
      <div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>
      <button className="button button-primary" onClick={onCreate}><Icon name="plus" size={17} /> {buttonLabel}</button>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  description,
  buttonLabel,
  onCreate,
}: {
  icon: IconName;
  title: string;
  description: string;
  buttonLabel: string;
  onCreate: () => void;
}) {
  return (
    <div className="empty-state">
      <span className="empty-state-icon"><Icon name={icon} size={24} /></span>
      <h2>{title}</h2>
      <p>{description}</p>
      <button className="button button-primary" onClick={onCreate}><Icon name="plus" size={17} /> {buttonLabel}</button>
    </div>
  );
}

function QuotesPage({
  quotes,
  copy,
  language,
  aiNotice,
  onDismissAiNotice,
  onCreate,
  onEdit,
  onDelete,
  onStatusChange,
  onAiFollowUp,
  onCreateInvoice,
  onCreateProject,
  canCreateProject,
  canCreateInvoice,
  invoiceQuoteIds,
  projectQuoteIds,
}: {
  quotes: Quote[];
  copy: Copy;
  language: Language;
  aiNotice: string | null;
  onDismissAiNotice: () => void;
  onCreate: () => void;
  onEdit: (item: Quote) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: QuoteStatus) => void;
  onAiFollowUp: (item: Quote) => void;
  onCreateInvoice: (item: Quote) => void;
  onCreateProject: (item: Quote) => void;
  canCreateProject: boolean;
  canCreateInvoice: boolean;
  invoiceQuoteIds: Set<string>;
  projectQuoteIds: Set<string>;
}) {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  return (
    <>
      <PageIntro eyebrow={copy.quotes.eyebrow} title={copy.pages.quotes.title} description={copy.pages.quotes.description} buttonLabel={copy.quotes.add} onCreate={onCreate} />
      {aiNotice && <div className="copy-alert quote-ai-notice" role="status"><span>{aiNotice}</span><button type="button" className="icon-button" onClick={onDismissAiNotice} aria-label={copy.forms.close}><Icon name="close" size={14} /></button></div>}
      {quotes.length === 0 ? (
        <EmptyState icon="document" title={copy.quotes.emptyTitle} description={copy.quotes.emptyDescription} buttonLabel={copy.quotes.emptyAction} onCreate={onCreate} />
      ) : (
        <section className="surface data-surface">
          <div className="table-heading"><div><h2>{copy.quotes.tableTitle}</h2><span>{quotes.length} {quotes.length === 1 ? copy.quotes.item : copy.quotes.items}</span></div><span className="table-total">{formatCurrency(quotes.filter((q) => q.status === "pending" || q.status === "followed-up").reduce((sum, quote) => sum + quote.amount, 0), language)} <small>{copy.quotes.inProgress}</small></span></div>
          <div className="table-scroll"><table><thead><tr><th>{copy.quotes.client}</th><th>{copy.quotes.amount}</th><th>{copy.quotes.probability}</th><th>{copy.quotes.status}</th><th>{copy.quotes.added}</th><th><span className="sr-only">{copy.quotes.edit}</span></th></tr></thead>
            <tbody>{quotes.map((quote) => (
              <tr key={quote.id}>
                <td><span className="client-cell"><span className="table-avatar">{quote.client.trim().slice(0, 1).toLocaleUpperCase()}</span><span className="client-details"><strong>{quote.client}</strong>{quote.email && <small>{quote.email}</small>}</span></span></td>
                <td className="amount-cell">{formatCurrency(quote.amount, language)}</td>
                <td><span className="probability"><span><i style={{ width: `${quote.probability}%` }} /></span>{quote.probability}%</span></td>
                <td><select className={`status-select status-${quote.status}`} value={quote.status} onChange={(event) => onStatusChange(quote.id, event.target.value as QuoteStatus)} aria-label={`${copy.quotes.status}: ${quote.client}`}>{(["pending", "followed-up", "signed", "lost"] as const).map((value) => <option value={value} key={value}>{getQuoteStatusLabel(value, copy)}</option>)}</select></td>
                <td className="date-cell">{new Intl.DateTimeFormat(language === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(quote.createdAt))}</td>
                <td><div className="row-actions">
                  {(quote.status === "pending" || quote.status === "followed-up") && <button className={`row-action follow-action ${quote.status === "followed-up" ? "active" : ""}`} onClick={() => onStatusChange(quote.id, "followed-up")} aria-label={`${copy.quotes.followAction} ${quote.client}`} title={copy.quotes.followTitle}><Icon name="send" size={15} /></button>}
                  {(quote.status === "pending" || quote.status === "followed-up") && (
                    <button className="row-action ai-action" onClick={() => onAiFollowUp(quote)} aria-label={`${copy.quotes.aiFollowUp} ${quote.client}`} title={copy.quotes.aiFollowUp}>
                      <Icon name="spark" size={15} />
                      <span>{copy.quotes.aiFollowUp}</span>
                    </button>
                  )}
                  {quote.status === "signed" && <>
                    <button className={`row-action convert-action ${!canCreateInvoice ? "locked" : ""}`} disabled={invoiceQuoteIds.has(quote.id)} onClick={() => onCreateInvoice(quote)} aria-label={`${copy.quotes.createInvoice}: ${quote.client}${canCreateInvoice ? "" : ` — ${copy.access.locked}`}`} title={invoiceQuoteIds.has(quote.id) ? copy.quotes.converted : canCreateInvoice ? copy.quotes.createInvoice : `${copy.quotes.createInvoice} — ${copy.access.locked}`}>
                      <Icon name={invoiceQuoteIds.has(quote.id) ? "check" : canCreateInvoice ? "document" : "lock"} size={15} />
                    </button>
                    <button className={`row-action convert-action ${!canCreateProject ? "locked" : ""}`} disabled={projectQuoteIds.has(quote.id)} onClick={() => onCreateProject(quote)} aria-label={`${copy.quotes.createProject}: ${quote.client}${canCreateProject ? "" : ` — ${copy.access.locked}`}`} title={projectQuoteIds.has(quote.id) ? copy.quotes.converted : canCreateProject ? copy.quotes.createProject : `${copy.quotes.createProject} — ${copy.access.locked}`}>
                      <Icon name={projectQuoteIds.has(quote.id) ? "check" : canCreateProject ? "briefcase" : "lock"} size={15} />
                    </button>
                  </>}
                  <button className="row-action" onClick={() => onEdit(quote)} aria-label={`${copy.quotes.edit} ${quote.client}`} title={copy.common.edit}><Icon name="edit" size={15} /></button>
                  <button className={`row-action delete-action ${confirmDelete === quote.id ? "confirming" : ""}`} onClick={() => { if (confirmDelete === quote.id) { onDelete(quote.id); setConfirmDelete(null); } else setConfirmDelete(quote.id); }} aria-label={confirmDelete === quote.id ? copy.quotes.confirmDelete : `${copy.quotes.delete} ${quote.client}`} title={confirmDelete === quote.id ? copy.quotes.confirm : copy.quotes.deleteTitle}><Icon name="trash" size={15} />{confirmDelete === quote.id && <span>{copy.quotes.confirm}</span>}</button>
                </div></td>
              </tr>
            ))}</tbody></table></div>
          <p className="table-hint"><Icon name="clock" size={14} /> {copy.quotes.tableHint}</p>
        </section>
      )}
    </>
  );
}

function getInvoicePaymentState(invoice: Invoice): "paid" | "pending" | "overdue" {
  if (invoice.paymentStatus === "paid") return "paid";
  return getInvoiceDaysLate(invoice) > 0 ? "overdue" : "pending";
}

function getInvoiceDaysLate(invoice: Invoice) {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const dueDate = new Date(`${invoice.dueDate}T12:00:00`);
  return Number.isNaN(dueDate.getTime())
    ? 0
    : Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / 86400000));
}

function ClientsPage({
  customers,
  quotes,
  invoices,
  projects,
  copy,
  language,
  onCreate,
  onEdit,
  onCreateQuote,
}: {
  customers: Customer[];
  quotes: Quote[];
  invoices: Invoice[];
  projects: Project[];
  copy: Copy;
  language: Language;
  onCreate: () => void;
  onEdit: (item: Customer) => void;
  onCreateQuote: (customerId: string) => void;
}) {
  const [expandedCustomerId, setExpandedCustomerId] = useState<string | null>(null);
  const related = (customer: Customer, name: string, customerId?: string) =>
    customerId === customer.id ||
    name.trim().toLocaleLowerCase() === customer.name.trim().toLocaleLowerCase();

  return (
    <>
      <PageIntro eyebrow={copy.clients.eyebrow} title={copy.pages.clients.title} description={copy.pages.clients.description} buttonLabel={copy.clients.add} onCreate={onCreate} />
      {customers.length === 0 ? (
        <EmptyState icon="users" title={copy.clients.emptyTitle} description={copy.clients.emptyDescription} buttonLabel={copy.clients.emptyAction} onCreate={onCreate} />
      ) : (
        <section className="surface data-surface">
          <div className="table-heading"><div><h2>{copy.clients.tableTitle}</h2><span>{customers.length}</span></div></div>
          <div className="table-scroll"><table>
            <thead><tr><th>{copy.clients.company}</th><th>{copy.clients.contact}</th><th>{copy.clients.email}</th><th>{copy.clients.history}</th><th><span className="sr-only">{copy.common.edit}</span></th></tr></thead>
            <tbody>{customers.map((customer) => {
              const customerQuotes = quotes.filter((quote) => related(customer, quote.client, quote.customerId));
              const customerInvoices = invoices.filter((invoice) => related(customer, invoice.company, invoice.customerId));
              const customerProjects = projects.filter((project) => related(customer, project.client, project.customerId));
              const historyCount = customerQuotes.length + customerInvoices.length + customerProjects.length;
              const expanded = expandedCustomerId === customer.id;
              return <Fragment key={customer.id}>
                <tr>
                  <td><span className="client-cell"><span className="table-avatar customer-avatar">{customer.name.trim().slice(0, 1).toLocaleUpperCase()}</span><strong>{customer.name}</strong></span></td>
                  <td>{getCustomerContactName(customer)}</td>
                  <td className="muted-cell">{getCustomerEmail(customer) || "—"}</td>
                  <td><button className="text-button history-toggle" onClick={() => setExpandedCustomerId(expanded ? null : customer.id)} aria-expanded={expanded}>{copy.clients.historyItems(historyCount)}</button></td>
                  <td><div className="row-actions">
                    <button className="row-action ai-action" onClick={() => onCreateQuote(customer.id)} aria-label={`${copy.clients.createQuote}: ${customer.name}`} title={copy.clients.createQuote}><Icon name="plus" size={15} /><span>{copy.clients.createQuote}</span></button>
                    <button className="row-action" onClick={() => onEdit(customer)} aria-label={`${copy.common.edit}: ${customer.name}`} title={copy.common.edit}><Icon name="edit" size={15} /></button>
                  </div></td>
                </tr>
                {expanded && <tr className="client-history-row"><td colSpan={5}>
                  <div className="client-history">
                    {customerQuotes.map((quote) => <span key={`quote-${quote.id}`}><Icon name="document" size={14} />{copy.navigation.quotes} · {formatCurrency(quote.amount, language)} · {getQuoteStatusLabel(quote.status, copy)}</span>)}
                    {customerInvoices.map((invoice) => <span key={`invoice-${invoice.id}`}><Icon name="wallet" size={14} />{copy.navigation.invoices} · {invoice.number} · {formatCurrency(invoice.amount, language)} · {getInvoiceReminderLabel(invoice.status, copy)}</span>)}
                    {customerProjects.map((project) => <span key={`project-${project.id}`}><Icon name="briefcase" size={14} />{copy.navigation.projects} · {project.name}</span>)}
                    {historyCount === 0 && <span>{copy.clients.historyItems(0)}</span>}
                  </div>
                </td></tr>}
              </Fragment>;
            })}</tbody>
          </table></div>
        </section>
      )}
    </>
  );
}

function InvoicesPage({
  invoices,
  copy,
  language,
  isAiDraftGenerating,
  onCreate,
  onEdit,
  onPaymentStatusChange,
  onDelete,
  onAiFollowUp,
}: {
  invoices: Invoice[];
  copy: Copy;
  language: Language;
  isAiDraftGenerating: boolean;
  onCreate: () => void;
  onEdit: (item: Invoice) => void;
  onPaymentStatusChange: (id: string, status: "pending" | "paid") => void;
  onDelete: (id: string) => void;
  onAiFollowUp: (invoice: Invoice) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const outstanding = invoices.filter((invoice) => getInvoicePaymentState(invoice) !== "paid");
  const outstandingTotal = outstanding.reduce((total, invoice) => total + invoice.amount, 0);
  const overdueCount = outstanding.filter((invoice) => getInvoicePaymentState(invoice) === "overdue").length;
  return (
    <>
      <PageIntro eyebrow={copy.invoices.eyebrow} title={copy.pages.invoices.title} description={copy.pages.invoices.description} buttonLabel={copy.invoices.add} onCreate={onCreate} />
      {invoices.length > 0 && <div className="invoice-kpis invoice-summary-grid">
        <article className="invoice-kpi invoice-kpi-primary"><span>{copy.invoices.totalOutstanding}</span><strong>{formatCurrency(outstandingTotal, language)}</strong><small>{outstanding.length} {copy.invoices.unpaidSummary}</small></article>
        <article className="invoice-kpi"><span>{copy.invoices.overdue}</span><strong>{overdueCount}</strong><small>{language === "fr" ? "factures" : "invoices"}</small></article>
        <article className="invoice-kpi"><span>{copy.invoices.paid}</span><strong>{invoices.length - outstanding.length}</strong><small>{language === "fr" ? "factures" : "invoices"}</small></article>
      </div>}
      {invoices.length === 0 ? (
        <EmptyState icon="document" title={copy.invoices.emptyTitle} description={copy.invoices.emptyDescription} buttonLabel={copy.invoices.emptyAction} onCreate={onCreate} />
      ) : (
        <section className="surface data-surface">
          <div className="table-heading"><div><h2>{copy.invoices.tableTitle}</h2><span>{invoices.length}</span></div></div>
          <div className="table-scroll"><table className="invoice-table">
            <thead><tr><th>{copy.invoices.invoice}</th><th>{copy.invoices.client}</th><th>{copy.invoices.amount}</th><th>{copy.invoices.dueDate}</th><th>{copy.invoices.status}</th><th>{copy.invoices.reminder}</th><th><span className="sr-only">{copy.common.actions}</span></th></tr></thead>
            <tbody>{[...invoices].sort((a, b) => a.dueDate.localeCompare(b.dueDate)).map((invoice) => {
              const status = getInvoicePaymentState(invoice);
              return <tr key={invoice.id}>
                <td><strong className="invoice-number">{invoice.number}</strong></td>
                <td><span className="invoice-client"><strong>{invoice.company}</strong><small>{invoice.contact || "—"}</small></span></td>
                <td className="amount-cell">{formatCurrency(invoice.amount, language)}</td>
                <td className="muted-cell">{new Intl.DateTimeFormat(language === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${invoice.dueDate}T12:00:00`))}</td>
                <td><select className={`status-select payment-select payment-${status}`} value={status === "paid" ? "paid" : "pending"} onChange={(event) => onPaymentStatusChange(invoice.id, event.target.value as "pending" | "paid")} aria-label={`${copy.invoices.status}: ${invoice.number}`}>
                  <option value="pending">{status === "overdue" ? copy.invoices.overdue : copy.invoices.pending}</option>
                  <option value="paid">{copy.invoices.paid}</option>
                </select></td>
                <td>{status !== "paid" && <button type="button" className="reactivate-button" disabled={isAiDraftGenerating} aria-busy={isAiDraftGenerating} onClick={() => onAiFollowUp(invoice)}><Icon name="spark" size={14} />{isAiDraftGenerating ? copy.invoices.generating : copy.invoices.aiFollowUp}</button>}</td>
                <td><div className="row-actions">
                  <button type="button" className="row-action" onClick={() => onEdit(invoice)} aria-label={`${copy.forms.editInvoice}: ${invoice.number}`} title={copy.forms.editInvoice}><Icon name="edit" size={15} /></button>
                  <button type="button" className={`row-action delete-action ${confirmDelete === invoice.id ? "confirming" : ""}`} onClick={() => { if (confirmDelete === invoice.id) { onDelete(invoice.id); setConfirmDelete(null); } else setConfirmDelete(invoice.id); }} aria-label={confirmDelete === invoice.id ? copy.common.confirmDelete : `${copy.common.delete}: ${invoice.number}`} title={confirmDelete === invoice.id ? copy.common.confirm : copy.common.delete}><Icon name="trash" size={15} />{confirmDelete === invoice.id && <span>{copy.common.confirm}</span>}</button>
                </div></td>
              </tr>;
            })}</tbody>
          </table></div>
        </section>
      )}
    </>
  );
}

function ProjectsPage({
  projects,
  copy,
  language,
  onCreate,
  onEdit,
  onStatusChange,
  onDelete,
}: {
  projects: Project[];
  copy: Copy;
  language: Language;
  onCreate: () => void;
  onEdit: (item: Project) => void;
  onStatusChange: (id: string, status: ProjectStatus) => void;
  onDelete: (id: string) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  return (
    <>
      <PageIntro eyebrow={copy.projects.eyebrow} title={copy.pages.projects.title} description={copy.pages.projects.description} buttonLabel={copy.projects.add} onCreate={onCreate} />
      {projects.length === 0 ? (
        <EmptyState icon="briefcase" title={copy.projects.emptyTitle} description={copy.projects.emptyDescription} buttonLabel={copy.projects.emptyAction} onCreate={onCreate} />
      ) : (
        <section className="surface data-surface">
          <div className="table-heading"><div><h2>{copy.projects.tableTitle}</h2><span>{projects.length}</span></div><span className="table-total">{formatCurrency(projects.reduce((sum, project) => sum + project.budget, 0), language)} <small>{copy.projects.budget.toLocaleLowerCase()}</small></span></div>
          <div className="table-scroll"><table>
            <thead><tr><th>{copy.projects.name}</th><th>{copy.projects.client}</th><th>{copy.projects.budget}</th><th>{copy.projects.status}</th><th><span className="sr-only">{copy.common.edit}</span></th></tr></thead>
            <tbody>{projects.map((project) => <tr key={project.id}>
              <td><strong>{project.name}</strong></td><td className="muted-cell">{project.client}</td><td className="amount-cell">{formatCurrency(project.budget, language)}</td>
              <td><select className={`status-select project-status status-${project.status}`} value={project.status} onChange={(event) => onStatusChange(project.id, event.target.value as ProjectStatus)} aria-label={`${copy.projects.status}: ${project.name}`}>
                <option value="planned">{copy.projects.planned}</option><option value="in-progress">{copy.projects.inProgress}</option><option value="completed">{copy.projects.completed}</option>
              </select></td>
              <td><div className="row-actions">
                <button className="row-action" onClick={() => onEdit(project)} aria-label={`${copy.common.edit}: ${project.name}`} title={copy.common.edit}><Icon name="edit" size={15} /></button>
                <button className={`row-action delete-action ${confirmDelete === project.id ? "confirming" : ""}`} onClick={() => { if (confirmDelete === project.id) { onDelete(project.id); setConfirmDelete(null); } else setConfirmDelete(project.id); }} aria-label={confirmDelete === project.id ? copy.common.confirmDelete : `${copy.common.delete}: ${project.name}`} title={confirmDelete === project.id ? copy.common.confirm : copy.common.delete}><Icon name="trash" size={15} />{confirmDelete === project.id && <span>{copy.common.confirm}</span>}</button>
              </div></td>
            </tr>)}</tbody>
          </table></div>
        </section>
      )}
    </>
  );
}

function RecurringExpensesPage({
  expenses,
  copy,
  language,
  onCreate,
  onEdit,
  onDelete,
}: {
  expenses: RecurringExpense[];
  copy: Copy;
  language: Language;
  onCreate: () => void;
  onEdit: (item: RecurringExpense) => void;
  onDelete: (id: string) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const monthlyTotal = expenses.reduce((sum, expense) =>
    sum + (expense.frequency === "yearly" ? expense.amount / 12 : expense.amount), 0);
  return (
    <>
      <PageIntro eyebrow={copy.recurring.eyebrow} title={copy.pages.recurring.title} description={copy.pages.recurring.description} buttonLabel={copy.recurring.add} onCreate={onCreate} />
      {expenses.length === 0 ? (
        <EmptyState icon="repeat" title={copy.recurring.emptyTitle} description={copy.recurring.emptyDescription} buttonLabel={copy.recurring.emptyAction} onCreate={onCreate} />
      ) : (
        <section className="surface data-surface">
          <div className="table-heading"><div><h2>{copy.recurring.tableTitle}</h2><span>{expenses.length}</span></div><span className="table-total">{formatCurrency(monthlyTotal, language)} <small>{copy.recurring.monthlyTotal}</small></span></div>
          <div className="table-scroll"><table>
            <thead><tr><th>{copy.recurring.supplier}</th><th>{copy.recurring.label}</th><th>{copy.recurring.amount}</th><th>{copy.recurring.frequency}</th><th>{copy.recurring.nextDate}</th><th><span className="sr-only">{copy.common.edit}</span></th></tr></thead>
            <tbody>{expenses.map((expense) => <tr key={expense.id}>
              <td><strong>{expense.supplier}</strong></td><td className="muted-cell">{expense.label}</td><td className="amount-cell">{formatCurrency(expense.amount, language)}</td>
              <td><span className="recurring-badge">{expense.frequency === "monthly" ? copy.recurring.monthly : copy.recurring.yearly}</span></td>
              <td className="date-cell">{new Intl.DateTimeFormat(language === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${expense.nextDate}T12:00:00`))}</td>
              <td><div className="row-actions">
                <button className="row-action" onClick={() => onEdit(expense)} aria-label={`${copy.common.edit}: ${expense.supplier}`} title={copy.common.edit}><Icon name="edit" size={15} /></button>
                <button className={`row-action delete-action ${confirmDelete === expense.id ? "confirming" : ""}`} onClick={() => { if (confirmDelete === expense.id) { onDelete(expense.id); setConfirmDelete(null); } else setConfirmDelete(expense.id); }} aria-label={confirmDelete === expense.id ? copy.common.confirmDelete : `${copy.common.delete}: ${expense.supplier}`} title={confirmDelete === expense.id ? copy.common.confirm : copy.common.delete}><Icon name="trash" size={15} />{confirmDelete === expense.id && <span>{copy.common.confirm}</span>}</button>
              </div></td>
            </tr>)}</tbody>
          </table></div>
        </section>
      )}
    </>
  );
}

function ExpensesPage({
  expenses,
  anomalies,
  copy,
  language,
  canDetectAnomalies,
  onRequestUpgrade,
  onCreate,
  onEdit,
  onDelete,
}: {
  expenses: Expense[];
  anomalies: Map<string, string[]>;
  copy: Copy;
  language: Language;
  canDetectAnomalies: boolean;
  onRequestUpgrade: () => void;
  onCreate: () => void;
  onEdit: (item: Expense) => void;
  onDelete: (id: string) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  return (
    <>
      <PageIntro eyebrow={copy.expenses.eyebrow} title={copy.pages.expenses.title} description={copy.pages.expenses.description} buttonLabel={copy.expenses.add} onCreate={onCreate} />
      {!canDetectAnomalies && (
        <section className="surface expense-upgrade-panel">
          <div className="feature-preview">
            <span>{copy.access.featureNames.duplicatePriceDetection}</span>
            <button type="button" className="text-button" onClick={onRequestUpgrade}>
              {copy.access.requiresPlan(copy.access.planNames.business)}
              <Icon name="arrow" size={13} />
            </button>
          </div>
        </section>
      )}
      {expenses.length === 0 ? (
        <EmptyState icon="wallet" title={copy.expenses.emptyTitle} description={copy.expenses.emptyDescription} buttonLabel={copy.expenses.emptyAction} onCreate={onCreate} />
      ) : (
        <section className="surface data-surface">
          <div className="table-heading"><div><h2>{copy.expenses.tableTitle}</h2><span>{expenses.length} {expenses.length === 1 ? copy.expenses.recorded : copy.expenses.recordedPlural}</span></div><span className="table-total">{formatCurrency(expenses.reduce((sum, expense) => sum + expense.amount, 0), language)} <small>{copy.expenses.total}</small></span></div>
          {anomalies.size > 0 && <div className="anomaly-summary"><Icon name="alert" size={17} /><span><strong>{anomalies.size} {anomalies.size === 1 ? copy.expenses.anomalyOne : copy.expenses.anomalyMany}</strong> {copy.expenses.anomalyDescription}</span></div>}
          <div className="table-scroll"><table><thead><tr><th>{copy.expenses.supplier}</th><th>{copy.expenses.label}</th><th>{copy.expenses.amount}</th><th>{copy.expenses.date}</th><th>{copy.expenses.review}</th><th><span className="sr-only">{copy.expenses.edit}</span></th></tr></thead>
            <tbody>{[...expenses].sort((a, b) => b.date.localeCompare(a.date)).map((expense) => {
              const reasons = anomalies.get(expense.id) ?? [];
              return <tr key={expense.id} className={reasons.length ? "expense-flagged" : ""}>
                <td><strong>{expense.supplier}</strong></td><td className="muted-cell">{expense.label}</td><td className="amount-cell">{formatCurrency(expense.amount, language)}</td><td className="date-cell">{new Intl.DateTimeFormat(language === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${expense.date}T12:00:00`))}</td>
                <td>{!canDetectAnomalies ? <span className="locked-label">{copy.access.locked}</span> : reasons.length ? <span className="anomaly-badge" title={reasons.join(" · ")}><Icon name="alert" size={14} />{reasons.length > 1 ? copy.expenses.inspect : reasons[0] === copy.common.duplicateReason ? copy.expenses.duplicate : copy.expenses.increase}</span> : <span className="ok-badge"><Icon name="check" size={14} />{copy.expenses.normal}</span>}</td>
                <td><div className="row-actions"><button className="row-action" onClick={() => onEdit(expense)} aria-label={`${copy.expenses.edit}: ${expense.label}`} title={copy.common.edit}><Icon name="edit" size={15} /></button><button className={`row-action delete-action ${confirmDelete === expense.id ? "confirming" : ""}`} onClick={() => { if (confirmDelete === expense.id) { onDelete(expense.id); setConfirmDelete(null); } else setConfirmDelete(expense.id); }} aria-label={confirmDelete === expense.id ? copy.expenses.confirmDelete : `${copy.expenses.delete}: ${expense.label}`} title={confirmDelete === expense.id ? copy.expenses.confirm : copy.expenses.deleteTitle}><Icon name="trash" size={15} />{confirmDelete === expense.id && <span>{copy.expenses.confirm}</span>}</button></div></td>
              </tr>;
            })}</tbody></table></div>
          {canDetectAnomalies && <p className="table-hint"><Icon name="alert" size={14} /> {copy.expenses.tableHint}</p>}
        </section>
      )}
    </>
  );
}

function CustomersPage({
  customers,
  invoices,
  copy,
  language,
  copiedCustomerId,
  copyError,
  isAiDraftGenerating,
  isCustomerMessageBusy,
  onCreate,
  onAddInvoice,
  onEdit,
  onDelete,
  onPrepareMessage,
  onAiFollowUp,
  onStatusChange,
  onEditInvoice,
}: {
  customers: Customer[];
  invoices: Invoice[];
  copy: Copy;
  language: Language;
  copiedCustomerId: string | null;
  copyError: string | null;
  isAiDraftGenerating: boolean;
  isCustomerMessageBusy: boolean;
  onCreate: () => void;
  onAddInvoice: () => void;
  onEdit: (item: Customer) => void;
  onDelete: (id: string) => void;
  onPrepareMessage: (item: Customer) => void;
  onAiFollowUp: (invoice: Invoice) => void;
  onStatusChange: (id: string, status: InvoiceStatus) => void;
  onEditInvoice: (item: Invoice) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const invoiceItems = invoices.filter((invoice) => getInvoicePaymentState(invoice) !== "paid");
  const inactiveCount = customers.filter((customer) => customer.inactiveMonths >= 6).length;
  const overdueInvoices = invoiceItems.filter((invoice) => getInvoiceDaysLate(invoice) > 0);
  const overdueTotal = overdueInvoices.reduce((total, invoice) => total + invoice.amount, 0);
  const delayedShort = invoiceItems.filter((invoice) => getInvoiceDaysLate(invoice) > 0 && getInvoiceDaysLate(invoice) <= 15).length;
  const delayedMedium = invoiceItems.filter((invoice) => getInvoiceDaysLate(invoice) > 15 && getInvoiceDaysLate(invoice) <= 30).length;
  const delayedLong = invoiceItems.filter((invoice) => getInvoiceDaysLate(invoice) > 30).length;

  return (
    <>
      <PageIntro eyebrow={copy.customers.eyebrow} title={copy.pages.customers.title} description={copy.pages.customers.description} buttonLabel={copy.customers.add} onCreate={onCreate} />
      {copyError && <div className="copy-alert" role="alert">{copyError}</div>}
      <div className="invoice-kpis">
        <article className="invoice-kpi invoice-kpi-primary">
          <span>{language === "fr" ? "Total en retard" : "Total overdue"}</span>
          <strong>{formatCurrency(overdueTotal, language)}</strong>
          <small>{invoiceItems.length} {language === "fr" ? "factures impayées" : "unpaid invoices"}</small>
        </article>
        <article className="invoice-kpi"><span>{language === "fr" ? "0–15 j" : "0–15 d"}</span><strong>{delayedShort}</strong><small>{language === "fr" ? "factures" : "invoices"}</small></article>
        <article className="invoice-kpi"><span>{language === "fr" ? "15–30 j" : "15–30 d"}</span><strong>{delayedMedium}</strong><small>{language === "fr" ? "factures" : "invoices"}</small></article>
        <article className="invoice-kpi"><span>{language === "fr" ? "> 30 j" : "> 30 d"}</span><strong>{delayedLong}</strong><small>{language === "fr" ? "factures" : "invoices"}</small></article>
        <button type="button" className="button button-primary invoice-add" onClick={onAddInvoice}>
          <Icon name="plus" size={16} /> {language === "fr" ? "Ajouter une facture" : "Add invoice"}
        </button>
      </div>
      <section className="surface invoice-section">
        <div className="table-heading">
          <div><h2>{language === "fr" ? "Factures impayées" : "Outstanding invoices"}</h2><span>{invoiceItems.length} {language === "fr" ? "éléments à surveiller" : "items to monitor"}</span></div>
        </div>
        <div className="table-scroll">
          <table className="invoice-table">
            <thead><tr><th>{language === "fr" ? "Facture" : "Invoice"}</th><th>{language === "fr" ? "Client" : "Customer"}</th><th>{language === "fr" ? "Montant" : "Amount"}</th><th>{language === "fr" ? "Échéance" : "Due date"}</th><th>{language === "fr" ? "Retard" : "Delay"}</th><th>{language === "fr" ? "Statut" : "Status"}</th><th><span className="sr-only">{copy.common.actions}</span></th></tr></thead>
            <tbody>{invoiceItems.map((invoice) => (
              <tr key={invoice.id}>
                <td><strong className="invoice-number">{invoice.number}</strong></td>
                <td><span className="invoice-client"><strong>{invoice.company}</strong><small>{invoice.contact}</small></span></td>
                <td className="amount-cell">{formatCurrency(invoice.amount, language)}</td>
                <td className="muted-cell">{new Intl.DateTimeFormat(language === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(invoice.dueDate))}</td>
                <td><span className={`delay-badge ${getInvoiceDaysLate(invoice) >= 30 ? "delay-critical" : getInvoiceDaysLate(invoice) >= 15 ? "delay-medium" : ""}`}>{getInvoiceDaysLate(invoice)}{language === "fr" ? "j" : "d"}</span></td>
                <td>
                  <select
                    className={`status-select invoice-reminder-select status-${invoice.status}`}
                    value={invoice.status}
                    onChange={(event) => onStatusChange(invoice.id, event.target.value as InvoiceStatus)}
                    aria-label={`${copy.invoices.reminder}: ${invoice.number}`}
                  >
                    <option value="never">{copy.invoices.reminderNever}</option>
                    <option value="relanced">{copy.invoices.reminderSent}</option>
                    <option value="relanced-with-response">{copy.invoices.reminderReplied}</option>
                    {invoice.status === "ai-ready" && <option value="ai-ready">{copy.invoices.reminderReady}</option>}
                  </select>
                </td>
                <td><div className="row-actions">
                  <button type="button" className="row-action" onClick={() => onEditInvoice(invoice)} aria-label={`${copy.forms.editInvoice}: ${invoice.number}`} title={copy.forms.editInvoice}><Icon name="edit" size={15} /></button>
                  <button type="button" className="reactivate-button" disabled={isAiDraftGenerating} aria-busy={isAiDraftGenerating} onClick={() => onAiFollowUp(invoice)}><Icon name="spark" size={14} />{isAiDraftGenerating ? copy.invoices.generating : copy.invoices.aiFollowUp}</button>
                </div></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>
      {customers.length === 0 ? (
        <EmptyState icon="users" title={copy.customers.emptyTitle} description={copy.customers.emptyDescription} buttonLabel={copy.customers.emptyAction} onCreate={onCreate} />
      ) : (
        <section className="surface data-surface">
          <div className="table-heading"><div><h2>{copy.customers.tableTitle}</h2><span>{customers.length} · {inactiveCount} {copy.customers.inactive}</span></div><span className="table-total">{formatCurrency(customers.filter((c) => c.inactiveMonths >= 6).reduce((sum, customer) => sum + customer.lastAmount, 0), language)} <small>{copy.customers.potential}</small></span></div>
          <div className="table-scroll"><table><thead><tr><th>{copy.customers.client}</th><th>{copy.customers.contact}</th><th>{copy.customers.lastPurchase}</th><th>{copy.customers.inactivity}</th><th>{copy.customers.status}</th><th><span className="sr-only">{copy.customers.edit}</span></th></tr></thead>
            <tbody>{[...customers].sort((a, b) => b.inactiveMonths - a.inactiveMonths).map((customer) => {
              const needsFollowUp = customer.inactiveMonths >= 6;
              return <tr key={customer.id}>
                <td><span className="client-cell"><span className="table-avatar customer-avatar">{customer.name.trim().slice(0, 1).toLocaleUpperCase()}</span><strong>{customer.name}</strong></span></td><td className="muted-cell">{customer.contact}</td><td className="amount-cell">{formatCurrency(customer.lastAmount, language)}</td><td>{customer.inactiveMonths} {copy.customers.months}</td>
                <td>{needsFollowUp ? <span className="reactivation-badge"><span />{copy.customers.reactivate}</span> : <span className="ok-badge"><Icon name="check" size={14} />{copy.customers.active}</span>}</td>
                <td><div className="row-actions">
                  {needsFollowUp && <button type="button" className={`reactivate-button ${copiedCustomerId === customer.id ? "copied" : ""}`} disabled={isCustomerMessageBusy} aria-busy={isCustomerMessageBusy} onClick={() => onPrepareMessage(customer)}><Icon name={copiedCustomerId === customer.id ? "check" : "spark"} size={14} />{isCustomerMessageBusy ? copy.customers.generateWithAiLoading : copiedCustomerId === customer.id ? copy.customers.copied : copy.customers.generateWithAi}</button>}
                  <button className="row-action" onClick={() => onEdit(customer)} aria-label={`${copy.customers.edit} ${customer.name}`} title={copy.customers.edit}><Icon name="edit" size={15} /></button>
                  <button className={`row-action delete-action ${confirmDelete === customer.id ? "confirming" : ""}`} onClick={() => { if (confirmDelete === customer.id) { onDelete(customer.id); setConfirmDelete(null); } else setConfirmDelete(customer.id); }} aria-label={confirmDelete === customer.id ? copy.customers.confirmDelete : `${copy.customers.delete} ${customer.name}`} title={confirmDelete === customer.id ? copy.customers.confirm : copy.customers.delete}><Icon name="trash" size={15} />{confirmDelete === customer.id && <span>{copy.customers.confirm}</span>}</button>
                </div></td>
              </tr>;
            })}</tbody></table></div>
          <div className="reactivation-note"><Icon name="clock" size={16} /><span>{copy.customers.note} <strong>{copy.customers.threshold}</strong>. {copy.customers.noteEnd}</span></div>
        </section>
      )}
    </>
  );
}

function FormActions({ onCancel, copy }: { onCancel: () => void; copy: Copy }) {
  return (
    <div className="form-actions field-wide">
      <button type="button" className="button button-quiet" onClick={onCancel}>{copy.forms.cancel}</button>
      <button type="submit" className="button button-primary"><Icon name="check" size={16} /> {copy.forms.save}</button>
    </div>
  );
}
