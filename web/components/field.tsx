/*
 * Label above, always visible. A placeholder is not a label — it disappears
 * the moment someone starts typing, which is exactly when they need it.
 */
export function Field({
  label,
  id,
  type = "text",
  autoComplete,
  required = true,
  hint,
  defaultValue,
}: {
  label: string;
  id: string;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  hint?: string;
  defaultValue?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        required={required}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="rounded-md border border-line bg-surface px-3 py-2.5 text-ink outline-none focus:border-accent"
      />
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-ink-dim">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function SubmitButton({
  children,
  pending,
}: {
  children: React.ReactNode;
  pending?: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-accent px-5 py-2.5 font-semibold text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-50"
    >
      {pending ? "Working…" : children}
    </button>
  );
}
