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
  isAuthorized: boolean;
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

async function isUserAuthorized(
  admin: ReturnType<typeof createSupabaseAdmin>,
  userId: string,
  userEmail: string | undefined,
): Promise<boolean> {
  if (!userEmail) return false;

  try {
    const { data, error } = await admin
      .from("authorized_users")
      .select("id")
      .eq("email", userEmail.toLowerCase())
      .maybeSingle();

    if (error) {
      console.error("[subscription] Failed to read authorized_users.", {
        code: error.code,
        message: error.message,
      });
      return false;
    }

    return Boolean(data);
  } catch {
    return false;
  }
}

export function isCreatorUser(user: AuthenticatedUserIdentity) {
  const creatorEmail = process.env.CREATOR_EMAIL?.trim().toLowerCase();
  const accountEmail = user.email?.trim().toLowerCase();
  return Boolean(
    creatorEmail &&
      accountEmail &&
      accountEmail === creatorEmail,
  );
}

export async function resolveSubscriptionAccess(
  user: AuthenticatedUserIdentity,
): Promise<SubscriptionAccess> {
  // 1. Créateur : accès illimité gratuit (priorité absolue, avant toute simulation)
  if (isCreatorUser(user)) {
    return {
      active: true,
      isCreator: true,
      isSimulated: false,
      isAuthorized: true,
      plan: "pro_max",
      status: "creator",
    };
  }

  // 2. Simulation locale (uniquement pour les non-créateurs, en dev)
  const simulatedPlan = getSimulatedPlan();
  if (simulatedPlan) {
    return {
      active: true,
      isCreator: false,
      isSimulated: true,
      isAuthorized: true,
      plan: simulatedPlan,
      status: "simulated",
    };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("[subscription] Supabase admin configuration is incomplete.", {
      supabaseUrlConfigured: Boolean(url),
      serviceRoleKeyConfigured: Boolean(key),
    });
    // Mode dégradé : plan standard gratuit, pas de crash
    return {
      active: false,
      isCreator: false,
      isSimulated: false,
      isAuthorized: false,
      plan: null,
      status: "unconfigured",
    };
  }

  const admin = createSupabaseAdmin(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 3. Vérification whitelist (autorisés manuellement)
  const isAuthorized = await isUserAuthorized(admin, user.id, user.email);
  if (isAuthorized) {
    return {
      active: true,
      isCreator: false,
      isSimulated: false,
      isAuthorized: true,
      plan: "standard",
      status: "authorized",
    };
  }

  // 4. Lecture de l'abonnement Stripe via Supabase (jamais bloquant)
  try {
    const { data, error } = await admin
      .from("subscriptions")
      .select("plan,status")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("[subscription] Failed to read subscription from Supabase.", {
        code: error.code,
        message: error.message,
      });
      // Mode dégradé : pas d'abonnement trouvé, plan gratuit limité
      return {
        active: false,
        isCreator: false,
        isSimulated: false,
        isAuthorized: false,
        plan: null,
        status: "inactive",
      };
    }

    const active = data?.status === "active" || data?.status === "trialing";
    return {
      active,
      isCreator: false,
      isSimulated: false,
      isAuthorized: false,
      plan: active && isPlanId(data?.plan) ? data.plan : null,
      status: data?.status ?? "inactive",
    };
  } catch (error) {
    console.error("[subscription] Unexpected error reading subscription.", error);
    // Mode dégradé : jamais de crash
    return {
      active: false,
      isCreator: false,
      isSimulated: false,
      isAuthorized: false,
      plan: null,
      status: "error",
    };
  }
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

export async function requireUserAccess(
  user: AuthenticatedUserIdentity,
): Promise<SubscriptionAccess> {
  const access = await resolveSubscriptionAccess(user);
  if (!access.active && !access.isAuthorized) {
    throw new SubscriptionAccessError(
      "Abonnement requis pour accéder à cette fonctionnalité.",
      403,
    );
  }
  return access;
}
