# Product Brief — Zombie Attack

**One line:** a 3D zombie shooter that opens in a browser tab in under three
seconds, with the cosmetic and continue economy of a mobile free-to-play game
and none of the install.

**Status:** the game is built and live. The business around it is not.

---

## The problem

Three separate problems meet in the same place.

**For players.** The free games that are good need a 4 GB download, an account,
and a launcher. The free games that open instantly are 2D and shallow. On a
school Chromebook or a borrowed iPad, the first category is not an option at
all.

**For distribution.** Web game portals — CrazyGames, Poki, itch — have large
audiences and a permanent shortage of games that are genuinely 3D, genuinely
finished, and genuinely load fast. A game that is all three does not have to
buy its first users.

**For us.** The game currently makes nothing. Every part of the money side —
accounts that survive a cleared cache, a payment provider, entitlements the
client cannot forge — is deliberately unbuilt, because building it wrong is
worse than not building it. That is what this phase is.

## The solution

A browser-native 3D shooter with a live-ops economy behind it:

- **The game.** Four maps, twenty-two weapons, eight zombie types, four perk
  machines, a Pack-a-Punch, a bank that carries points between runs, a
  free-for-all mode, and 140 skins across seven rarities. Runs on a laptop or
  an iPad with on-screen controls. No install, no account required to play.
- **The platform.** Accounts, server-held entitlements, payments, and support —
  the part that turns a game into a business, and the part that is reusable if
  the game is ever not the product.

## Who it is for

| | Who | Why they play |
| --- | --- | --- |
| **Primary** | 10–24, on a laptop or tablet, often somewhere that will not let them install anything | Wants something with depth that opens in a tab |
| **Secondary** | Portal audiences arriving from CrazyGames or Poki | Browsing for something new; decides in fifteen seconds |
| **Paying slice** | The few percent who play more than an hour a week | Buys skins for identity, tokens to not lose a good run |

## How it makes money

Three lines, in the order they are worth building.

1. **Cosmetics.** 140 skins. Common to Legendary are bought with coins earned
   in play; **Special (10 AED)** and **OP (20 AED)** are real money. Each skin
   changes what the operator wears and carries a distinct power, so the
   purchase changes how you play and not only how you look.
2. **Continues.** Tokens revive you where you fell, three per run maximum. One
   token is 100 coins *or* 2 AED; packs run to 250 AED for unlimited. The cap
   is deliberate — it protects the difficulty curve, which is what people are
   actually paying to experience.
3. **Portal licensing.** Web portals pay a flat fee or revenue share to host a
   game. This is the line that needs no payment infrastructure at all, which is
   why it is the first one to chase.

**Honest position on the numbers:** we have no conversion data, because nothing
has ever been for sale. Any revenue figure at this stage would be invented.
What can be stated as fact is that the economy, the pricing and the content it
sells are all built and playable today; what is missing is the ability to take
money, which is a known quantity of work, not a research problem.

## Why it can win

- **Load time is the moat.** Nothing else in the category is 3D and opens this
  fast. That is a distribution advantage on every portal.
- **The content already exists.** 140 skins, four maps, twenty-two weapons. The
  usual failure mode of a game business is running out of things to sell before
  the audience arrives. That is not the risk here.
- **The economy is designed, not bolted on.** Rarities, daily rotation, a daily
  free reward, a bank that rewards coming back. These are in and working
  against coins today; pointing them at money is a switch, not a rebuild.
- **One rule already holds:** the client may never assert ownership of a paid
  item. The save endpoint discards entitlements entirely; only a verified
  payment webhook grants them. That is the single most expensive thing to
  retrofit and it is already true.

## What the investment buys

| | |
| --- | --- |
| **Accounts and identity** | Sign up, sign in, password recovery, profiles that survive a cleared cache |
| **Server-held entitlements** | Skins and tokens owned by the account, not the browser |
| **Payments** | A provider, a verified webhook, receipts, refunds |
| **Support** | FAQs and a contact route that reaches a human — required before taking a single payment |
| **Analytics** | Where players stop playing, and what the paying few percent did differently |

## Risks, stated plainly

| Risk | How real | What we do |
| --- | --- | --- |
| Nobody converts | Real and unmeasured | Ship payments to a small audience first and read the number before spending on traffic |
| Portals reject it | Moderate | Their requirements are published and mostly technical; the build already targets them |
| One developer | Real | The documents in this folder exist so the work is legible to somebody else |
| Payment compliance | Real | A registered entity is required before a provider will pay out. This is a founder task, not an engineering one |

## What is true today

- Playable at the live URL, on desktop and tablet.
- Progress saves to the browser. Clear the cache and it is gone.
- Nothing can be bought with money. Real-money items show their price and
  refuse, on purpose.
- No server. Multiplayer against other people and payments both wait on it.
