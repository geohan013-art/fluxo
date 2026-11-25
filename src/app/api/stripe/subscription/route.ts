import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  resolveSubscriptionAccess,
  SubscriptionAccessError,
} from "@/lib/subscription-server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  try {
    const access = await resolveSubscriptionAccess(user);
    return NextResponse.json(access, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof SubscriptionAccessError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    throw error;
  }
}
