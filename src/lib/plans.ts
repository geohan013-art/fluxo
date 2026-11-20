export const PLAN_IDS = ["standard", "pro", "business"] as const;

export type PlanId = (typeof PLAN_IDS)[number];
export type ModuleId = "recover" | "sales" | "control" | "growth";
export type PlanFeature =
  | "aiEmailReminders"
  | "healthScore"
  | "duplicatePriceDetection"
  | "realTimeActionFeed"
  | "multiUser"
  | "bankConnection"
  | "accountingConnection"
  | "dedicatedSupport";
export type PlanCopyKey =
  | "standardFeatureCockpit"
  | "standardFeatureSales"
  | "standardFeatureInvoices"
  | "proFeatureBase"
  | "proFeatureControl"
  | "proFeatureRecover"
  | "proFeatureInvoices"
  | "businessFeatureIncludesPro"
  | "businessFeatureGrowth"
  | "businessFeatureAdvanced"
  | "businessFeatureUsers"
  | "businessFeatureConnections"
  | "businessFeatureSupport";

type PlanDefinition = {
  price: number;
  modules: readonly ModuleId[];
  monthlyInvoiceLimit: number | null;
  maxUsers: number;
  features: Record<PlanFeature, boolean>;
  displayFeatures: readonly PlanCopyKey[];
};

export const planFeatures: Record<PlanId, PlanDefinition> = {
  standard: {
    price: 19.99,
    modules: ["sales"],
    monthlyInvoiceLimit: 50,
    maxUsers: 1,
    features: {
      aiEmailReminders: false,
      healthScore: false,
      duplicatePriceDetection: false,
      realTimeActionFeed: false,
      multiUser: false,
      bankConnection: false,
      accountingConnection: false,
      dedicatedSupport: false,
    },
    displayFeatures: [
      "standardFeatureCockpit",
      "standardFeatureSales",
      "standardFeatureInvoices",
    ],
  },
  pro: {
    price: 29.99,
    modules: ["sales", "control", "recover"],
    monthlyInvoiceLimit: null,
    maxUsers: 1,
    features: {
      aiEmailReminders: true,
      healthScore: true,
      duplicatePriceDetection: false,
      realTimeActionFeed: false,
      multiUser: false,
      bankConnection: false,
      accountingConnection: false,
      dedicatedSupport: false,
    },
    displayFeatures: [
      "proFeatureBase",
      "proFeatureControl",
      "proFeatureRecover",
      "proFeatureInvoices",
    ],
  },
  business: {
    price: 59.99,
    modules: ["recover", "sales", "control", "growth"],
    monthlyInvoiceLimit: null,
    maxUsers: 10,
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
      "businessFeatureIncludesPro",
      "businessFeatureGrowth",
      "businessFeatureAdvanced",
      "businessFeatureUsers",
      "businessFeatureConnections",
      "businessFeatureSupport",
    ],
  },
};

export const planNames: Record<PlanId, string> = {
  standard: "Standard",
  pro: "Pro",
  business: "Business",
};

export function isPlanId(value: unknown): value is PlanId {
  return PLAN_IDS.some((plan) => plan === value);
}

export function hasModuleAccess(plan: PlanId, module: ModuleId): boolean {
  return planFeatures[plan].modules.includes(module);
}

export function hasPlanFeature(plan: PlanId, feature: PlanFeature): boolean {
  return planFeatures[plan].features[feature];
}

export function getMinimumPlanForModule(module: ModuleId): PlanId {
  const minimumPlan = PLAN_IDS.find((plan) =>
    planFeatures[plan].modules.includes(module),
  );
  if (!minimumPlan) {
    throw new Error(`No plan grants access to the ${module} module.`);
  }
  return minimumPlan;
}

export function getMinimumPlanForFeature(feature: PlanFeature): PlanId {
  const minimumPlan = PLAN_IDS.find((plan) => planFeatures[plan].features[feature]);
  if (!minimumPlan) {
    throw new Error(`No plan grants the ${feature} feature.`);
  }
  return minimumPlan;
}

export function canCreateInvoice(
  plan: PlanId,
  invoicesCreatedThisMonth: number,
): boolean {
  const limit = planFeatures[plan].monthlyInvoiceLimit;
  return limit === null || invoicesCreatedThisMonth < limit;
}
