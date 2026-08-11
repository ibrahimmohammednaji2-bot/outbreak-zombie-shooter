import { ContactForm } from "@/components/contact-form";

export const metadata = {
  title: "Support",
  description: "Answers to the common questions, and a way to reach a person.",
};

/*
 * Most people who arrive here have one of about eight problems. Answering
 * those on the page is worth more than any contact form, so the FAQs come
 * first and the form is underneath for everything they do not cover.
 */
const FAQS = [
  {
    q: "Do I need an account to play?",
    a: "No. The game runs straight away and every part of it is free to play. An account only exists so your progress survives a cleared cache and follows you to another device.",
  },
  {
    q: "I cleared my browser and lost everything.",
    a: "Without an account, progress is stored in the browser itself, so clearing it removes the save. There is no copy on our side to restore from. This is exactly what an account prevents, and it is why the game says so on the death screen.",
  },
  {
    q: "It will not open on my iPad.",
    a: "Close the tab completely and open it again — Safari caches aggressively and an old copy can be stale. If the screen stays blank you will see a panel explaining what failed, including your browser version. Send us a screenshot of that panel and it will tell us exactly what is wrong.",
  },
  {
    q: "Can I buy skins or tokens?",
    a: "Not yet. Anything priced in AED shows its price and then refuses, deliberately. Taking payments needs a payment provider and a registered business behind it, and until both exist it is better to say so than to put up a button that cannot work.",
  },
  {
    q: "What are tokens for?",
    a: "A token puts you back on your feet where you fell, up to three times in a run. The cap is deliberate: it keeps the difficulty meaning something, which is the thing worth paying for.",
  },
  {
    q: "How do I aim?",
    a: "Hold the right mouse button. Pistols and shotguns magnify 1.5 times, a sniper 6 times, and everything else 3 times. On a tablet there is an AIM button beside RELOAD which latches on and off, since there is nothing to hold down.",
  },
  {
    q: "There is one zombie left and I cannot find it.",
    a: "It used to be possible for one to wedge itself somewhere and stall the wave. Any zombie that has gone nowhere for six seconds while out of your reach is now dug up and put back near you, with its health intact. If you still see a wave stall, tell us which map.",
  },
  {
    q: "The game runs slowly.",
    a: "Keep one tab open. Each tab is a live 3D context and browsers revoke the oldest once there are too many, which shows up as a black screen or a crawl. If it is slow in a single fresh tab, tell us the device and which map.",
  },
];

export default function Page() {
  return (
    <div className="mx-auto max-w-[1100px] px-6 py-12">
      <h1 className="text-3xl font-semibold">Support</h1>
      <p className="mt-2 max-w-[60ch] text-ink-dim">
        Most questions are answered below. If yours is not, the form at the
        bottom reaches a person.
      </p>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Common questions</h2>
        <div className="mt-4 flex flex-col gap-3">
          {FAQS.map((f) => (
            <details
              key={f.q}
              className="rounded-xl border border-line bg-surface p-5 [&_summary]:cursor-pointer"
            >
              <summary className="font-medium">{f.q}</summary>
              <p className="mt-3 max-w-[68ch] text-ink-dim">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mt-14 max-w-[560px]">
        <h2 className="text-xl font-semibold">Get in touch</h2>
        <p className="mt-2 text-ink-dim">
          You will get a reference on this page as soon as it is sent.
        </p>
        <div className="mt-5">
          <ContactForm />
        </div>
      </section>
    </div>
  );
}
