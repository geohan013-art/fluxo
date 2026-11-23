import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  requirePlanFeatureAccess,
  SubscriptionAccessError,
  type AuthenticatedUserIdentity,
} from "@/lib/subscription-server";

export class EmailIntegrationError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

type GmailOAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

type GmailConnection = {
  email: string;
  refresh_token_ciphertext: string;
  refresh_token_nonce: string;
  refresh_token_tag: string;
};

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new EmailIntegrationError("Le service e-mail n’est pas configuré.", 503);
  }
  return value;
}

export function isGmailConfigurationAvailable() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_REDIRECT_URI &&
      process.env.GMAIL_TOKEN_ENCRYPTION_KEY &&
      process.env.GMAIL_OAUTH_STATE_SECRET,
  );
}

export function getGmailOAuthConfig(): GmailOAuthConfig {
  return {
    clientId: requiredEnv("GOOGLE_CLIENT_ID"),
    clientSecret: requiredEnv("GOOGLE_CLIENT_SECRET"),
    redirectUri: requiredEnv("GOOGLE_REDIRECT_URI"),
  };
}

export function getOpenAiApiKey() {
  return requiredEnv("OPENAI_API_KEY");
}

export async function generateOpenAiDraft(systemPrompt: string, context: unknown) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getOpenAiApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(context) },
      ],
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new EmailIntegrationError("OpenAI n’a pas pu générer le brouillon. Réessayez.", 502);
  }
  const result: unknown = await response.json();
  if (!result || typeof result !== "object" || !("choices" in result) || !Array.isArray(result.choices)) {
    throw new EmailIntegrationError("La réponse du service IA est invalide.", 502);
  }
  const choice: unknown = result.choices[0];
  if (!choice || typeof choice !== "object" || !("message" in choice)) {
    throw new EmailIntegrationError("La réponse du service IA est invalide.", 502);
  }
  const message = choice.message;
  if (!message || typeof message !== "object" || !("content" in message) || typeof message.content !== "string") {
    throw new EmailIntegrationError("La réponse du service IA est invalide.", 502);
  }
  let draft: unknown;
  try {
    draft = JSON.parse(message.content);
  } catch {
    throw new EmailIntegrationError("La réponse du service IA est invalide.", 502);
  }
  if (
    !draft ||
    typeof draft !== "object" ||
    !("subject" in draft) ||
    typeof draft.subject !== "string" ||
    !draft.subject.trim() ||
    draft.subject.length > 200 ||
    !("body" in draft) ||
    typeof draft.body !== "string" ||
    !draft.body.trim() ||
    draft.body.length > 8000
  ) {
    throw new EmailIntegrationError("La réponse du service IA est invalide.", 502);
  }
  return { subject: draft.subject.trim(), body: draft.body.trim() };
}

function getEncryptionKey() {
  const key = Buffer.from(requiredEnv("GMAIL_TOKEN_ENCRYPTION_KEY"), "base64");
  if (key.length !== 32) {
    throw new EmailIntegrationError(
      "La clé de chiffrement des jetons Gmail doit contenir 32 octets encodés en base64.",
      503,
    );
  }
  return key;
}

function getStateSecret() {
  const secret = requiredEnv("GMAIL_OAUTH_STATE_SECRET");
  if (secret.length < 32) {
    throw new EmailIntegrationError("Le secret OAuth Gmail doit contenir au moins 32 caractères.", 503);
  }
  return secret;
}

export function getAdminClient() {
  const url = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createSupabaseAdmin(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function requireAuthenticatedUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    throw new EmailIntegrationError("Authentification requise.", 401);
  }
  return user;
}

export async function requireAiEmailAccess(user: AuthenticatedUserIdentity) {
  try {
    return await requirePlanFeatureAccess(
      user,
      "aiEmailReminders",
      "La génération de relances IA nécessite un abonnement Standard actif ou supérieur.",
    );
  } catch (error) {
    if (error instanceof SubscriptionAccessError) {
      throw new EmailIntegrationError(error.message, error.status);
    }
    throw error;
  }
}

export function createOAuthState(userId: string) {
  const payload = Buffer.from(
    JSON.stringify({
      userId,
      nonce: randomBytes(24).toString("base64url"),
      expiresAt: Date.now() + 10 * 60 * 1000,
    }),
  ).toString("base64url");
  const signature = createHmac("sha256", getStateSecret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyOAuthState(state: string) {
  const [payload, signature, extra] = state.split(".");
  if (!payload || !signature || extra) return null;
  const expected = createHmac("sha256", getStateSecret()).update(payload).digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const data: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (
      !data ||
      typeof data !== "object" ||
      !("userId" in data) ||
      typeof data.userId !== "string" ||
      !("expiresAt" in data) ||
      typeof data.expiresAt !== "number" ||
      data.expiresAt < Date.now()
    ) {
      return null;
    }
    return data.userId;
  } catch {
    return null;
  }
}

export function encryptRefreshToken(token: string) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), nonce);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return {
    ciphertext: ciphertext.toString("base64url"),
    nonce: nonce.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
  };
}

function decryptRefreshToken(connection: GmailConnection) {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(connection.refresh_token_nonce, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(connection.refresh_token_tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(connection.refresh_token_ciphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export async function getGmailConnection(userId: string) {
  const { data, error } = await getAdminClient()
    .from("email_connections")
    .select("email,refresh_token_ciphertext,refresh_token_nonce,refresh_token_tag")
    .eq("user_id", userId)
    .eq("provider", "gmail")
    .maybeSingle();
  if (error) {
    throw new EmailIntegrationError("Impossible de lire la connexion Gmail.", 500);
  }
  return data as GmailConnection | null;
}

async function getGmailAccessToken(connection: GmailConnection) {
  const config = getGmailOAuthConfig();
  const refreshToken = decryptRefreshToken(connection);
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new EmailIntegrationError(
      "La connexion Gmail a expiré. Reconnectez votre compte Gmail.",
      401,
    );
  }
  const result: unknown = await response.json();
  if (
    !result ||
    typeof result !== "object" ||
    !("access_token" in result) ||
    typeof result.access_token !== "string"
  ) {
    throw new EmailIntegrationError("Google n’a pas fourni de jeton Gmail valide.", 502);
  }
  return result.access_token;
}

export async function sendGmailMessage(
  userId: string,
  message: { to: string; subject: string; body: string },
) {
  const connection = await getGmailConnection(userId);
  if (!connection) {
    throw new EmailIntegrationError("Connectez d’abord votre compte Gmail dans les paramètres.", 409);
  }
  const accessToken = await getGmailAccessToken(connection);
  const rawMessage = [
    `To: ${message.to}`,
    `Subject: =?UTF-8?B?${Buffer.from(message.subject, "utf8").toString("base64")}?=`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(message.body, "utf8").toString("base64"),
  ].join("\r\n");
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw: Buffer.from(rawMessage, "utf8").toString("base64url") }),
    signal: AbortSignal.timeout(15_000),
  });
  if (response.status === 401) {
    throw new EmailIntegrationError(
      "La connexion Gmail a expiré. Reconnectez votre compte Gmail.",
      401,
    );
  }
  if (!response.ok) {
    throw new EmailIntegrationError("Gmail n’a pas pu envoyer le message.", 502);
  }
  return connection.email;
}

export function emailIntegrationErrorResponse(error: unknown) {
  if (error instanceof EmailIntegrationError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error("Erreur du service e-mail.");
  return NextResponse.json(
    { error: "Le service e-mail est temporairement indisponible." },
    { status: 502 },
  );
}
