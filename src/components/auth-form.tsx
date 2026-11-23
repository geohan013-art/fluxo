
"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

type AuthFormProps = {
  mode: "login" | "register";
};

export default function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const isRegister = mode === "register";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setMessage("");
    setError("");

    try {
      if (isRegister) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });

        if (error) throw error;

        if (data.session) {
          router.push("/");
          router.refresh();
        } else {
          setMessage(
            "Compte créé ! Consulte ta boîte mail pour confirmer ton adresse avant de te connecter."
          );
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        router.push("/");
        router.refresh();
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Une erreur est survenue. Réessaie."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <Link href="/" style={styles.brand}>
          <span style={styles.logo}>
            <Image src="/flux-logo.png" width={38} height={38} alt="" priority />
          </span>
          <span>Flux</span>
        </Link>

        <div style={styles.heading}>
          <h1 style={styles.title}>
            {isRegister ? "Créer votre compte" : "Bon retour parmi nous"}
          </h1>
          <p style={styles.subtitle}>
            {isRegister
              ? "Commencez à piloter votre activité avec Flux."
              : "Connectez-vous pour retrouver votre espace de travail."}
          </p>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label} htmlFor="email">
            Adresse email
          </label>

          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="vous@exemple.fr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={styles.input}
          />

          <label style={styles.label} htmlFor="password">
            Mot de passe
          </label>

          <input
            id="password"
            type="password"
            autoComplete={isRegister ? "new-password" : "current-password"}
            placeholder="Minimum 8 caractères"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
            style={styles.input}
          />

          {!isRegister && (
            <div style={styles.forgot}>
              <Link href="/mot-de-passe-oublie" style={styles.link}>
                Mot de passe oublié ?
              </Link>
            </div>
          )}

          {error && <p style={styles.error}>{error}</p>}
          {message && <p style={styles.success}>{message}</p>}

          <button
            type="submit"
            disabled={loading}
            style={{
              ...styles.button,
              opacity: loading ? 0.65 : 1,
            }}
          >
            {loading
              ? "Veuillez patienter..."
              : isRegister
                ? "Créer mon compte"
                : "Se connecter"}
          </button>
        </form>

        <p style={styles.footer}>
          {isRegister ? "Vous avez déjà un compte ?" : "Pas encore de compte ?"}{" "}
          <Link
            href={isRegister ? "/connexion" : "/inscription"}
            style={styles.link}
          >
            {isRegister ? "Se connecter" : "Créer un compte"}
          </Link>
        </p>

        <p style={styles.legal}>
          En utilisant Flux, vous acceptez nos conditions d&apos;utilisation.
        </p>
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "radial-gradient(circle at 50% 10%, #202124 0, #111214 42%, #0b0c0e 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    color: "#f1f1ef",
    fontFamily: "Arial, sans-serif",
  },
  card: {
    width: "100%",
    maxWidth: "440px",
    padding: "40px",
    background: "#17181b",
    border: "1px solid #303136",
    borderRadius: "16px",
    boxShadow: "0 24px 80px rgba(0, 0, 0, 0.35)",
    boxSizing: "border-box",
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    color: "#f3f4fa",
    textDecoration: "none",
    fontSize: "23px",
    fontWeight: 700,
    marginBottom: "38px",
  },
  logo: {
    width: "38px",
    height: "38px",
    borderRadius: "12px",
    background: "#242529",
    color: "#eeeeea",
    display: "grid",
    placeItems: "center",
    border: "1px solid #3b3c41",
    overflow: "hidden",
  },
  heading: {
    marginBottom: "28px",
  },
  title: {
    fontSize: "26px",
    margin: "0 0 10px",
    fontWeight: 700,
  },
  subtitle: {
    color: "#afb4c4",
    fontSize: "14px",
    lineHeight: 1.6,
    margin: 0,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  label: {
    fontSize: "13px",
    color: "#d9dcE8",
    fontWeight: 600,
    marginTop: "8px",
  },
  input: {
    width: "100%",
    padding: "14px",
    borderRadius: "9px",
    border: "1px solid #393a3f",
    background: "#0f1012",
    color: "#ffffff",
    fontSize: "14px",
    boxSizing: "border-box",
    outline: "none",
  },
  forgot: {
    display: "flex",
    justifyContent: "flex-end",
    marginTop: "2px",
  },
  link: {
    color: "#deded9",
    textDecoration: "none",
    fontWeight: 600,
  },
  button: {
    border: "none",
    borderRadius: "10px",
    padding: "15px",
    background: "#deded8",
    color: "#202125",
    fontWeight: 700,
    fontSize: "14px",
    cursor: "pointer",
    marginTop: "12px",
  },
  error: {
    color: "#ff9292",
    fontSize: "13px",
    lineHeight: 1.5,
  },
  success: {
    color: "#b4beff",
    fontSize: "13px",
    lineHeight: 1.5,
  },
  footer: {
    textAlign: "center",
    fontSize: "13px",
    color: "#afb4c4",
    marginTop: "26px",
  },
  legal: {
    textAlign: "center",
    fontSize: "11px",
    color: "#858b9c",
    marginTop: "24px",
    lineHeight: 1.5,
  },
};
