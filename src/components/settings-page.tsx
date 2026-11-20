"use client";

import type { ChangeEvent } from "react";
import type { Copy, Language, Theme } from "@/lib/locale";
import {
  PLAN_IDS,
  planFeatures,
  planNames,
  type PlanId,
} from "@/lib/plans";

const planIcons: Record<PlanId, string> = {
  standard: "◌",
  pro: "⌘",
  business: "▦",
};

const planDescriptions: Record<PlanId, "standardDescription" | "proDescription" | "businessDescription"> = {
  standard: "standardDescription",
  pro: "proDescription",
  business: "businessDescription",
};

export default function SettingsPage({
  copy,
  language,
  theme,
  plan,
  workspaceName,
  onLanguageChange,
  onThemeChange,
  onPlanChange,
  onWorkspaceNameChange,
}: {
  copy: Copy;
  language: Language;
  theme: Theme;
  plan: PlanId;
  workspaceName: string;
  onLanguageChange: (language: Language) => void;
  onThemeChange: (theme: Theme) => void;
  onPlanChange: (plan: PlanId) => void;
  onWorkspaceNameChange: (name: string) => void;
}) {
  const setWorkspaceName = (event: ChangeEvent<HTMLInputElement>) => {
    onWorkspaceNameChange(event.target.value);
  };

  return (
    <>
      <div className="page-intro settings-intro">
        <div>
          <span className="eyebrow">{copy.settings.eyebrow}</span>
          <h1>{copy.pages.settings.title}</h1>
          <p>{copy.pages.settings.description}</p>
        </div>
      </div>

      <div className="settings-layout">
        <div className="settings-main">
          <section className="surface settings-card">
            <div className="settings-card-heading">
              <span className="settings-icon"><ThemeIcon theme={theme} /></span>
              <div>
                <h2>{copy.settings.appearance}</h2>
                <p>{copy.settings.appearanceDescription}</p>
              </div>
            </div>
            <div className="choice-grid theme-choices" role="group" aria-label={copy.settings.selectTheme}>
              {(["light", "dark"] as const).map((value) => (
                <button
                  type="button"
                  key={value}
                  className={`choice-card ${theme === value ? "selected" : ""}`}
                  aria-pressed={theme === value}
                  onClick={() => onThemeChange(value)}
                >
                  <span className={`theme-preview ${value}`}><i /><i /><i /></span>
                  <span className="choice-copy">
                    <strong>{copy.settings[value]}</strong>
                    <small>{copy.settings[value === "light" ? "lightDescription" : "darkDescription"]}</small>
                  </span>
                  <span className="choice-radio" />
                </button>
              ))}
            </div>
          </section>

          <section className="surface settings-card">
            <div className="settings-card-heading">
              <span className="settings-icon language-icon">文</span>
              <div>
                <h2>{copy.settings.language}</h2>
                <p>{copy.settings.languageDescription}</p>
              </div>
            </div>
            <div className="language-options" role="group" aria-label={copy.settings.selectLanguage}>
              {(["fr", "en"] as const).map((value) => (
                <button
                  type="button"
                  key={value}
                  className={`language-option ${language === value ? "selected" : ""}`}
                  aria-pressed={language === value}
                  onClick={() => onLanguageChange(value)}
                >
                  <span className="language-code">{value.toUpperCase()}</span>
                  <span>{copy.settings[value === "fr" ? "french" : "english"]}</span>
                  <span className="choice-radio" />
                </button>
              ))}
            </div>
          </section>

          <section className="surface settings-card">
            <div className="settings-card-heading">
              <span className="settings-icon workspace-icon"><WorkspaceIcon /></span>
              <div>
                <h2>{copy.settings.general}</h2>
                <p>{copy.settings.generalDescription}</p>
              </div>
            </div>
            <label className="workspace-field">
              <span>{copy.settings.workspaceName}</span>
              <input
                type="text"
                maxLength={60}
                value={workspaceName}
                placeholder={copy.settings.workspacePlaceholder}
                onChange={setWorkspaceName}
              />
            </label>
            <p className="settings-footnote">{copy.settings.savedLocally}</p>
          </section>
        </div>

        <aside className="settings-aside">
          <div className="plan-aside-heading">
            <span className="eyebrow">{copy.settings.plansEyebrow}</span>
            <h2>{copy.settings.plansTitle}</h2>
            <p>{copy.settings.plansDescription}</p>
          </div>
          <div className="plan-list">
            {PLAN_IDS.map((planId) => {
              const isCurrent = plan === planId;
              return (
                <article
                  className={`plan-card ${isCurrent ? "selected" : ""}`}
                  key={planId}
                  onClick={() => onPlanChange(planId)}
                >
                  {isCurrent && <span className="plan-current">{copy.settings.currentPlan}</span>}
                  <div className="plan-card-top">
                    <span className="plan-symbol" aria-hidden="true">{planIcons[planId]}</span>
                    <span className="plan-name">{planNames[planId]}</span>
                  </div>
                  <div className="plan-price">
                    <strong>{new Intl.NumberFormat(language === "fr" ? "fr-FR" : "en-IE", {
                      style: "currency",
                      currency: "EUR",
                      minimumFractionDigits: 2,
                    }).format(planFeatures[planId].price)}</strong>
                    <span>{copy.settings.perMonth}</span>
                  </div>
                  <p>{copy.settings[planDescriptions[planId]]}</p>
                  <ul className="plan-features">
                    {planFeatures[planId].displayFeatures.map((feature) => (
                      <li key={feature}>
                        <span className="plan-feature-check" aria-hidden="true">✓</span>
                        <span>{copy.settings[feature]}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="plan-rule" />
                  <span className="plan-billing-label">{copy.settings.monthlyPrice}</span>
                  <button
                    type="button"
                    className="plan-action"
                    aria-pressed={isCurrent}
                    onClick={(event) => {
                      event.stopPropagation();
                      onPlanChange(planId);
                    }}
                  >
                    {isCurrent
                      ? copy.settings.currentPlan
                      : copy.settings.choosePlan}
                  </button>
                </article>
              );
            })}
          </div>
          <p className="plan-selection-note" role="status">{copy.settings.planSelectionNote}</p>
          <p className="plan-disclaimer">{copy.settings.allPlansNote}</p>
        </aside>
      </div>
    </>
  );
}

function ThemeIcon({ theme }: { theme: Theme }) {
  return theme === "dark" ? (
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.2 15.1A8.3 8.3 0 0 1 8.9 3.8 8.5 8.5 0 1 0 20.2 15.1Z" /></svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" /></svg>
  );
}

function WorkspaceIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="5" width="18" height="15" rx="2" />
      <path d="M8 5V3h8v2M3 10h18" />
    </svg>
  );
}
