import Stripe from "stripe";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isPlanId, type PlanId } from "@/lib/plans";

const PRICE_ENV: Record<PlanId, string> = {
  standard: "STRIPE_STANDARD_PRICE_ID",
  pro: "STRIPE_PRO_PRICE_ID",
  business: "STRIPE_BUSINESS_PRICE_ID",
  pro_max: "STRIPE_PRO_MAX_PRICE_ID",
};

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.redirect(new URL("/connexion?next=/settings", new URL(request.url).origin));
  }
  const url = new URL(request.url);
  const requestedPlan = url.searchParams.get("plan") ?? "standard";
  if (!isPlanId(requestedPlan)) return NextResponse.json({ error: "Formule invalide." }, { status: 400 });
  const plan: PlanId = requestedPlan;
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const priceEnv = PRICE_ENV[plan];
  const priceId = process.env[priceEnv];
  if (!stripeKey || !priceId) return NextResponse.json({ error: `Paiement non configuré : vérifiez STRIPE_SECRET_KEY et ${priceEnv} dans Vercel.` }, { status: 503 });
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
