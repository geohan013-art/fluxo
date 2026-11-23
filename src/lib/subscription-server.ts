import "server-only";

import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import {
  hasPlanFeature,
  isPlanId,
  type PlanFeature,
  type PlanId,
} from "@/lib/plans";

export type AuthenticatedUserIdentity = {
  id: string;
  email?: string;
  email_confirmed_at?: string | null;
};

export type SubscriptionAccess = {
  active: boolean;
  isCreator: boolean;
  isSimulated: boolean;
  plan: PlanId | null;
  status: string;
};

export class SubscriptionAccessError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/**
 * For local testing, set SIMULATE_PLAN in .env.local and restart `npm run dev`.
 * It overrides every account's subscription, so never configure it in production.
 */
export function getSimulatedPlan(): PlanId | null {
  const configuredPlan = process.env.SIMULATE_PLAN?.trim();
  if (!configuredPlan) return null;

  const normalizedPlan = configuredPlan.toLowerCase().replace(/[\s_-]+/g, "");
  switch (normalizedPlan) {
    case "standard":
      return "standard";
    case "pro":
      return "pro";
    case "business":
      return "business";
    case "promax":
      return "pro_max";
    default:
      throw new SubscriptionAccessError(
        "SIMULATE_PLAN doit être standard, pro, business ou pro_max.",
        500,
      );
  }
}

export function isPlanSimulationEnabled() {
  return Boolean(process.env.SIMULATE_PLAN?.trim());
}

export function isCreatorUser(user: AuthenticatedUserIdentity) {
  const creatorEmail = process.env.CREATOR_EMAIL?.trim().toLowerCase();
  const accountEmail = user.email?.trim().toLowerCase();
  return Boolean(
    creatorEmail &&
      accountEmail &&
      user.email_confirmed_at &&
      accountEmail === creatorEmail,
  );
}

export async function resolveSubscriptionAccess(
  user: AuthenticatedUserIdentity,
): Promise<SubscriptionAccess> {
  const simulatedPlan = getSimulatedPlan();
  if (simulatedPlan) {
    return {
      active: true,
      isCreator: false,
      isSimulated: true,
      plan: simulatedPlan,
      status: "simulated",
    };
  }

  if (isCreatorUser(user)) {
    return {
      active: true,
      isCreator: true,
      isSimulated: false,
      plan: "pro_max",
      status: "creator",
    };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new SubscriptionAccessError(
      "Service d’abonnement non configuré.",
      503,
    );
  }

  const admin = createSupabaseAdmin(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await admin
    .from("subscriptions")
    .select("plan,status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    throw new SubscriptionAccessError(
      "Impossible de lire l’abonnement.",
      500,
    );
  }

  const active = data?.status === "active" || data?.status === "trialing";
  return {
    active,
    isCreator: false,
    isSimulated: false,
    plan: active && isPlanId(data?.plan) ? data.plan : null,
    status: data?.status ?? "inactive",
  };
}

export async function requirePlanFeatureAccess(
  user: AuthenticatedUserIdentity,
  feature: PlanFeature,
  message: string,
) {
  const access = await resolveSubscriptionAccess(user);
  if (
    !access.active ||
    !access.plan ||
    !hasPlanFeature(access.plan, feature)
  ) {
    throw new SubscriptionAccessError(message, 403);
  }
  return access;
}
