import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  resolveSubscriptionAccess,
  SubscriptionAccessError,
} from "@/lib/subscription-server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      return NextResponse.json(
        { error: "Authentification requise.", code: "AUTH_REQUIRED" },
        { status: 401 },
      );
    }

    // resolveSubscriptionAccess ne jette plus d'erreur bloquante : mode dégradé
    const access = await resolveSubscriptionAccess(user);
    return NextResponse.json(access, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    // Filet de sécurité ultime : jamais de 500 brut sur l'abonnement
    console.error("[subscription API] Unexpected error.", error);
    return NextResponse.json(
      {
        active: false,
        isCreator: false,
        isSimulated: false,
        isAuthorized: false,
        plan: null,
        status: "error",
      },
      { status: 200 },
    );
  }
}
