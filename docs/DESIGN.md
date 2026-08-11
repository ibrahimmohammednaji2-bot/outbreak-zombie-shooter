# DESIGN — the look of it

The site wraps a game that is dark, warm-lit and slightly grimy. The site has
to feel like the same object, not a corporate page with a game bolted into it.
So: dark by default, one warm accent, and type that gets out of the way.

## Colour

| Token | Value | Where |
| --- | --- | --- |
| `--bg` | `#0a0d0b` | Page behind everything |
| `--surface` | `#121a15` | Cards, panels, the header |
| `--surface-lift` | `#18231c` | Hover, the raised row |
| `--line` | `rgba(255,255,255,0.10)` | Every border |
| `--ink` | `#e8efe6` | Body text |
| `--ink-dim` | `#93a599` | Secondary text, labels |
| `--accent` | `#5fd77a` | The one green. Actions, focus, links |
| `--warn` | `#ffc94a` | Points, coins, anything that costs |
| `--danger` | `#ff6b6b` | Errors, destructive actions |

One accent, used sparingly. If everything is green nothing is.

**Rarity colours** carry over from the game unchanged, because a player learns
them there and must not have to relearn them here: common `#9aa0a6`, uncommon
`#5fd77a`, rare `#4aa3ff`, epic `#b46bff`, legendary `#ffa63d`, special
`#ff5fd2`, OP `#ff3b3b`.

**Light mode** is supported and is not an afterthought — a parent or a portal
reviewer may open this on a bright screen. Same tokens, inverted surfaces,
same accent.

## Type

- **System stack.** `ui-sans-serif, system-ui, -apple-system, "Segoe UI",
  sans-serif`. No web font: a font file is a render-blocking request on a page
  whose whole promise is that it opens fast.
- **Scale** (1.25): 12 / 14 / 16 / 20 / 25 / 31 / 39 px.
- **Body** 16 px, line height 1.6, measure capped at 68 characters.
- **Headings** 600 weight, tight leading. `letter-spacing: 0.08em` and
  uppercase on small labels only — it is the game's voice, and it is unreadable
  in paragraphs.
- **Numbers** — points, coins, prices — in `ui-monospace` so columns line up
  and a changing figure does not make the row jump.

## Space and shape

- 4 px base. Space is `4, 8, 12, 16, 24, 32, 48, 64`.
- Radius: `6px` on controls, `12px` on cards, `999px` on pills. Nothing sharp;
  nothing pill-shaped that is not a tag.
- One shadow, used only on things that genuinely float: `0 8px 24px
  rgba(0,0,0,0.4)`.
- Page max width `1100px`. Reading columns `680px`.

## Components

**Button.** Three kinds and no more. Primary is accent on dark with dark text.
Secondary is a bordered ghost. Danger is bordered in `--danger` and fills on
hover. Every one has a visible `:focus-visible` ring in the accent at 2 px
offset — this is not decoration, it is how a keyboard user knows where they
are.

**Field.** Label above, always visible; a placeholder is not a label. Error
text below in `--danger`, and the border turns with it. Never colour alone: the
error text says what is wrong in words.

**Card.** `--surface`, 1 px `--line`, 12 px radius, 24 px padding.

**Nav.** Fixed header, 64 px. Logo left, links centre, account right. On mobile
it collapses to a sheet, not a dropdown.

## Motion

Fast and short. `120ms` for hover and focus, `200ms` for anything entering,
`ease-out` on the way in and `ease-in` on the way out. Nothing bounces.

Everything animated is wrapped in `@media (prefers-reduced-motion: reduce)` and
drops to no transition at all. The game itself already respects this on its
screen shake.

## Accessibility, as rules rather than intentions

- Body text meets **4.5:1** against its surface; large text and UI borders meet
  **3:1**. The accent on `--bg` is checked at both sizes.
- Every interactive thing is reachable by keyboard, in a sensible order, with a
  visible focus ring.
- Colour is never the only carrier of meaning. A rarity has a name next to its
  colour; an error has text next to its red.
- Hit targets are at least **44 × 44** — the game is played on tablets and the
  site will be opened on them.
- The game canvas gets a real text alternative and the page never traps focus
  inside it.

## What this deliberately is not

No stock photographs of people at computers. No gradient hero with a floating
phone mockup. The game is the strongest asset on the page, so the landing page
leads with it running, not with a description of it.
