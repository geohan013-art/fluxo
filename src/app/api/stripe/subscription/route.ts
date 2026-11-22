import { NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isPlanId } from "@/lib/plans";

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!key || !url) return NextResponse.json({ error: "Service d’abonnement non configuré." }, { status: 503 });
  const admin = createSupabaseAdmin(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error: queryError } = await admin.from("subscriptions").select("plan,status").eq("user_id", user.id).maybeSingle();
  if (queryError) return NextResponse.json({ error: "Impossible de lire l’abonnement." }, { status: 500 });
  const active = data?.status === "active" || data?.status === "trialing";
  return NextResponse.json({ active, plan: active && isPlanId(data?.plan) ? data.plan : null, status: data?.status ?? "inactive" }, { headers: { "Cache-Control": "no-store" } });
}
