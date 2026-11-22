"use client";

import { useEffect, useRef, useState } from "react";
import type { Language, Theme } from "@/lib/locale";
import { isPlanId, type PlanId } from "@/lib/plans";

export type FluxoSettings = {
  language: Language;
  theme: Theme;
  workspaceName: string;
  plan: PlanId;
};

const STORAGE_KEY = "fluxo-settings-v1";
const defaults: FluxoSettings = {
  language: "fr",
  theme: "dark",
  workspaceName: "",
  plan: "standard",
};

type PersistedSettings = Omit<FluxoSettings, "plan"> & { plan?: PlanId };

function isSettings(value: unknown): value is PersistedSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const settings = value as Record<string, unknown>;
  return (
    (settings.language === "fr" || settings.language === "en") &&
    (settings.theme === "dark" || settings.theme === "light") &&
    typeof settings.workspaceName === "string" &&
    (settings.plan === undefined || isPlanId(settings.plan))
  );
}

export function useFluxoSettings() {
  const [settings, setSettings] = useState(defaults);
  const [isLoaded, setIsLoaded] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const settingsRef = useRef(settings);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      let loaded = defaults;
      let errorMessage: string | null = null;
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed: unknown = JSON.parse(saved);
          if (!isSettings(parsed)) {
            throw new Error("Les préférences enregistrées ne sont pas valides.");
          }
          loaded = { ...defaults, ...parsed };
        }
      } catch (error) {
        errorMessage =
          error instanceof Error
            ? error.message
            : "Impossible de lire les préférences enregistrées.";
      }

      if (!cancelled) {
        settingsRef.current = loaded;
        setSettings(loaded);
        setStorageError(errorMessage);
        setIsLoaded(true);
      }
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  function updateSettings(updater: (current: FluxoSettings) => FluxoSettings) {
    const next = updater(settingsRef.current);
    settingsRef.current = next;
    setSettings(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setStorageError(null);
    } catch (error) {
      setStorageError(
        error instanceof Error
          ? error.message
          : "Impossible d’enregistrer les préférences.",
      );
    }
  }

  return { settings, updateSettings, isLoaded, storageError };
}
