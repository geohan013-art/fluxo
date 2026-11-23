import Stripe from "stripe";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isPlanId, type PlanId } from "@/lib/plans";
import {
  isCreatorUser,
  isPlanSimulationEnabled,
} from "@/lib/subscription-server";

const PRICE_IDS: Record<PlanId, string> = {
  standard: "price_1UeIfiD5P1RiKWY3U7S7AlG3",
  pro: "price_1UeIkZD5P1RiKWY3iID2T6sC",
  business: "price_1UeImbD5P1RiKWY3Z0GOJvh0",
  pro_max: "price_1UeIoMD5P1RiKWY39KF6CC8K",
};
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.redirect(new URL("/connexion?next=/settings", new URL(request.url).origin));
  }
  if (isPlanSimulationEnabled()) {
    return NextResponse.json(
      { error: "Le checkout Stripe est désactivé pendant la simulation locale." },
      { status: 403 },
    );
  }
  if (isCreatorUser(user)) {
    return NextResponse.json(
      { error: "Le compte créateur bénéficie déjà de l’accès complet." },
      { status: 403 },
    );
  }
  const url = new URL(request.url);
  const requestedPlan = url.searchParams.get("plan") ?? "standard";
  if (!isPlanId(requestedPlan)) return NextResponse.json({ error: "Formule invalide." }, { status: 400 });
  const plan: PlanId = requestedPlan;
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const priceId = PRICE_IDS[plan];
  if (!stripeKey) return NextResponse.json({ error: "Paiement non configuré : ajoutez STRIPE_SECRET_KEY dans Vercel." }, { status: 503 });
  try {
    const stripe = new Stripe(stripeKey);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: user.id,
      metadata: { supabase_user_id: user.id, plan },
      subscription_data: { metadata: { supabase_user_id: user.id, plan } },
      success_url: `${url.origin}/?payment=success`,
      cancel_url: `${url.origin}/settings?payment=cancelled#plan-options`,
    });
    if (!session.url) return NextResponse.json({ error: "Stripe n’a pas fourni d’URL de paiement." }, { status: 502 });
    return NextResponse.redirect(session.url);
  } catch (error) {
    console.error("Erreur création Checkout Stripe:", error);
    return NextResponse.json({ error: "Impossible de démarrer le paiement Stripe." }, { status: 502 });
  }
}
