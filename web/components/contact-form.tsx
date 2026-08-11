"use client";

import { useState } from "react";
import { Field, SubmitButton } from "@/components/field";
import { FormError, FormOk } from "@/components/notice";

/*
 * The confirmation appears on the page, with a reference. "Sent" that only
 * exists as an email they have not received yet reads as failure — see
 * docs/EXPERIENCE.md.
 */
export function ContactForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [done, setDone] = useState<{ reference: string; message?: string }>();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(undefined);
    setPending(true);

    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.get("email"),
          subject: form.get("subject"),
          body: form.get("body"),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "That did not send.");
      setDone({ reference: data.reference, message: data.message });
    } catch (err) {
      setError(err instanceof Error ? err.message : "That did not send.");
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-xl border border-accent/40 bg-accent/5 p-6">
        <h3 className="font-semibold text-accent">Message received</h3>
        <p className="mt-2 text-sm">
          Your reference is{" "}
          <strong className="font-mono text-base">{done.reference}</strong>. Keep
          it — quoting it finds your message straight away.
        </p>
        {done.message ? (
          <p className="mt-2 text-sm text-ink-dim">{done.message}</p>
        ) : (
          <p className="mt-2 text-sm text-ink-dim">
            We reply to the address you gave, usually within a day or two.
          </p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <Field
        label="Your email"
        id="email"
        type="email"
        autoComplete="email"
        hint="So we can reply. It is used for nothing else."
      />
      <Field label="Subject" id="subject" />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="body" className="text-sm font-medium">
          What has happened?
        </label>
        <textarea
          id="body"
          name="body"
          required
          rows={6}
          className="rounded-md border border-line bg-surface px-3 py-2.5 outline-none focus:border-accent"
        />
        <p className="text-xs text-ink-dim">
          If it is a bug: what you were doing, what happened, and what device
          you were on. That is usually enough to find it.
        </p>
      </div>

      <FormError>{error}</FormError>
      <FormOk />
      <SubmitButton pending={pending}>Send</SubmitButton>
    </form>
  );
}
