"use client";

import {
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  getExpenseAnomalies,
  type Customer,
  type Expense,
  type Quote,
  type QuoteStatus,
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
  getMinimumPlanForFeature,
  getMinimumPlanForModule,
  hasModuleAccess,
  hasPlanFeature,
  type ModuleId,
  type PlanFeature,
  type PlanId,
} from "@/lib/plans";
import SettingsPage from "@/components/settings-page";

type Section = "cockpit" | "quotes" | "expenses" | "customers" | "settings";
type UpgradeTarget =
  | { kind: "module"; module: ModuleId }
  | { kind: "feature"; feature: PlanFeature };
type DialogState =
  | { kind: "quote"; item?: Quote }
  | { kind: "expense"; item?: Expense }
  | { kind: "customer"; item?: Customer }
  | { kind: "upgrade"; requiredPlan: PlanId; target: UpgradeTarget }
  | null;
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
  | "lock";

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
};

const sectionModules: Partial<Record<Section, ModuleId>> = {
  quotes: "sales",
  expenses: "control",
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

  const copy = getCopy(settings.language);
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

  function requestUpgrade(target: UpgradeTarget) {
    const requiredPlan = target.kind === "module"
      ? getMinimumPlanForModule(target.module)
      : getMinimumPlanForFeature(target.feature);
    setDialog({ kind: "upgrade", requiredPlan, target });
  }

  function requireModuleAccess(module: ModuleId): boolean {
    if (hasModuleAccess(settings.plan, module)) return true;
    requestUpgrade({ kind: "module", module });
    return false;
  }

  function openQuoteDialog(item?: Quote) {
    if (!requireModuleAccess("sales")) return;
    setDialog({ kind: "quote", item });
  }

  function openExpenseDialog(item?: Expense) {
    if (!requireModuleAccess("control")) return;
    setDialog({ kind: "expense", item });
  }

  function openCustomerDialog(item?: Customer) {
    if (!requireModuleAccess("recover")) return;
    setDialog({ kind: "customer", item });
  }

  function saveQuote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (dialog?.kind !== "quote") return;
    if (!requireModuleAccess("sales")) return;
    const form = new FormData(event.currentTarget);
    const quote: Quote = {
      id: dialog.item?.id ?? makeId(),
      client: String(form.get("client")).trim(),
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
    const form = new FormData(event.currentTarget);
    const customer: Customer = {
      id: dialog.item?.id ?? makeId(),
      name: String(form.get("name")).trim(),
      contact: String(form.get("contact")).trim(),
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

  function updateQuoteStatus(id: string, status: QuoteStatus) {
    if (!requireModuleAccess("sales")) return;
    updateData((current) => ({
      ...current,
      quotes: current.quotes.map((quote) =>
        quote.id === id ? { ...quote, status } : quote,
      ),
    }));
  }

  function deleteItem(kind: "quotes", id: string): void;
  function deleteItem(kind: "expenses", id: string): void;
  function deleteItem(kind: "customers", id: string): void;
  function deleteItem(kind: "quotes" | "expenses" | "customers", id: string) {
    const moduleId = kind === "quotes"
      ? "sales"
      : kind === "expenses"
        ? "control"
        : "recover";
    if (!requireModuleAccess(moduleId)) return;
    updateData((current) => ({
      ...current,
      [kind]: current[kind].filter((item) => item.id !== id),
    }));
  }

  async function copyMessage(customer: Customer) {
    const message = copy.customers.message(customer.name, customer.inactiveMonths);
    try {
      await navigator.clipboard.writeText(message);
      setCopiedCustomerId(customer.id);
      setCopyError(null);
      window.setTimeout(() => setCopiedCustomerId(null), 2200);
    } catch {
      setCopyError(
        copy.customers.copyError,
      );
    }
  }

  function showSection(next: Section) {
    const moduleId = sectionModules[next];
    if (moduleId && !requireModuleAccess(moduleId)) return;
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
    ...inactiveCustomers.map((customer) => ({
      key: `customer-${customer.id}`,
      icon: "users" as const,
      title: `${copy.cockpit.contactCustomer} ${customer.name}`,
      detail: `${customer.inactiveMonths} ${copy.cockpit.monthsInactive} · ${formatCurrency(customer.lastAmount, settings.language)}`,
      action: () => showSection("customers"),
      tone: "sage",
    })),
  ].slice(0, 6);

  const recentQuotes = hasModuleAccess(settings.plan, "sales")
    ? [...data.quotes]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 4)
    : [];

  if (!isLoaded || !settingsLoaded) {
    return <main className="loading-screen" aria-label={copy.shell.loading}><span className="loading-mark">F</span></main>;
  }

  const navItems: { id: Section; label: string; icon: IconName }[] = [
    { id: "cockpit", label: copy.navigation.cockpit, icon: "grid" },
    { id: "quotes", label: copy.navigation.quotes, icon: "document" },
    { id: "expenses", label: copy.navigation.expenses, icon: "wallet" },
    { id: "customers", label: copy.navigation.customers, icon: "users" },
    { id: "settings", label: copy.navigation.settings, icon: "settings" },
  ];
  const newItemLabel =
    section === "expenses"
      ? copy.shell.expense
      : section === "customers"
        ? copy.shell.customer
        : copy.shell.quote;
  const topAddModule: ModuleId = section === "customers"
    ? "recover"
    : section === "expenses"
      ? "control"
      : "sales";
  const canAddCurrentItem = hasModuleAccess(settings.plan, topAddModule);

  return (
    <main className="app-shell" data-theme={settings.theme}>
      <aside className="sidebar">
        <button className="brand" onClick={() => showSection("cockpit")} aria-label={copy.shell.brandLabel}>
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 36 36"><path d="M10 25V15.5a7.5 7.5 0 0 1 14.8-1.7" /><path d="M7.5 19h12" /><circle cx="25.5" cy="23.5" r="2" /></svg>
          </span>
          <span className="brand-name">Fluxo</span>
        </button>

        <div className="workspace-label">{copy.navigation.workspace}</div>
        <nav className="primary-nav" aria-label={copy.navigation.label}>
          {navItems.map((item) => {
            const moduleId = sectionModules[item.id];
            const locked = Boolean(moduleId && !hasModuleAccess(settings.plan, moduleId));
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
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-divider" />
          <div className="privacy-note">
            <span className="privacy-dot" />
            <div>
              <strong>{settings.workspaceName || copy.shell.savedHere}</strong>
              <span>{copy.shell.savedDescription}</span>
            </div>
          </div>
          <div className="sidebar-version">FLUXO · {copy.shell.private}</div>
        </div>
      </aside>

      <section className="main-panel">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Fluxo</span>
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
            {section !== "settings" && <button className="button button-primary top-add" onClick={() => {
              if (!requireModuleAccess(topAddModule)) return;
              if (section === "expenses") openExpenseDialog();
              else if (section === "customers") openCustomerDialog();
              else openQuoteDialog();
            }}>
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

          {section === "cockpit" && (
            <Cockpit
              quotes={data.quotes}
              expenses={data.expenses}
              customers={data.customers}
              anomaliesCount={anomalies.size}
              priorities={priorityItems}
              recentQuotes={recentQuotes}
              copy={copy}
              language={settings.language}
              plan={settings.plan}
              onNavigate={showSection}
              onRequestUpgrade={requestUpgrade}
              onCreateQuote={openQuoteDialog}
            />
          )}

          {section === "quotes" && (
            <QuotesPage
              quotes={data.quotes}
              copy={copy}
              language={settings.language}
              onCreate={() => openQuoteDialog()}
              onEdit={openQuoteDialog}
              onDelete={(id) => deleteItem("quotes", id)}
              onStatusChange={updateQuoteStatus}
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

          {section === "customers" && (
            <CustomersPage
              customers={data.customers}
              copy={copy}
              language={settings.language}
              copiedCustomerId={copiedCustomerId}
              copyError={copyError}
              onCreate={() => openCustomerDialog()}
              onEdit={openCustomerDialog}
              onDelete={(id) => deleteItem("customers", id)}
              onCopy={copyMessage}
            />
          )}
          {section === "settings" && (
            <SettingsPage
              copy={copy}
              language={settings.language}
              theme={settings.theme}
              plan={settings.plan}
              workspaceName={settings.workspaceName}
              onLanguageChange={(language) => updateSettings((current) => ({ ...current, language }))}
              onThemeChange={(theme: Theme) => updateSettings((current) => ({ ...current, theme }))}
              onPlanChange={(plan) => updateSettings((current) => ({ ...current, plan }))}
              onWorkspaceNameChange={(workspaceName) => updateSettings((current) => ({ ...current, workspaceName }))}
            />
          )}
        </div>
      </section>

      {dialog && (
        <div className="dialog-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setDialog(null);
        }}>
          <section className="dialog-card" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
            <div className="dialog-heading">
              <div>
                <span className="eyebrow">
                  {dialog.kind === "upgrade"
                    ? copy.access.locked
                    : dialog.item ? copy.forms.edit : copy.forms.create}
                </span>
                <h2 id="dialog-title">
                  {dialog.kind === "upgrade"
                    ? copy.access.upgradeTitle(copy.access.planNames[dialog.requiredPlan])
                    : dialog.kind === "quote"
                      ? dialog.item ? copy.forms.editQuote : copy.forms.addQuote
                      : dialog.kind === "expense"
                        ? dialog.item ? copy.forms.editExpense : copy.forms.addExpense
                        : dialog.item ? copy.forms.editCustomer : copy.forms.addCustomer}
                </h2>
              </div>
              <button className="icon-button dialog-close" onClick={() => setDialog(null)} aria-label={copy.forms.close}><Icon name="close" /></button>
            </div>

            {dialog.kind === "upgrade" && (
              <div className="upgrade-content">
                <span className="upgrade-lock"><Icon name="lock" size={20} /></span>
                <p>
                  {copy.access.upgradeDescription(
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
                    }}
                  >
                    {copy.access.viewPlans}
                  </button>
                </div>
              </div>
            )}

            {dialog.kind === "quote" && (
              <form className="form-grid" onSubmit={saveQuote}>
                <label className="field field-wide">{copy.forms.customerName}
                  <input name="client" required maxLength={120} placeholder={copy.forms.namePlaceholder} defaultValue={dialog.item?.client ?? ""} autoFocus />
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
                <FormActions onCancel={() => setDialog(null)} />
              </form>
            )}

            {dialog.kind === "expense" && (
              <form className="form-grid" onSubmit={saveExpense}>
                <label className="field">{copy.forms.supplier}
                  <input name="supplier" required maxLength={120} placeholder={copy.forms.supplierPlaceholder} defaultValue={dialog.item?.supplier ?? ""} autoFocus />
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
                <FormActions onCancel={() => setDialog(null)} />
              </form>
            )}

            {dialog.kind === "customer" && (
              <form className="form-grid" onSubmit={saveCustomer}>
                <label className="field field-wide">{copy.forms.customerName}
                  <input name="name" required maxLength={120} placeholder={copy.forms.namePlaceholder} defaultValue={dialog.item?.name ?? ""} autoFocus />
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
                <FormActions onCancel={() => setDialog(null)} />
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
  expenses,
  customers,
  anomaliesCount,
  priorities,
  recentQuotes,
  copy,
  language,
  plan,
  onNavigate,
  onRequestUpgrade,
  onCreateQuote,
}: {
  quotes: Quote[];
  expenses: Expense[];
  customers: Customer[];
  anomaliesCount: number;
  priorities: PriorityItem[];
  recentQuotes: Quote[];
  copy: Copy;
  language: Language;
  plan: PlanId;
  onNavigate: (section: Section) => void;
  onRequestUpgrade: (target: UpgradeTarget) => void;
  onCreateQuote: () => void;
}) {
  const openAmount = quotes
    .filter((quote) => quote.status === "pending" || quote.status === "followed-up")
    .reduce((total, quote) => total + quote.amount, 0);
  const totalExpenses = expenses.reduce((total, expense) => total + expense.amount, 0);
  const potential = customers
    .filter((customer) => customer.inactiveMonths >= 6)
    .reduce((total, customer) => total + customer.lastAmount, 0);

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
    { label: copy.cockpit.openQuotes, value: formatCurrency(openAmount, language), note: `${quotes.filter((q) => q.status === "pending" || q.status === "followed-up").length} ${copy.cockpit.activeQuotes}`, icon: "document", tone: "green", section: "quotes", module: "sales" },
    { label: copy.cockpit.totalExpenses, value: formatCurrency(totalExpenses, language), note: `${expenses.length} ${expenses.length === 1 ? copy.cockpit.expenseRecorded : copy.cockpit.expensesRecorded}`, icon: "wallet", tone: "blue", section: "expenses", module: "control" },
    { label: copy.cockpit.anomalies, value: String(anomaliesCount), note: anomaliesCount ? copy.cockpit.checkExpenses : copy.cockpit.noAnomalies, icon: "alert", tone: anomaliesCount ? "amber" : "neutral", section: "expenses", module: "control", feature: "duplicatePriceDetection" },
    { label: copy.cockpit.reactivation, value: formatCurrency(potential, language), note: `${customers.filter((c) => c.inactiveMonths >= 6).length} ${customers.filter((c) => c.inactiveMonths >= 6).length === 1 ? copy.cockpit.inactiveCustomer : copy.cockpit.inactiveCustomers}`, icon: "trend", tone: "violet", section: "customers", module: "recover" },
  ];
  const canAccessActionFeed = hasPlanFeature(plan, "realTimeActionFeed");
  const visiblePriorities = canAccessActionFeed ? priorities : [];

  return (
    <>
      <div className="page-intro cockpit-intro">
        <div>
          <span className="eyebrow">{copy.cockpit.eyebrow}</span>
          <h1>{copy.pages.cockpit.title}</h1>
          <p>{copy.pages.cockpit.description}</p>
        </div>
        <button className="button button-primary" onClick={onCreateQuote}>
          <Icon name={hasModuleAccess(plan, "sales") ? "plus" : "lock"} size={17} />
          {hasModuleAccess(plan, "sales") ? copy.cockpit.createQuote : copy.access.viewPlans}
        </button>
      </div>

      <div className="metrics-grid">
        {metrics.map((metric) => {
          const moduleAccess = hasModuleAccess(plan, metric.module);
          const featureAccess = !metric.feature || hasPlanFeature(plan, metric.feature);
          const accessible = moduleAccess && featureAccess;
          const upgradeTarget: UpgradeTarget =
            moduleAccess && metric.feature
              ? { kind: "feature", feature: metric.feature }
              : { kind: "module", module: metric.module };
          const requiredPlan = upgradeTarget.kind === "module"
            ? getMinimumPlanForModule(upgradeTarget.module)
            : getMinimumPlanForFeature(upgradeTarget.feature);
          const lockedName = upgradeTarget.kind === "module"
            ? copy.access.moduleNames[upgradeTarget.module]
            : copy.access.featureNames[upgradeTarget.feature];
          return (
            <button
              key={metric.label}
              className={`metric-card ${accessible ? "" : "locked"}`}
              aria-label={accessible
                ? metric.label
                : copy.access.upgradeDescription(
                    lockedName,
                    copy.access.planNames[requiredPlan],
                  )}
              onClick={() => accessible
                ? onNavigate(metric.section)
                : onRequestUpgrade(upgradeTarget)}
            >
              <div className="metric-top">
                <span className={`metric-icon ${metric.tone}`}>
                  <Icon name={accessible ? metric.icon : "lock"} size={19} />
                </span>
                {accessible ? <Icon name="arrow" size={15} /> : <span className="locked-label">{copy.access.locked}</span>}
              </div>
              <span className="metric-label">{metric.label}</span>
              <strong className="metric-value">{accessible ? metric.value : copy.access.locked}</strong>
              <span className="metric-note">
                {accessible
                  ? metric.note
                  : copy.access.requiresPlan(copy.access.planNames[requiredPlan])}
              </span>
            </button>
          );
        })}
      </div>

      <div className="dashboard-columns">
        <section className="surface priority-panel">
          <div className="surface-heading">
            <div>
              <div className="section-title-row"><h2>{copy.cockpit.actions}</h2><span className="subtle-count">{visiblePriorities.length}</span></div>
              <p>{copy.cockpit.actionDescription}</p>
            </div>
            <span className="heading-mark"><Icon name="spark" size={18} /></span>
          </div>
          {!canAccessActionFeed ? (
            <LockedFeature
              title={copy.access.featureNames.realTimeActionFeed}
              description={copy.access.upgradeDescription(
                copy.access.featureNames.realTimeActionFeed,
                copy.access.planNames[getMinimumPlanForFeature("realTimeActionFeed")],
              )}
              actionLabel={copy.access.viewPlans}
              onClick={() => onRequestUpgrade({ kind: "feature", feature: "realTimeActionFeed" })}
            />
          ) : visiblePriorities.length > 0 ? (
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
        </section>

        {hasModuleAccess(plan, "sales") ? (
          <section className="surface recent-panel">
            <div className="surface-heading">
              <div><h2>{copy.cockpit.recentQuotes}</h2><p>{copy.cockpit.recentDescription}</p></div>
              <button className="text-button" onClick={() => onNavigate("quotes")}>{copy.cockpit.seeAll} <Icon name="arrow" size={14} /></button>
            </div>
            {recentQuotes.length > 0 ? (
              <div className="recent-list">
                {recentQuotes.map((quote) => (
                  <div className="recent-row" key={quote.id}>
                    <span className="recent-avatar">{quote.client.trim().slice(0, 1).toLocaleUpperCase()}</span>
                    <div className="recent-copy"><strong>{quote.client}</strong><span>{getQuoteStatusLabel(quote.status, copy)}</span></div>
                    <strong className="recent-amount">{formatCurrency(quote.amount, language)}</strong>
                  </div>
                ))}
                <button className="recent-footer" onClick={() => onNavigate("quotes")}>{copy.cockpit.viewQuotes} <Icon name="arrow" size={15} /></button>
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
        ) : (
          <section className="surface recent-panel">
            <LockedFeature
              title={copy.cockpit.recentQuotes}
              description={copy.access.upgradeDescription(
                copy.access.moduleNames.sales,
                copy.access.planNames[getMinimumPlanForModule("sales")],
              )}
              actionLabel={copy.access.viewPlans}
              onClick={() => onRequestUpgrade({ kind: "module", module: "sales" })}
            />
          </section>
        )}
      </div>

      <section className="bottom-note">
        <span className="bottom-note-mark">f.</span>
        <div><strong>{copy.cockpit.noteTitle}</strong><span>{copy.cockpit.noteDescription}</span></div>
        <button className="text-button" onClick={() => onNavigate("customers")}>{copy.cockpit.addCustomer} <Icon name="arrow" size={14} /></button>
      </section>
    </>
  );
}

function LockedFeature({
  title,
  description,
  actionLabel,
  onClick,
}: {
  title: string;
  description: string;
  actionLabel: string;
  onClick: () => void;
}) {
  return (
    <div className="locked-feature">
      <span className="locked-feature-icon"><Icon name="lock" size={19} /></span>
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
      <button className="button button-quiet" onClick={onClick}>{actionLabel}</button>
    </div>
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
  onCreate,
  onEdit,
  onDelete,
  onStatusChange,
}: {
  quotes: Quote[];
  copy: Copy;
  language: Language;
  onCreate: () => void;
  onEdit: (item: Quote) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: QuoteStatus) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  return (
    <>
      <PageIntro eyebrow={copy.quotes.eyebrow} title={copy.pages.quotes.title} description={copy.pages.quotes.description} buttonLabel={copy.quotes.add} onCreate={onCreate} />
      {quotes.length === 0 ? (
        <EmptyState icon="document" title={copy.quotes.emptyTitle} description={copy.quotes.emptyDescription} buttonLabel={copy.quotes.emptyAction} onCreate={onCreate} />
      ) : (
        <section className="surface data-surface">
          <div className="table-heading"><div><h2>{copy.quotes.tableTitle}</h2><span>{quotes.length} {quotes.length === 1 ? copy.quotes.item : copy.quotes.items}</span></div><span className="table-total">{formatCurrency(quotes.filter((q) => q.status === "pending" || q.status === "followed-up").reduce((sum, quote) => sum + quote.amount, 0), language)} <small>{copy.quotes.inProgress}</small></span></div>
          <div className="table-scroll"><table><thead><tr><th>{copy.quotes.client}</th><th>{copy.quotes.amount}</th><th>{copy.quotes.probability}</th><th>{copy.quotes.status}</th><th>{copy.quotes.added}</th><th><span className="sr-only">{copy.quotes.edit}</span></th></tr></thead>
            <tbody>{quotes.map((quote) => (
              <tr key={quote.id}>
                <td><span className="client-cell"><span className="table-avatar">{quote.client.trim().slice(0, 1).toLocaleUpperCase()}</span><strong>{quote.client}</strong></span></td>
                <td className="amount-cell">{formatCurrency(quote.amount, language)}</td>
                <td><span className="probability"><span><i style={{ width: `${quote.probability}%` }} /></span>{quote.probability}%</span></td>
                <td><select className={`status-select status-${quote.status}`} value={quote.status} onChange={(event) => onStatusChange(quote.id, event.target.value as QuoteStatus)} aria-label={`${copy.quotes.status}: ${quote.client}`}>{(["pending", "followed-up", "signed", "lost"] as const).map((value) => <option value={value} key={value}>{getQuoteStatusLabel(value, copy)}</option>)}</select></td>
                <td className="date-cell">{new Intl.DateTimeFormat(language === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(quote.createdAt))}</td>
                <td><div className="row-actions">
                  {(quote.status === "pending" || quote.status === "followed-up") && <button className="row-action follow-action" onClick={() => onStatusChange(quote.id, "followed-up")} aria-label={`${copy.quotes.followAction} ${quote.client}`} title={copy.quotes.followTitle}><Icon name="send" size={15} /></button>}
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
          <LockedFeature
            title={copy.access.featureNames.duplicatePriceDetection}
            description={copy.access.upgradeDescription(
              copy.access.featureNames.duplicatePriceDetection,
              copy.access.planNames[getMinimumPlanForFeature("duplicatePriceDetection")],
            )}
            actionLabel={copy.access.viewPlans}
            onClick={onRequestUpgrade}
          />
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
  copy,
  language,
  copiedCustomerId,
  copyError,
  onCreate,
  onEdit,
  onDelete,
  onCopy,
}: {
  customers: Customer[];
  copy: Copy;
  language: Language;
  copiedCustomerId: string | null;
  copyError: string | null;
  onCreate: () => void;
  onEdit: (item: Customer) => void;
  onDelete: (id: string) => void;
  onCopy: (item: Customer) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const inactiveCount = customers.filter((customer) => customer.inactiveMonths >= 6).length;
  return (
    <>
      <PageIntro eyebrow={copy.customers.eyebrow} title={copy.pages.customers.title} description={copy.pages.customers.description} buttonLabel={copy.customers.add} onCreate={onCreate} />
      {copyError && <div className="copy-alert" role="alert">{copyError}</div>}
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
                  {needsFollowUp && <button className={`reactivate-button ${copiedCustomerId === customer.id ? "copied" : ""}`} onClick={() => onCopy(customer)}><Icon name={copiedCustomerId === customer.id ? "check" : "send"} size={14} />{copiedCustomerId === customer.id ? copy.customers.copied : copy.customers.prepareMessage}</button>}
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

function FormActions({ onCancel }: { onCancel: () => void }) {
  return (
    <div className="form-actions field-wide">
      <button type="button" className="button button-quiet" onClick={onCancel}>Annuler</button>
      <button type="submit" className="button button-primary"><Icon name="check" size={16} /> Enregistrer</button>
    </div>
  );
}
