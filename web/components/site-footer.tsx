import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto flex max-w-[1100px] flex-col gap-2 px-6 py-8 text-sm text-ink-dim sm:flex-row sm:items-center sm:justify-between">
        <p>Zombie Attack — a browser game. Nothing to install.</p>
        <nav aria-label="Footer">
          <ul className="flex gap-4">
            <li>
              <Link href="/support" className="hover:text-ink">
                Support
              </Link>
            </li>
            <li>
              <Link href="/play" className="hover:text-ink">
                Play
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
