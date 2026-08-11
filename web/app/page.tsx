import Link from "next/link";

/*
 * The landing page.
 *
 * The primary action is Play, and it starts the game with no account. A signup
 * wall in front of a free browser game loses more players than it converts —
 * the account has to be worth wanting first, and it is offered after a run
 * ends, when it means something. See docs/EXPERIENCE.md.
 */

const FACTS = [
  { n: "4", of: "maps" },
  { n: "22", of: "weapons" },
  { n: "140", of: "skins" },
  { n: "8", of: "zombie types" },
];

const POINTS = [
  {
    title: "It opens in a tab",
    body: "No download, no launcher, no account. It runs on a school laptop and on a borrowed iPad, which is where most people actually are.",
  },
  {
    title: "It is not a small game",
    body: "Four maps, a Pack-a-Punch that doubles your gun, four perk machines, a bank that carries points between runs, and 140 skins that each change what you can do.",
  },
  {
    title: "It plays on a touchscreen properly",
    body: "The tablet controls were designed for a tablet, not shrunk from the desktop ones. Stick, fire, aim, and everything else where a thumb can reach it.",
  },
];

export default function Page() {
  return (
    <>
      <section className="mx-auto max-w-[1100px] px-6 py-16 sm:py-24">
        <p className="text-sm uppercase tracking-[0.18em] text-accent">
          Free · in your browser
        </p>
        <h1 className="mt-4 max-w-[16ch] text-4xl font-semibold leading-tight sm:text-6xl">
          A 3D zombie shooter that opens in a tab.
        </h1>
        <p className="mt-6 max-w-[60ch] text-lg text-ink-dim">
          Survive endless waves, or fight a free-for-all. Nothing to install,
          nothing to sign up for. It is running before you have decided whether
          to play it.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link
            href="/play"
            className="rounded-md bg-accent px-6 py-3 font-semibold text-accent-ink transition-opacity hover:opacity-90"
          >
            Play now
          </Link>
          <Link
            href="/support"
            className="rounded-md border border-line px-6 py-3 transition-colors hover:border-accent"
          >
            How it works
          </Link>
        </div>

        <dl className="mt-12 flex flex-wrap gap-x-10 gap-y-4">
          {FACTS.map((f) => (
            <div key={f.of}>
              <dt className="sr-only">{f.of}</dt>
              <dd>
                <span className="font-mono text-3xl font-semibold">{f.n}</span>{" "}
                <span className="text-ink-dim">{f.of}</span>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="border-y border-line bg-surface">
        <div className="mx-auto grid max-w-[1100px] gap-8 px-6 py-16 sm:grid-cols-3">
          {POINTS.map((p) => (
            <div key={p.title}>
              <h2 className="text-lg font-semibold">{p.title}</h2>
              <p className="mt-2 text-ink-dim">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1100px] px-6 py-16">
        <h2 className="text-2xl font-semibold">Ready?</h2>
        <p className="mt-2 max-w-[60ch] text-ink-dim">
          You can play right now without an account. Progress is kept on this
          device until you make one.
        </p>
        <Link
          href="/play"
          className="mt-6 inline-block rounded-md bg-accent px-6 py-3 font-semibold text-accent-ink transition-opacity hover:opacity-90"
        >
          Play now
        </Link>
      </section>
    </>
  );
}
