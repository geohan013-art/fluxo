import Stripe from "stripe";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    const origin = new URL(request.url).origin;
    return NextResponse.redirect(new URL("/connexion?next=/settings", origin));
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env.STRIPE_STANDARD_PRICE_ID;
  if (!stripeKey || !priceId) {
    return NextResponse.json(
      { error: "Le paiement Standard n'est pas encore configuré. Ajoutez STRIPE_SECRET_KEY et STRIPE_STANDARD_PRICE_ID dans Vercel." },
      { status: 503 },
    );
  }

  try {
    const stripe = new Stripe(stripeKey);
    const origin = new URL(request.url).origin;
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: user.id,
      metadata: { supabase_user_id: user.id, plan: "standard" },
      subscription_data: {
        metadata: { supabase_user_id: user.id, plan: "standard" },
      },
      success_url: `${origin}/?payment=success`,
      cancel_url: `${origin}/?payment=cancelled`,
    });

    if (!session.url) {
      return NextResponse.json({ error: "Stripe n'a pas fourni d'URL de paiement." }, { status: 502 });
    }
    return NextResponse.redirect(session.url);
  } catch (error) {
    console.error("Erreur création Checkout Stripe:", error);
    return NextResponse.json({ error: "Impossible de démarrer le paiement Stripe." }, { status: 502 });
  }
}
