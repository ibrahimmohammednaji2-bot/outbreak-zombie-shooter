import Link from "next/link";
import { getUser } from "@/lib/supabase/server";
import { supabaseReady } from "@/lib/supabase/config";
import { Field, SubmitButton } from "@/components/field";
import { NotConnected } from "@/components/notice";

export const metadata = { title: "Profile" };

export default async function Page() {
  const user = await getUser();

  if (!user) {
    return (
      <div className="flex flex-col gap-6">
        {!supabaseReady ? <NotConnected /> : null}
        <p className="text-ink-dim">You are not signed in.</p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/sign-in"
            className="rounded-md bg-accent px-5 py-2.5 font-semibold text-accent-ink"
          >
            Sign in
          </Link>
          <Link href="/sign-up" className="rounded-md border border-line px-5 py-2.5">
            Create an account
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form className="flex flex-col gap-5">
      <Field label="Email" id="email" type="email" defaultValue={user.email ?? ""} />
      <Field
        label="Display name"
        id="name"
        required={false}
        hint="What other players would see."
      />
      <SubmitButton>Save</SubmitButton>

      <hr className="border-line" />

      <div>
        <h2 className="font-semibold text-danger">Delete this account</h2>
        <p className="mt-1 text-sm text-ink-dim">
          This removes your profile, your coins and every skin you own,
          including any that were paid for. It cannot be undone and no copy is
          kept.
        </p>
        <button
          type="button"
          className="mt-3 rounded-md border border-danger px-4 py-2 text-sm text-danger transition-colors hover:bg-danger hover:text-white"
        >
          Delete account
        </button>
      </div>
    </form>
  );
}
