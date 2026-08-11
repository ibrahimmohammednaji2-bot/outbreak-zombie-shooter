import Link from "next/link";
import { getUser } from "@/lib/supabase/server";
import { supabaseReady } from "@/lib/supabase/config";

export const metadata = { title: "Home" };

/*
 * What someone needs the second they arrive signed in, and nothing else. The
 * first thing on the page is the button that continues the game — if getting
 * from the URL to playing takes more than two clicks, this page is wrong.
 */
export default async function Page() {
  const user = await getUser();
  const name = user?.email ? user.email.split("@")[0] : null;

  return (
    <div className="mx-auto max-w-[1100px] px-6 py-12">
      <h1 className="text-3xl font-semibold">
        {name ? `Welcome back, ${name}` : "Ready to play"}
      </h1>
      <p className="mt-2 text-ink-dim">
        {user
          ? "Your progress is on your account."
          : supabaseReady
            ? "You are playing as a guest. Progress is kept on this device only."
            : "Playing as a guest. Accounts are not connected yet, so progress stays on this device."}
      </p>

      <Link
        href="/play"
        className="mt-8 inline-block rounded-md bg-accent px-8 py-4 text-lg font-semibold text-accent-ink transition-opacity hover:opacity-90"
      >
        Continue
      </Link>

      <div className="mt-12 grid gap-4 sm:grid-cols-3">
        {[
          { label: "Coins", value: "—", note: "Earned by clearing waves" },
          { label: "Best wave", value: "—", note: "Across every map" },
          { label: "Skins owned", value: "—", note: "Out of 140" },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border border-line bg-surface p-6">
            <p className="text-sm text-ink-dim">{c.label}</p>
            <p className="mt-1 font-mono text-3xl font-semibold">{c.value}</p>
            <p className="mt-1 text-xs text-ink-dim">{c.note}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 max-w-[68ch] text-sm text-ink-dim">
        These read from the game once accounts are connected. They show a dash
        rather than a zero on purpose: nobody should be told they have nothing
        when the truth is that we cannot see yet.
      </p>

      {!user ? (
        <div className="mt-10 rounded-xl border border-line bg-surface p-6">
          <h2 className="text-lg font-semibold">Keep what you earn</h2>
          <p className="mt-1 max-w-[60ch] text-ink-dim">
            An account keeps your coins and skins if this device is cleared, and
            lets you carry on somewhere else. Everything already on this device
            comes with you.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/sign-up"
              className="rounded-md bg-accent px-5 py-2.5 font-semibold text-accent-ink"
            >
              Create an account
            </Link>
            <Link href="/sign-in" className="rounded-md border border-line px-5 py-2.5">
              Sign in
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
