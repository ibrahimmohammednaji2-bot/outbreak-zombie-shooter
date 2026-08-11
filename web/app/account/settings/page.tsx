export const metadata = { title: "Settings" };

const ROWS = [
  { id: "locale", label: "Language", options: ["English", "العربية"] },
  { id: "theme", label: "Theme", options: ["Match my system", "Dark", "Light"] },
  { id: "motion", label: "Motion", options: ["Full", "Reduced"] },
];

export default function Page() {
  return (
    <form className="flex flex-col gap-6">
      {ROWS.map((r) => (
        <div key={r.id} className="flex flex-col gap-1.5">
          <label htmlFor={r.id} className="text-sm font-medium">
            {r.label}
          </label>
          <select
            id={r.id}
            name={r.id}
            className="rounded-md border border-line bg-surface px-3 py-2.5 outline-none focus:border-accent"
          >
            {r.options.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </div>
      ))}

      <div className="flex items-start gap-3">
        <input
          id="email-opt-in"
          name="email-opt-in"
          type="checkbox"
          className="mt-1 h-5 w-5"
        />
        <label htmlFor="email-opt-in" className="text-sm">
          Email me when something is added to the game
          <span className="block text-ink-dim">
            Off by default, and off means off. No other mail is ever sent.
          </span>
        </label>
      </div>

      <button
        type="submit"
        className="self-start rounded-md bg-accent px-5 py-2.5 font-semibold text-accent-ink"
      >
        Save settings
      </button>
    </form>
  );
}
