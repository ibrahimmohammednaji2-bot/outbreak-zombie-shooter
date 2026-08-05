# Outbreak

A 3D zombie survival shooter that runs in the browser. Built with
[Three.js](https://threejs.org) and [Vite](https://vite.dev) — no game engine,
no asset downloads, no server.

## Play

```bash
npm install
npm run dev
```

Open <http://localhost:5173> and click to play.

| Input | Action |
| --- | --- |
| `W` `A` `S` `D` | Move |
| Mouse | Look |
| Click | Fire |
| `Shift` | Sprint |
| `Space` | Jump |
| `R` | Reload |
| `1` `2` `3` | Switch weapon |
| `Esc` | Pause |

## The loop

Survive endless waves in a walled arena. Each wave sends more zombies, tougher
and faster than the last; clearing one restores 25 HP and 30 rounds.

Three enemy types keep the pressure varied:

| Type | From | Behaviour |
| --- | --- | --- |
| Walker | Wave 1 | Slow, steady, average health |
| Runner | Wave 4 | Fast and fragile — closes distance before you can reposition |
| Brute | Wave 6 | Large, slow, absorbs a magazine, hits hard |

Headshots deal triple damage. Kills return ammunition, so accuracy is what keeps
you supplied.

## Weapons

Weapons are **earned by kill count** — the progression path, working end to end.

| Weapon | Unlocks at | Character |
| --- | --- | --- |
| Pistol | Start | Semi-auto, accurate, low capacity |
| Rifle | 15 kills | Full-auto, 30 rounds, forgiving |
| Shotgun | 40 kills | 9 pellets, devastating close, useless far |

There is **no purchase path**. The original concept let players either grind for
weapons *or* buy them, and the buy button undercuts the grind it sits next to —
in multiplayer it becomes pay-to-win. That half is unbuilt on purpose, pending a
design that does not cannibalise its own progression.

## Not built

**Multiplayer.** It is a separate project, not a missing feature: netcode,
authoritative servers, per-month hosting costs, anti-cheat. This build exists to
answer whether the core loop is fun by itself first.

## Technical notes

Everything is procedural — there are no art or audio assets in the repository.

- The ground texture is painted to a `<canvas>` at load and tiled.
- Zombies are assembled from boxes and animated by trigonometry.
- All sound is synthesised with the Web Audio API: gunfire is filtered noise
  bursts, growls are detuned sawtooth oscillators.
- Shooting is hitscan. Bullets raycast against enemy hitboxes and world geometry
  in the same pass, so cover genuinely blocks shots.
- Blood particles and tracers are drawn from fixed pools, so sustained fire
  allocates nothing.

## Deploying

The build output is fully static.

```bash
npm run build     # writes dist/
npm run preview   # serve the production build locally
```

On Vercel the framework is detected automatically — build command `npm run build`,
output directory `dist`. No environment variables are required.
