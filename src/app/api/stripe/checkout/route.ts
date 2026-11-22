import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.redirect(new URL("/connexion?next=/settings", process.env.NEXT_PUBLIC_APP_URL ?? "https://flux000.vercel.app"));
  }

  const paymentLink = process.env.STRIPE_STANDARD_PAYMENT_LINK;
  if (!paymentLink) {
    return NextResponse.json({ error: "Lien de paiement non configuré." }, { status: 503 });
  }

  try {
    const checkoutUrl = new URL(paymentLink);
    checkoutUrl.searchParams.set("client_reference_id", user.id);
    return NextResponse.redirect(checkoutUrl);
  } catch {
    return NextResponse.json({ error: "Lien Stripe invalide." }, { status: 500 });
  }
}
