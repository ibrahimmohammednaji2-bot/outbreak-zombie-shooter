import { WEAPONS, byId } from "./weapons.js";
import { DIFFICULTIES } from "./config.js";
import { mapsFor, mapById } from "./maps.js";
import { SLOTS as ATT_SLOTS, forSlot, byAttachmentId } from "./attachments.js";
import { LETHALS, TACTICALS, lethalById, tacticalById } from "./equipment.js";
import {
  loadLoadouts,
  saveLoadouts,
  LOADOUT_COUNT,
  WEAPONS_PER_LOADOUT,
} from "./loadouts.js";
import { sfx } from "./audio.js";

const PREF_KEY = "outbreak:prefs";
const STAT_KEY = "outbreak:stats";

const WEAPON_CLASSES = [...new Set(WEAPONS.map((w) => w.class))];

function readJson(key, fallback) {
  try {
    return { ...fallback, ...(JSON.parse(localStorage.getItem(key) ?? "{}") ?? {}) };
  } catch {
    return { ...fallback };
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private browsing */
  }
}

export const stats = {
  read: () => readJson(STAT_KEY, { kills: 0, bestWave: 0 }),
  bump(kills, wave) {
    const s = readJson(STAT_KEY, { kills: 0, bestWave: 0 });
    s.kills += kills;
    s.bestWave = Math.max(s.bestWave, wave);
    writeJson(STAT_KEY, s);
  },
};

/**
 * The lobby: top bar, weapon closet on the left, character in the middle,
 * mode and deploy on the right.
 */
