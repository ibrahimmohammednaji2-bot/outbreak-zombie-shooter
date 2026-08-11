import Link from "next/link";

const NAV = [
  { href: "/play", label: "Play" },
  { href: "/home", label: "Home" },
  { href: "/support", label: "Support" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 h-16 border-b border-line bg-surface/90 backdrop-blur">
      <div className="mx-auto flex h-full max-w-[1100px] items-center gap-6 px-6">
        <Link href="/" className="font-semibold tracking-[0.08em] uppercase">
          Zombie<span className="text-accent">Attack</span>
        </Link>

        <nav aria-label="Main" className="flex-1">
          <ul className="flex gap-5 text-sm">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="text-ink-dim transition-colors hover:text-ink"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <Link
          href="/account"
          className="rounded-md border border-line px-3 py-1.5 text-sm text-ink-dim transition-colors hover:border-accent hover:text-ink"
        >
          Account
        </Link>
      </div>
    </header>
  );
}
