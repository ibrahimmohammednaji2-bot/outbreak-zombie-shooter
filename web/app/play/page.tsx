import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Play",
  description: "Zombie Attack, running in your browser.",
};

/*
 * The game itself, served from /public/game and framed here.
 *
 * It is not ported into React. It is six thousand lines of vanilla JavaScript
 * and Three.js that works, and the framework requirement is about the
 * application around it — accounts, pages, data. See docs/architecture.md.
 *
 * Same-origin, so the page and the game can talk with postMessage once there
 * are accounts to save progress to.
 */
export default function Page() {
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-4">
      <iframe
        src="/game/index.html"
        title="Zombie Attack"
        // pointer lock is how the mouse aims; without it the game cannot be played
        allow="pointer-lock; fullscreen; autoplay"
        className="block h-[80vh] min-h-[520px] w-full rounded-xl border border-line bg-black"
      />
      <p className="mt-3 text-sm text-ink-dim">
        Click the game to capture the mouse. Press Escape to release it.
        Progress is saved on this device only.
      </p>
    </div>
  );
}
