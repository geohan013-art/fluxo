export const PLAN_IDS = ["standard", "pro", "business", "pro_max"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export const MODULE_IDS = ["recover", "sales", "control", "projects", "recurring"] as const;
export type ModuleId = (typeof MODULE_IDS)[number];

export const PLAN_FEATURES = [
  "aiEmailReminders",
  "healthScore",
  "duplicatePriceDetection",
  "realTimeActionFeed",
  "multiUser",
  "bankConnection",
  "accountingConnection",
  "dedicatedSupport",
] as const;
export type PlanFeature = (typeof PLAN_FEATURES)[number];

export const QUOTA_IDS = [
  "quotesPerMonth",
  "customers",
  "invoicesPerMonth",
  "projects",
  "users",
] as const;
export type QuotaId = (typeof QUOTA_IDS)[number];
export type PlanQuotas = Record<QuotaId, number | null>;

export type PlanCopyKey =
  | "standardFeatureCockpit"
  | "standardFeatureSales"
  | "standardFeatureRecover"
  | "standardFeatureClients"
  | "proFeatureBase"
  | "proFeatureProjects"
  | "proFeatureRecurring"
  | "businessFeatureIncludesPro"
  | "businessFeatureRecover"
  | "businessFeatureControl"
  | "proMaxFeatureIncludesBusiness"
  | "proMaxFeatureCockpit"
  | "proMaxFeatureConnections"
  | "proMaxFeatureSupport";

type PlanDefinition = {
  price: number;
  modules: readonly ModuleId[];
  quotas: PlanQuotas;
  features: Record<PlanFeature, boolean>;
  displayFeatures: readonly PlanCopyKey[];
};

const noFeatures: Record<PlanFeature, boolean> = {
  aiEmailReminders: false,
  healthScore: false,
  duplicatePriceDetection: false,
  realTimeActionFeed: false,
  multiUser: false,
  bankConnection: false,
  accountingConnection: false,
  dedicatedSupport: false,
};

export const planFeatures: Record<PlanId, PlanDefinition> = {
  standard: {
    price: 14.99,
    modules: ["sales", "recover"],
    quotas: {
      quotesPerMonth: 50,
      customers: 100,
      invoicesPerMonth: 50,
      projects: 0,
      users: 1,
    },
    features: noFeatures,
    displayFeatures: [
      "standardFeatureCockpit",
      "standardFeatureSales",
      "standardFeatureRecover",
      "standardFeatureClients",
    ],
  },
  pro: {
    price: 24.99,
    modules: ["sales", "projects", "recurring", "recover"],
    quotas: {
      quotesPerMonth: 500,
      customers: 1000,
      invoicesPerMonth: 500,
      projects: 100,
      users: 2,
    },
    features: { ...noFeatures, multiUser: true },
    displayFeatures: [
      "proFeatureBase",
      "proFeatureProjects",
      "proFeatureRecurring",
    ],
  },
  business: {
    price: 34.99,
    modules: ["sales", "projects", "recurring", "recover", "control"],
    quotas: {
      quotesPerMonth: 2500,
      customers: 5000,
      invoicesPerMonth: 2500,
      projects: 1000,
      users: 4,
    },
    features: {
      ...noFeatures,
      aiEmailReminders: true,
      duplicatePriceDetection: true,
      multiUser: true,
    },
    displayFeatures: [
      "businessFeatureIncludesPro",
      "businessFeatureRecover",
      "businessFeatureControl",
    ],
  },
  pro_max: {
    price: 49.99,
    modules: ["sales", "projects", "recurring", "recover", "control"],
    quotas: {
      quotesPerMonth: null,
      customers: null,
      invoicesPerMonth: null,
      projects: null,
      users: 20,
    },
    features: {
      aiEmailReminders: true,
      healthScore: true,
      duplicatePriceDetection: true,
      realTimeActionFeed: true,
      multiUser: true,
      bankConnection: true,
      accountingConnection: true,
      dedicatedSupport: true,
    },
    displayFeatures: [
      "proMaxFeatureIncludesBusiness",
      "proMaxFeatureCockpit",
      "proMaxFeatureConnections",
      "proMaxFeatureSupport",
    ],
  },
};

export function isPlanId(value: unknown): value is PlanId {
  return typeof value === "string" && PLAN_IDS.includes(value as PlanId);
}

export function hasModuleAccess(plan: PlanId, module: ModuleId): boolean {
  return planFeatures[plan].modules.includes(module);
}

export function hasPlanFeature(plan: PlanId, feature: PlanFeature): boolean {
  return planFeatures[plan].features[feature];
}

export function getMinimumPlanForModule(module: ModuleId): PlanId {
  const plan = PLAN_IDS.find((planId) => hasModuleAccess(planId, module));
  if (!plan) throw new Error(`No plan includes the ${module} module.`);
  return plan;
}

export function getMinimumPlanForFeature(feature: PlanFeature): PlanId {
  const plan = PLAN_IDS.find((planId) => hasPlanFeature(planId, feature));
  if (!plan) throw new Error(`No plan includes the ${feature} feature.`);
  return plan;
}

export function getPlanForQuotaUpgrade(plan: PlanId, quota: QuotaId): PlanId {
  const currentLimit = planFeatures[plan].quotas[quota];
  const currentIndex = PLAN_IDS.indexOf(plan);
  const nextPlan = PLAN_IDS.slice(currentIndex + 1).find((planId) => {
    const nextLimit = planFeatures[planId].quotas[quota];
    return nextLimit === null || (currentLimit !== null && nextLimit > currentLimit);
  });
  if (!nextPlan) throw new Error(`No higher plan increases the ${quota} quota.`);
  return nextPlan;
}

export function canCreateWithinQuota(
  plan: PlanId,
  quota: QuotaId,
  currentCount: number,
): boolean {
  const limit = planFeatures[plan].quotas[quota];
  return limit === null || currentCount < limit;
}

export function canCreateInvoice(
  plan: PlanId,
  invoicesThisMonth: number,
): boolean {
  return canCreateWithinQuota(plan, "invoicesPerMonth", invoicesThisMonth);
}
