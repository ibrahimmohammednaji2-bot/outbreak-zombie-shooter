import Link from "next/link";

const TABS = [
  { href: "/account", label: "Profile" },
  { href: "/account/settings", label: "Settings" },
  { href: "/account/security", label: "Security" },
];

export default function AccountLayout({ children }: LayoutProps<"/account">) {
  return (
    <div className="mx-auto max-w-[1100px] px-6 py-12">
      <h1 className="text-3xl font-semibold">Your account</h1>
      <nav aria-label="Account" className="mt-6 border-b border-line">
        <ul className="flex gap-6">
          {TABS.map((t) => (
            <li key={t.href}>
              <Link
                href={t.href}
                className="inline-block border-b-2 border-transparent pb-3 text-ink-dim hover:border-accent hover:text-ink"
              >
                {t.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="max-w-[640px] py-8">{children}</div>
    </div>
  );
}
