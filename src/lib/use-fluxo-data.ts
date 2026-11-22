"use client";

import { useEffect, useRef, useState } from "react";
import { demoData, type FluxoData } from "@/lib/fluxo";

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
      (item.email === undefined || typeof item.email === "string") &&
      (item.customerId === undefined || typeof item.customerId === "string") &&
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
    (data.invoices === undefined || (Array.isArray(data.invoices) &&
      data.invoices.every((item) => isRecord(item) &&
        typeof item.id === "string" &&
        typeof item.number === "string" &&
        typeof item.company === "string" &&
        typeof item.contact === "string" &&
        (item.customerId === undefined || typeof item.customerId === "string") &&
        (item.quoteId === undefined || typeof item.quoteId === "string") &&
        typeof item.amount === "number" &&
        typeof item.dueDate === "string" &&
        typeof item.daysLate === "number" &&
        ["never", "relanced", "ai-ready"].includes(String(item.status)) &&
        (item.paymentStatus === undefined || ["pending", "paid"].includes(String(item.paymentStatus))) &&
        (item.createdAt === undefined || typeof item.createdAt === "string")))) &&
    Array.isArray(data.customers) &&
    data.customers.every((item) => isRecord(item) &&
      typeof item.id === "string" &&
      typeof item.name === "string" &&
      typeof item.contact === "string" &&
      (item.contactName === undefined || typeof item.contactName === "string") &&
      (item.email === undefined || typeof item.email === "string") &&
      typeof item.lastAmount === "number" &&
      Number.isFinite(item.lastAmount) &&
      typeof item.inactiveMonths === "number" &&
      Number.isFinite(item.inactiveMonths)) &&
    (data.projects === undefined || (Array.isArray(data.projects) &&
      data.projects.every((item) => isRecord(item) &&
        typeof item.id === "string" &&
        typeof item.name === "string" &&
        typeof item.client === "string" &&
        (item.customerId === undefined || typeof item.customerId === "string") &&
        (item.quoteId === undefined || typeof item.quoteId === "string") &&
        typeof item.budget === "number" &&
        Number.isFinite(item.budget) &&
        ["planned", "in-progress", "completed"].includes(String(item.status))))) &&
    (data.recurringExpenses === undefined || (Array.isArray(data.recurringExpenses) &&
      data.recurringExpenses.every((item) => isRecord(item) &&
        typeof item.id === "string" &&
        typeof item.supplier === "string" &&
        typeof item.label === "string" &&
        typeof item.amount === "number" &&
        Number.isFinite(item.amount) &&
        ["monthly", "yearly"].includes(String(item.frequency)) &&
        typeof item.nextDate === "string")))
  );
}

export function useFluxoData() {
  const [data, setData] = useState<FluxoData>(demoData);
  const [isLoaded, setIsLoaded] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const dataRef = useRef<FluxoData>(demoData);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      let loadedData = demoData;
      let readError: string | null = null;
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed: unknown = JSON.parse(saved);
          if (!isFluxoData(parsed)) {
            throw new Error("Les données enregistrées ne sont pas valides.");
          }
          loadedData = {
            ...parsed,
            invoices: Array.isArray(parsed.invoices) ? parsed.invoices : demoData.invoices,
            projects: Array.isArray(parsed.projects) ? parsed.projects : [],
            recurringExpenses: Array.isArray(parsed.recurringExpenses)
              ? parsed.recurringExpenses
              : [],
          };
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
