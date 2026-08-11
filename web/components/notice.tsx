/*
 * The panel that says the database is not connected yet. It exists because
 * "sign in" that silently does nothing is the worst of the options — worse
 * than an error, and much worse than saying plainly what is missing.
 */
export function NotConnected() {
  return (
    <div className="rounded-xl border border-warn/40 bg-warn/5 p-4 text-sm">
      <p className="font-semibold text-warn">Accounts are not connected yet</p>
      <p className="mt-1 text-ink-dim">
        This needs a Supabase project. The form below is real and will work the
        moment its keys are set — see <code>docs/setup.md</code>. Until then you
        can still play; progress is kept on this device.
      </p>
    </div>
  );
}

export function FormError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="text-sm text-danger">
      {children}
    </p>
  );
}

export function FormOk({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p role="status" className="text-sm text-accent">
      {children}
    </p>
  );
}
