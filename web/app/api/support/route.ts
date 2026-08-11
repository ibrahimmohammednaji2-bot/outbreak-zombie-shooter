import { NextResponse } from "next/server";

/*
 * The contact form's other end.
 *
 * Two things this deliberately does. It always returns a reference, even when
 * mail is not configured, because the person on the other end has written out
 * a problem and telling them "something went wrong" wastes it. And it stores
 * nothing beyond what was typed — no address lookups, no enrichment.
 */

const MAX = { subject: 200, body: 4000, email: 320 };

/** Short, unambiguous, and readable down a phone. No I, O, 0 or 1. */
function reference() {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
    if (i === 3) out += "-";
  }
  return out;
}

export async function POST(request: Request) {
  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "That request could not be read." }, { status: 400 });
  }

  const email = String(payload.email ?? "").trim().slice(0, MAX.email);
  const subject = String(payload.subject ?? "").trim().slice(0, MAX.subject);
  const body = String(payload.body ?? "").trim().slice(0, MAX.body);

  if (!email.includes("@") || !subject || !body) {
    return NextResponse.json(
      { error: "An email address, a subject and a message are all needed." },
      { status: 400 },
    );
  }

  const ref = reference();
  const to = process.env.SUPPORT_EMAIL_TO;
  const key = process.env.RESEND_API_KEY;

  if (!to || !key) {
    /*
     * No mail configured yet. Say so honestly rather than pretending it sent —
     * a confirmation for a message that went nowhere is worse than an error.
     */
    console.warn(`[support] ${ref} received but no mail is configured`, { subject });
    return NextResponse.json({
      reference: ref,
      delivered: false,
      message:
        "Your message was received but the mail route is not connected yet, so nobody has been notified.",
    });
  }

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(key);
    await resend.emails.send({
      from: "Zombie Attack <onboarding@resend.dev>",
      to,
      replyTo: email,
      subject: `[${ref}] ${subject}`,
      text: `From: ${email}\nReference: ${ref}\n\n${body}`,
    });
    return NextResponse.json({ reference: ref, delivered: true });
  } catch (err) {
    console.error("[support] send failed", err);
    return NextResponse.json(
      { error: "The message could not be sent. Please try again shortly.", reference: ref },
      { status: 502 },
    );
  }
}
