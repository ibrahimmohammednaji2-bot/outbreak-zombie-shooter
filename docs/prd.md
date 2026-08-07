---
title: 'Zombie Attack — Product Requirements'
status: final
created: '2026-08-07'
updated: '2026-08-07'
stakes: hobby-to-launch
form_factor: web (desktop browser + tablet touch)
---

# Zombie Attack — PRD

A browser-based 3D shooter. Runs from a URL, no install, no plugin, on a
laptop or an iPad. Live at
<https://ibrahimmohammednaji2-bot.github.io/outbreak-zombie-shooter/>.

This is a **brownfield** PRD: most of what follows already ships. Sections are
marked **[SHIPPED]**, **[PARTIAL]** or **[PLANNED]** so the document describes
reality rather than intention.

## 1. Problem and intent

Wave shooters and arena shooters are console and PC genres. Getting into one
means a store, a download, an account and a machine that can run it. The intent
here is a shooter with none of that friction: click a link, play in seconds, on
whatever device is to hand.

The bet being tested is narrow and worth stating plainly: **is shooting these
zombies fun enough that people come back?** Everything else — skins, ranks,
purchases — is downstream of that answer.

## 2. Users

- **The owner (Ibrahim).** Builds it, decides direction, wants it playable by
  friends and family without explaining anything first.
- **A friend or sibling handed a link.** No context, no tutorial. Should be
  shooting within fifteen seconds, on a laptop or an iPad. *[ASSUMPTION: the
  primary audience is people the owner knows personally, not a cold market.]*
- **A returning player.** Wants their coins, skins and classes still there.

## 3. Goals

- Playable from a link, on desktop and tablet, with no install.
- A core loop good enough to replay without extrinsic reward.
- Progression that survives closing the tab.
- Hosting that stays up when the owner's computer is off.

### Non-goals

- Console or native mobile builds.
- Ranked play, matchmaking ratings, anti-cheat.
- Anything requiring an app store.

## 4. What exists today [SHIPPED]

- **Zombies**: endless waves, two enemy types, four difficulties, two maps.
- **Multiplayer (bots)**: free-for-all to 25 kills against five AI opponents.
- **20 weapons** including launchers and two wonder weapons, plus a knife whose
  damage scales so wave N always takes N hits.
- **Points and a mystery box** — 950 points for a random weapon.
- **140 skins** across seven rarities, each changing the outfit and carrying a
  power on a 60-second cooldown.
- **Create-a-class**: five loadouts, ten points, weapons, attachments, perks,
  wildcards, lethal and tactical.
- **Local profiles**, parties by five-digit code, a redeem code with an on/off
  switch.
- **Touch controls** for tablet, chosen by a device prompt.
- **Permanent hosting** on GitHub Pages, redeployed on every push.

## 5. Requirements

Grouped by capability. IDs are stable and globally numbered.

### 5.1 Core combat [SHIPPED]

- **FR-1** The player moves, jumps, crouches and runs in a first-person view.
- **FR-2** Firing is continuous while the trigger is held, on every weapon.
- **FR-3** No input state may persist after its release event is lost.
- **FR-4** Weapons differ in damage, rate, magazine, spread, recoil and reload.
- **FR-5** Headshots deal a per-weapon multiplier.
- **FR-6** Melee damage is derived from the wave so its time-to-kill is fixed.

### 5.2 Zombies mode [SHIPPED]

- **FR-7** Waves grow in count, health and damage.
- **FR-8** Enemies emerge from the ground and cannot act until fully out.
- **FR-9** Enemies path around obstacles, climb, and enter buildings.
- **FR-10** Difficulty scales damage, count, speed and health independently.
- **FR-11** Kills award points; points buy weapons from the mystery box.
- **FR-12** Kills may drop a timed bonus or a full ammo resupply.

### 5.3 Multiplayer [PARTIAL]

- **FR-13** The player builds up to five classes within a ten-point budget.
- **FR-14** A free-for-all against bots runs to a kill limit with respawns.
- **FR-15** Skin powers are disabled in multiplayer.
- **FR-16** Equipment is available only when the class carries it.
- **FR-17 [PLANNED]** Two or more real players share a match in real time.
- **FR-18 [PLANNED]** Hit registration is decided by the server, not a client.

### 5.4 Progression and identity [PARTIAL]

- **FR-19** Coins are earned per wave survived and spent on skins.
- **FR-20** Progress persists between sessions for a signed-in profile.
- **FR-21** A guest's progress is explicitly not saved, and says so.
- **FR-22 [PLANNED]** Accounts are held on a server, not a browser, so
  progress follows the player between devices.
- **FR-23 [PLANNED]** Paid items are granted only by a verified payment.

### 5.5 Access [SHIPPED]

- **FR-24** The game asks once whether the device is a laptop or a tablet.
- **FR-25** Tablet play provides on-screen movement, look, fire and actions.
- **FR-26** The interface states plainly when a feature is not built.

## 6. Non-functional requirements

- **NFR-1** Sustained 60 fps on integrated graphics at 1080p.
- **NFR-2** Initial download under 1 MB compressed.
- **NFR-3** Playable within 15 seconds of opening the link.
- **NFR-4** No uncaught error may fail silently; failures surface on screen.
- **NFR-5** The client is never trusted to assert ownership of a paid item.
- **NFR-6** Passwords stored only as salted hashes, compared in constant time.
- **NFR-7** Hosting survives the owner's machine being off.

## 7. Success metrics

- **Replays per session** — more than one match without prompting.
- **Return rate** — a player who came back the next day.
- **Wave reached** as a proxy for whether difficulty is tuned.

### Counter-metrics

- **Rage quits inside 60 seconds** — a signal that difficulty or controls are
  wrong, not that the game is hard.
- **Skin screen visits without a match** — progression cannibalising play.
- **Frame time** — every feature added has a rendering cost; watch it.

## 8. Open questions

- Is the core loop actually fun, with real players, for more than one session?
  Still unanswered — no external playtest has happened.
- Does anyone want to pay for a skin? Nothing validates this yet.
- Real-player multiplayer needs a hosted server. Who pays for it, and is the
  audience large enough to need it?
- Owner is likely under 18 *[ASSUMPTION]*, which blocks payment processing in
  their own name and gates all of §5.4's paid work.
