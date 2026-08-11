"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { supabaseReady } from "@/lib/supabase/config";
import { Field, SubmitButton } from "@/components/field";
import { FormError, FormOk, NotConnected } from "@/components/notice";

type Mode = "sign-in" | "sign-up" | "forgot" | "reset";

const COPY: Record<Mode, { title: string; blurb: string; action: string }> = {
  "sign-in": {
    title: "Sign in",
    blurb: "Your coins, skins and best run, on any device.",
    action: "Sign in",
  },
  "sign-up": {
    title: "Create an account",
    blurb:
      "Keeps what you have already earned on this device. Nothing is lost by signing up.",
    action: "Create account",
  },
  forgot: {
    title: "Forgot your password",
    blurb: "We will send a link to set a new one.",
    action: "Send the link",
  },
  reset: {
    title: "Set a new password",
    blurb: "Choose something you have not used elsewhere.",
    action: "Save it",
  },
};

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [ok, setOk] = useState<string>();
  const [pending, setPending] = useState(false);
  const copy = COPY[mode];

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(undefined);
    setOk(undefined);

    const supabase = createClient();
    if (!supabase) {
      setError("Accounts are not connected yet — see docs/setup.md.");
      return;
    }

    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    setPending(true);

    try {
      if (mode === "sign-up") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${location.origin}/home` },
        });
        if (error) throw error;
        setOk("Check your inbox to confirm the address. It can take a minute.");
      } else if (mode === "sign-in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push("/home");
        router.refresh();
      } else if (mode === "forgot") {
        await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${location.origin}/reset-password`,
        });
        /*
         * Deliberately the same message whether or not that address has an
         * account. Saying "no account found" tells anyone who asks which of
         * your users exist.
         */
        setOk(
          "If that address has an account, a link is on its way. It expires in an hour.",
        );
      } else {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setOk("Password changed. Taking you to your account…");
        setTimeout(() => router.push("/home"), 1200);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "That did not work.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[420px] px-6 py-16">
      <h1 className="text-3xl font-semibold">{copy.title}</h1>
      <p className="mt-2 text-ink-dim">{copy.blurb}</p>

      {!supabaseReady ? (
        <div className="mt-6">
          <NotConnected />
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
        {mode !== "reset" ? (
          <Field label="Email" id="email" type="email" autoComplete="email" />
        ) : null}

        {mode !== "forgot" ? (
          <Field
            label="Password"
            id="password"
            type="password"
            autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
            hint={mode === "sign-in" ? undefined : "At least eight characters."}
          />
        ) : null}

        <FormError>{error}</FormError>
        <FormOk>{ok}</FormOk>

        <SubmitButton pending={pending}>{copy.action}</SubmitButton>
      </form>

      <div className="mt-6 flex flex-col gap-2 text-sm text-ink-dim">
        {mode === "sign-in" ? (
          <>
            <Link href="/forgot-password" className="hover:text-ink">
              Forgot your password?
            </Link>
            <p>
              No account?{" "}
              <Link href="/sign-up" className="text-accent hover:underline">
                Create one
              </Link>
            </p>
          </>
        ) : null}
        {mode === "sign-up" ? (
          <p>
            Already have one?{" "}
            <Link href="/sign-in" className="text-accent hover:underline">
              Sign in
            </Link>
          </p>
        ) : null}
        {mode === "forgot" ? (
          <Link href="/sign-in" className="hover:text-ink">
            Back to sign in
          </Link>
        ) : null}
      </div>
    </div>
  );
}
