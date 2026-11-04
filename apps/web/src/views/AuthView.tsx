import { SignInIcon } from "@phosphor-icons/react";
import { type FormEvent, useState } from "react";
import { Navigate } from "react-router-dom";

import { BackLink } from "../components/BackLink.js";
import { Button } from "../components/Button.js";
import { Container } from "../components/Container.js";
import { TextField } from "../components/TextField.js";
import { supabase } from "../lib/supabase.js";
import { useAuth } from "../lib/auth/AuthProvider.js";

export function AuthView() {
  const { user } = useAuth();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    return <Navigate to="/" replace />;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const result =
      mode === "sign-in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    setSubmitting(false);

    if (result.error) {
      setError(result.error.message);
    }
  }

  return (
    <Container className="flex min-h-screen flex-col justify-center gap-10 py-16">
      <div className="space-y-3">
        <p className="text-muted text-sm font-medium">Wiki</p>
        <h1 className="text-4xl tracking-tight">
          {mode === "sign-in" ? "Sign in" : "Create account"}
        </h1>
        <p className="text-muted text-sm leading-relaxed">
          Email and password. Your pages stay private to you.
        </p>
      </div>

      <form className="space-y-6" onSubmit={onSubmit}>
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
        />

        <TextField
          label="Password"
          type="password"
          autoComplete={
            mode === "sign-in" ? "current-password" : "new-password"
          }
          required
          minLength={6}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="At least 6 characters"
        />

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <Button type="submit" variant="primary" disabled={submitting}>
          <SignInIcon size={18} weight="bold" />
          {submitting
            ? "Working"
            : mode === "sign-in"
              ? "Sign in"
              : "Sign up"}
        </Button>
      </form>

      <p className="text-muted text-sm">
        {mode === "sign-in" ? "New here?" : "Already have an account?"}{" "}
        <button
          type="button"
          className="text-foreground font-medium underline-offset-4 hover:underline"
          onClick={() =>
            setMode((current) =>
              current === "sign-in" ? "sign-up" : "sign-in",
            )
          }
        >
          {mode === "sign-in" ? "Create an account" : "Sign in instead"}
        </button>
      </p>

      <BackLink to="/" />
    </Container>
  );
}