export function createLobby({ onStart, onApply }) {
  const root = document.getElementById("lobby");
  const topNav = document.getElementById("tabs");
  const left = document.getElementById("lobby-left");
  const right = document.getElementById("lobby-right");

  const prefs = readJson(PREF_KEY, {
    mode: "zombies",
    difficulty: "normal",
    mapId: null,
    bots: 5,
  });
  const stored = loadLoadouts();

  const s = {
    panel: null, // null | "closet" | "settings" | "controls"
    mode: prefs.mode,
    difficulty: prefs.difficulty,
    mapId: prefs.mapId ?? mapsFor(prefs.mode)[0].id,
    bots: prefs.bots,
    loadouts: stored.list,
    selected: stored.selected,
    editSlot: 0,
    weaponClass: WEAPON_CLASSES[0],
    inGame: false,
  };

  const current = () => s.loadouts[s.selected];
  const editing = () => current().weapons[s.editSlot];

  function persist() {
    writeJson(PREF_KEY, {
      mode: s.mode,
      difficulty: s.difficulty,
      mapId: s.mapId,
      bots: s.bots,
    });
    saveLoadouts(s.loadouts, s.selected);
  }

  // ── top bar ────────────────────────────────────────────────────
  function renderTop() {
    topNav.innerHTML = `<button class="tab ${
      s.panel === "controls" ? "on" : ""
    }" data-panel="controls">CONTROLS</button>`;
    const st = stats.read();
    document.getElementById("stat-kills").innerHTML = `${st.kills} <i>KILLS</i>`;
    document.getElementById("stat-best").innerHTML =
      `${st.bestWave} <i>BEST WAVE</i>`;
  }

  // ── closet ─────────────────────────────────────────────────────
  const statBar = (label, value, max) => `
    <span class="bar"><i>${label}</i>
      <s><u style="width:${Math.min(100, (value / max) * 100)}%"></u></s>
    </span>`;

  function closetHtml() {
    const lo = current();
    const entry = editing();
    const w = entry ? byId(entry.id) : null;
    const list = WEAPONS.filter((x) => x.class === s.weaponClass);

    return `
      <div class="closet-head">
        <div>
          <div class="closet-label">LOADOUT</div>
          <div class="chip-row">
            ${s.loadouts
              .map(
                (l, i) =>
                  `<button class="chip ${i === s.selected ? "on" : ""}" data-loadout="${i}">
                     ${i + 1}<small>${l.name}</small>
                   </button>`,
              )
              .join("")}
          </div>
        </div>
        <div>
          <div class="closet-label">WEAPON SLOT</div>
          <div class="chip-row">
            ${Array.from({ length: WEAPONS_PER_LOADOUT }, (_, i) => {
              const e = lo.weapons[i];
              return `<button class="chip ${i === s.editSlot ? "on" : ""}" data-slot="${i}">
                        ${i + 1}<small>${e ? byId(e.id).name : "EMPTY"}</small>
                      </button>`;
            }).join("")}
          </div>
        </div>
      </div>

      <div class="closet-body">
        <div class="closet-left">
          <div class="type-tabs">
            ${WEAPON_CLASSES.map(
              (c) =>
                `<button class="type-tab ${c === s.weaponClass ? "on" : ""}" data-class="${c}">${c}</button>`,
            ).join("")}
          </div>
          <div class="weapon-list">
            ${list
              .map(
                (x) => `
              <button class="wl-item ${entry && x.id === entry.id ? "on" : ""}" data-pick="${x.id}">
                <span class="n">${x.name}</span>
                <span class="b">${x.blurb}</span>
              </button>`,
              )
              .join("")}
          </div>
        </div>

        <div class="closet-right">
          ${w ? weaponDetail(w, entry) : `<div class="detail-blurb">Pick a weapon on the left.</div>`}
          ${equipmentHtml(lo)}
        </div>
      </div>`;
  }

  function weaponDetail(w, entry) {
    return `
      <div class="detail-name">${w.name}</div>
      <div class="detail-class">${w.class}</div>
      <div class="detail-blurb">${w.blurb}</div>
      <div class="bars" style="margin-bottom:14px">
        ${statBar("DMG", w.damage * w.pellets, 200)}
        ${statBar("RATE", 1 / w.rpm, 24)}
        ${statBar("MAG", w.mag, 100)}
        ${statBar("ACC", 1 / (w.spread * 1000 + 0.3), 3)}
      </div>
      ${ATT_SLOTS.map((slot) => {
        const chosenId = entry.att[slot.id];
        const chosen = byAttachmentId(chosenId);
        return `
          <div class="att-slot">
            <div class="closet-label">${slot.name.toUpperCase()}</div>
            <div class="att-opts">
              <button class="att ${!chosenId ? "on" : ""}" data-att="none" data-attslot="${slot.id}">NONE</button>
              ${forSlot(slot.id)
                .map(
                  (a) =>
                    `<button class="att ${a.id === chosenId ? "on" : ""}"
                             data-att="${a.id}" data-attslot="${slot.id}">${a.name}</button>`,
                )
                .join("")}
            </div>
            <div class="att-desc">${chosen ? chosen.desc : "No attachment fitted."}</div>
          </div>`;
      }).join("")}`;
  }

  function equipmentHtml(lo) {
    const l = lethalById(lo.lethal);
    const t = tacticalById(lo.tactical);
    return `
      <div class="equip-block">
        <div class="closet-label">LETHAL — <kbd>G</kbd></div>
        <div class="att-opts">
          ${LETHALS.map(
            (x) =>
              `<button class="att ${x.id === lo.lethal ? "on" : ""}" data-lethal="${x.id}">${x.name}</button>`,
          ).join("")}
        </div>
        <div class="att-desc">${l.desc}</div>

        <div class="closet-label" style="margin-top:10px">TACTICAL — <kbd>Q</kbd></div>
        <div class="att-opts">
          ${TACTICALS.map(
            (x) =>
              `<button class="att ${x.id === lo.tactical ? "on" : ""}" data-tactical="${x.id}">${x.name}</button>`,
          ).join("")}
        </div>
        <div class="att-desc">${t.desc}</div>
      </div>`;
  }

  // ── mode pane ──────────────────────────────────────────────────
  function modeHtml() {
    return `
      <div class="mode-pane">
        <div class="closet-label">GAME MODE</div>
        <div class="grid" style="grid-template-columns:1fr 1fr;margin-bottom:16px">
          <button class="opt ${s.mode === "zombies" ? "on" : ""}" data-mode="zombies">
            <span class="opt-title">ZOMBIES</span>
            <span class="opt-desc">Endless waves. Survive as long as you can.</span>
          </button>
          <button class="opt ${s.mode === "dm" ? "on" : ""}" data-mode="dm">
            <span class="opt-title">MULTIPLAYER</span>
            <span class="opt-desc">Free-for-all deathmatch against bots. Online
              play needs a server this build does not have.</span>
          </button>
        </div>

        <div class="closet-label">${s.mode === "zombies" ? "DIFFICULTY" : "BOT SKILL"}</div>
        <div class="grid diff" style="margin-bottom:16px">
          ${DIFFICULTIES.map(
            (d) => `
            <button class="opt ${d.id === s.difficulty ? "on" : ""}" data-diff="${d.id}" style="--c:${d.color}">
              <span class="opt-title">${d.label}</span>
              <span class="opt-desc">${d.blurb}</span>
              <span class="stats">${
                s.mode === "zombies"
                  ? `<b>×${d.damage}</b> dmg <b>×${d.count}</b> count <b>×${d.speed}</b> speed <b>×${d.health}</b> hp`
                  : `<b>${Math.round(d.botAccuracy * 100)}%</b> accuracy <b>${d.botReaction}s</b> reaction`
              }</span>
            </button>`,
          ).join("")}
        </div>

        ${
          s.mode === "dm"
            ? `<div class="closet-label">OPPONENTS</div>
               <div class="chip-row" style="margin-bottom:16px">
                 ${[3, 5, 7]
                   .map(
                     (n) =>
                       `<button class="chip ${n === s.bots ? "on" : ""}" data-bots="${n}">${n} BOTS</button>`,
                   )
                   .join("")}
               </div>`
            : ""
        }

        <div class="closet-label">MAP</div>
        <div class="grid maps">
          ${mapsFor(s.mode)
            .map(
              (m) => `
            <button class="opt ${m.id === s.mapId ? "on" : ""}" data-map="${m.id}">
              <span class="opt-title">${m.name}</span>
              <span class="opt-desc">${m.blurb}</span>
            </button>`,
            )
            .join("")}
        </div>
      </div>`;
  }

  const controlsHtml = () => `
    <div class="help">
      <h3>MOVEMENT</h3>
      <div><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> move · <kbd>⇧</kbd> sprint · <kbd>␣</kbd> jump</div>
      <h3>COMBAT</h3>
      <div><kbd>LMB</kbd> fire · <kbd>RMB</kbd> aim down sights</div>
      <div><kbd>R</kbd> reload · <kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> weapons</div>
      <h3>EQUIPMENT</h3>
      <div><kbd>G</kbd> lethal · <kbd>Q</kbd> tactical · <kbd>V</kbd> detonate C4</div>
      <h3>OTHER</h3>
      <div><kbd>Esc</kbd> pause — you can change loadout from there mid-match</div>
      <h3>NOTE</h3>
      <div style="opacity:.5;font-size:11px;line-height:1.7">
        Multiplayer opponents are AI. Networked play would need a dedicated
        game server, which a static site cannot provide.
      </div>
    </div>`;

  // ── right column ───────────────────────────────────────────────
  /* Bottom-right stack: what you are about to play, then the button that plays it. */
  function renderRight() {
    const map = mapById(s.mapId);
    const diff = DIFFICULTIES.find((d) => d.id === s.difficulty);
    const lo = current();

    right.innerHTML = `
      <button class="stack-btn ${s.panel === "closet" ? "on" : ""}" data-panel="closet">
        <span class="sb-title">WEAPON CLOSET</span>
        <span class="sb-sub">${s.selected + 1} ${lo.name} · ${
          lo.weapons[0] ? byId(lo.weapons[0].id).name : "—"
        }</span>
      </button>
      <button class="stack-btn ${s.panel === "settings" ? "on" : ""}" data-panel="settings">
        <span class="sb-title">MODE · MAP · DIFFICULTY</span>
        <span class="sb-sub">${
          s.mode === "zombies" ? "Zombies" : "Multiplayer"
        } · ${map.name} · ${diff.label}</span>
      </button>
      <button class="play-btn" data-play="1">${s.inGame ? "APPLY & RESUME" : "START GAME"}</button>`;
  }

  function render() {
    renderTop();
    if (s.panel) {
      left.classList.remove("hidden");
      left.innerHTML =
        `<button class="panel-close" data-close="1">✕</button>` +
        (s.panel === "closet"
          ? closetHtml()
          : s.panel === "settings"
            ? modeHtml()
            : controlsHtml());
    } else {
      left.classList.add("hidden");
      left.innerHTML = "";
    }
    renderRight();
  }

  // ── interaction ────────────────────────────────────────────────
  root.addEventListener("click", (e) => {
    const el = e.target.closest("button");
    if (!el || el.disabled) return;
    const d = el.dataset;
    let dirty = true;

    if (d.panel) s.panel = s.panel === d.panel ? null : d.panel;
    else if (d.close) s.panel = null;
    else if (d.loadout !== undefined) {
      s.selected = Number(d.loadout);
      s.editSlot = 0;
    } else if (d.slot !== undefined) {
      s.editSlot = Number(d.slot);
      const entry = editing();
      if (entry) s.weaponClass = byId(entry.id).class;
    } else if (d.class) s.weaponClass = d.class;
    else if (d.pick) {
      const lo = current();
      const existing = lo.weapons[s.editSlot];
      lo.weapons[s.editSlot] = { id: d.pick, att: existing?.att ?? {} };
      // an attachment that does not fit the new weapon's slots is dropped
      persist();
    } else if (d.attslot) {
      const entry = editing();
      if (entry) {
        if (d.att === "none") delete entry.att[d.attslot];
        else entry.att[d.attslot] = d.att;
        persist();
      }
    } else if (d.lethal) {
      current().lethal = d.lethal;
      persist();
    } else if (d.tactical) {
      current().tactical = d.tactical;
      persist();
    } else if (d.mode) {
      s.mode = d.mode;
      s.mapId = mapsFor(s.mode)[0].id;
      persist();
    } else if (d.diff) {
      s.difficulty = d.diff;
      persist();
    } else if (d.bots) {
      s.bots = Number(d.bots);
      persist();
    } else if (d.map) {
      s.mapId = d.map;
      persist();
    } else if (d.play) {
      persist();
      const config = {
        mode: s.mode,
        difficulty: s.difficulty,
        mapId: s.mapId,
        bots: s.bots,
        loadout: structuredClone(current()),
      };
      root.classList.add("hidden");
      if (s.inGame) {
        s.inGame = false;
        onApply(config.loadout);
      } else {
        onStart(config);
      }
      return;
    } else dirty = false;

    if (dirty) {
      sfx.click();
      render();
    }
  });

  return {
    open({ inGame = false } = {}) {
      s.inGame = inGame;
      s.panel = inGame ? "closet" : null;
      render();
      root.classList.remove("hidden");
    },
    close() {
      root.classList.add("hidden");
    },
    get config() {
      return {
        mode: s.mode,
        difficulty: s.difficulty,
        mapId: s.mapId,
        bots: s.bots,
        loadout: structuredClone(current()),
      };
    },
  };
}
