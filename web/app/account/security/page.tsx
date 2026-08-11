import Link from "next/link";
import { getUser } from "@/lib/supabase/server";

export const metadata = { title: "Security" };

export default async function Page() {
  const user = await getUser();
  const lastSignIn = user?.last_sign_in_at
    ? new Date(user.last_sign_in_at).toLocaleString()
    : "—";

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="font-semibold">Password</h2>
        <p className="mt-1 text-sm text-ink-dim">
          Changing it signs out every other device.
        </p>
        <Link
          href="/reset-password"
          className="mt-3 inline-block rounded-md border border-line px-4 py-2 text-sm hover:border-accent"
        >
          Change password
        </Link>
      </section>

      <section>
        <h2 className="font-semibold">Last sign-in</h2>
        <p className="mt-1 font-mono text-sm text-ink-dim">{lastSignIn}</p>
        <p className="mt-1 text-sm text-ink-dim">
          If that was not you, change your password now.
        </p>
      </section>

      <section>
        <h2 className="font-semibold">Signed-in devices</h2>
        <p className="mt-1 text-sm text-ink-dim">
          Signing out everywhere ends every session except this one.
        </p>
        <button
          type="button"
          className="mt-3 rounded-md border border-danger px-4 py-2 text-sm text-danger transition-colors hover:bg-danger hover:text-white"
        >
          Sign out everywhere
        </button>
      </section>
    </div>
  );
}
