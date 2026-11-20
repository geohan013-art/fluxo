"use client";

import { useEffect, useRef, useState } from "react";
import { emptyData, type FluxoData } from "@/lib/fluxo";

const STORAGE_KEY = "fluxo-data-v1";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFluxoData(value: unknown): value is FluxoData {
  if (!isRecord(value)) return false;
  const data = value;
  return (
    Array.isArray(data.quotes) &&
    data.quotes.every((item) => isRecord(item) &&
      typeof item.id === "string" &&
      typeof item.client === "string" &&
      typeof item.amount === "number" &&
      Number.isFinite(item.amount) &&
      typeof item.probability === "number" &&
      Number.isFinite(item.probability) &&
      ["pending", "followed-up", "signed", "lost"].includes(String(item.status)) &&
      typeof item.createdAt === "string") &&
    Array.isArray(data.expenses) &&
    data.expenses.every((item) => isRecord(item) &&
      typeof item.id === "string" &&
      typeof item.supplier === "string" &&
      typeof item.label === "string" &&
      typeof item.amount === "number" &&
      Number.isFinite(item.amount) &&
      typeof item.date === "string") &&
    Array.isArray(data.customers) &&
    data.customers.every((item) => isRecord(item) &&
      typeof item.id === "string" &&
      typeof item.name === "string" &&
      typeof item.contact === "string" &&
      typeof item.lastAmount === "number" &&
      Number.isFinite(item.lastAmount) &&
      typeof item.inactiveMonths === "number" &&
      Number.isFinite(item.inactiveMonths))
  );
}

export function useFluxoData() {
  const [data, setData] = useState<FluxoData>(emptyData);
  const [isLoaded, setIsLoaded] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const dataRef = useRef<FluxoData>(emptyData);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      let loadedData = emptyData;
      let readError: string | null = null;
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed: unknown = JSON.parse(saved);
          if (!isFluxoData(parsed)) {
            throw new Error("Les données enregistrées ne sont pas valides.");
          }
          loadedData = parsed;
        }
      } catch (error) {
        readError =
          error instanceof Error
            ? error.message
            : "Impossible de lire les données enregistrées.";
      }
      if (!cancelled) {
        dataRef.current = loadedData;
        setData(loadedData);
        setStorageError(readError);
        setIsLoaded(true);
      }
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  function updateData(updater: (current: FluxoData) => FluxoData) {
    const nextData = updater(dataRef.current);
    dataRef.current = nextData;
    setData(nextData);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextData));
      setStorageError(null);
    } catch (error) {
      setStorageError(
        error instanceof Error
          ? error.message
          : "Impossible d'enregistrer les modifications.",
      );
    }
  }

  return { data, updateData, isLoaded, storageError };
}
