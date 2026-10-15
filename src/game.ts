import type { Game } from "@clockwyrks/simple-2d";
import type { DeepReadonly } from "ts-essentials";
import * as C from "./constants";
import { render } from "./render";
export const BACKGROUND = "#02090f";
export type Direction = "up" | "down" | "left" | "right";
export type Screen =
  | "title"
  | "howto"
  | "countdown"
  | "playing"
  | "paused"
  | "cleared"
  | "gameover";
export interface Body {
  x: number;
  y: number;
  tx: number;
  ty: number;
  dir: Direction;
  moving: boolean;
  lit: boolean;
  mind: boolean;
  travel: boolean;
}
export interface Predator extends Body {
  kind: C.PredatorKind;
  state: "den" | "wander" | "chase" | "search";
  released: boolean;
  speed: number;
  alert: boolean;
  detectRange: number | null;
  hearingRange: number | null;
  hearingLock: boolean | null;
  flareCharging: boolean | null;
  flaring: boolean | null;
  flareRadius: number | null;
  fix: { tx: number; ty: number } | null;
  linger: number;
  alertIn: number;
  mark: number;
  timer: number;
  phase: number;
  fade: number;
  search: number;
  searchPing: boolean;
  lastPing: number;
  release: number | null;
  chaseSpeed: number;
}
export interface Pulse {
  source: "forager" | "gloamfin";
  tint: "cyan" | "violet" | "orange";
  ox: number;
  oy: number;
  front: number;
  range: number;
  owner: number;
  hit: boolean;
}
export interface FathomState {
  version: number;
  screen: Screen;
  menuIndex: number | null;
  titleIndex: number;
  depth: number;
  score: number;
  lives: number;
  muted: boolean;
  planktonRemaining: number;
  drifterIn: number;
  brightness: number;
  brightHold: number;
  visionRadius: number;
  windowRadius: number;
  sonar: { ready: boolean; cooldown: number; range: number };
  ink: { ready: boolean; cooldown: number };
  grid: {
    cols: number;
    rows: number;
    tile: number;
    originX: number;
    originY: number;
  };
  tiles: string[];
  plankton: string[];
  visibility: string[];
  forager: Body;
  drifters: Body[];
  predators: Predator[];
  pulses: Pulse[];
  inkClouds: { x: number; y: number; radius: number; remaining: number }[];
  simTime: number;
  remainder: number;
  queuedSonar: boolean;
  queuedInk: boolean;
  screenIn: number;
  playTime: number;
  desired: Direction;
  seed: number;
  marks: number[];
  images: Record<string, ImageBitmap[]>;
  pointerDown: number | null;
  pointerX: number;
  pointerY: number;
}
export type ReadState = DeepReadonly<FathomState>;
export const dirs: Direction[] = ["up", "right", "down", "left"];
export const delta = {
  up: [0, -1],
  right: [1, 0],
  down: [0, 1],
  left: [-1, 0],
} as const;
export const center = (tx: number, ty: number) => ({
  x: C.GRID_ORIGIN_X + (tx + 0.5) * C.TILE,
  y: C.GRID_ORIGIN_Y + (ty + 0.5) * C.TILE,
  tx,
  ty,
});
export const body = (tx: number, ty: number): Body => ({
  ...center(tx, ty),
  dir: "up",
  moving: false,
  lit: false,
  mind: true,
  travel: true,
});
export function clone(s: ReadState): FathomState {
  return {
    ...s,
    grid: { ...s.grid },
    sonar: { ...s.sonar },
    ink: { ...s.ink },
    tiles: [...s.tiles],
    plankton: [...s.plankton],
    visibility: [...s.visibility],
    forager: { ...s.forager },
    drifters: s.drifters.map((b) => ({ ...b })),
    predators: s.predators.map((p) => ({
      ...p,
      fix: p.fix ? { ...p.fix } : null,
    })),
    pulses: s.pulses.map((p) => ({ ...p })),
    inkClouds: s.inkClouds.map((p) => ({ ...p })),
    marks: [...s.marks],
    images: s.images as Record<string, ImageBitmap[]>,
  };
}
export function tile(s: ReadState, x: number, y: number) {
  return s.tiles[y]?.[x] ?? "#";
}
export function neighbor(s: ReadState, x: number, y: number, d: Direction) {
  const [dx, dy] = delta[d];
  let nx = x + dx;
  const ny = y + dy;
  if (nx < 0 && tile(s, 0, y) === "." && tile(s, C.GRID_COLS - 1, y) === ".")
    nx = C.GRID_COLS - 1;
  if (
    nx >= C.GRID_COLS &&
    tile(s, 0, y) === "." &&
    tile(s, C.GRID_COLS - 1, y) === "."
  )
    nx = 0;
  return { tx: nx, ty: ny };
}
export function open(s: ReadState, x: number, y: number, den = false) {
  return (den ? ".dg" : ".").includes(tile(s, x, y));
}
export function put(rows: string[], x: number, y: number, c: string) {
  rows[y] = rows[y].slice(0, x) + c + rows[y].slice(x + 1);
}
function layout() {
  const a = Array.from({ length: C.GRID_ROWS }, () =>
    Array<string>(C.GRID_COLS).fill("#"),
  );
  for (let y = 1; y < 17; y++)
    for (let x = 1; x < 35; x++) {
      if (y % 3 === 1 || [1, 5, 9, 13, 22, 26, 30, 34].includes(x))
        a[y][x] = ".";
    } // loops, mirrored ribbed trench
  for (let y = 0; y < 18; y++)
    for (let x = 0; x < 18; x++) a[y][35 - x] = a[y][x];
  // Clear the central chamber's envelope, then route a ring around it.
  for (let y = 4; y <= 12; y++) for (let x = 14; x <= 21; x++) a[y][x] = "#";
  for (let x = 13; x <= 22; x++) {
    a[5][x] = ".";
    a[11][x] = ".";
  }
  for (let y = 5; y <= 11; y++) {
    a[y][13] = ".";
    a[y][22] = ".";
  }
  for (let y = 7; y <= 9; y++) for (let x = 16; x <= 19; x++) a[y][x] = "d";
  a[6][17] = "g";
  for (let x = 0; x < 36; x++) a[13][x] = ".";
  // Remove dangling corridors until every corridor belongs to a loop.
  let changed = true;
  while (changed) {
    changed = false;
    for (let y = 1; y < 17; y++)
      for (let x = 1; x < 35; x++)
        if (
          a[y][x] === "." &&
          [
            [0, 1],
            [0, -1],
            [1, 0],
            [-1, 0],
          ].filter(([dx, dy]) => a[y + dy]?.[x + dx] === ".").length < 2
        ) {
          a[y][x] = "#";
          changed = true;
        }
  }
  return a.map((r) => r.join(""));
}
export function predator(kind: C.PredatorKind, x: number, y: number): Predator {
  return {
    ...body(x, y),
    kind,
    state: "wander",
    released: true,
    speed: C.PREDATOR_SPEED,
    alert: false,
    detectRange: null,
    hearingRange: null,
    hearingLock: kind === "gloamfin" ? false : null,
    flareCharging: kind === "flarefish" ? false : null,
    flaring: kind === "flarefish" ? false : null,
    flareRadius: kind === "flarefish" ? 0 : null,
    fix: null,
    linger: 0,
    alertIn: 0,
    mark: 0,
    timer: kind === "flarefish" ? C.FLARE_INTERVAL : C.GLOAMFIN_PING_INTERVAL,
    phase: 0,
    fade: 0,
    search: 0,
    searchPing: false,
    lastPing: -100,
    release: null,
    chaseSpeed: C.GLOAMFIN_CHASE_SPEED,
  };
}
export function roster(s: FathomState) {
  const kinds = [
    ...C.DEN_ORDER,
    ...C.ROSTER_ADD_ORDER.slice(0, Math.min(s.depth, C.ROSTER_CAP_DEPTH) - 1),
  ];
  s.predators = kinds.map((k, i) => ({
    ...predator(k, 16 + (i % 4), 8),
    state: "den",
    released: false,
    release: i * C.DEN_RELEASE_GAP,
  }));
  s.playTime = 0;
}
export function fresh(images: Record<string, ImageBitmap[]> = {}): FathomState {
  const tiles = layout();
  const s: FathomState = {
    version: C.FATHOM_DEBUG_VERSION,
    screen: "title",
    menuIndex: 0,
    titleIndex: 0,
    depth: 1,
    score: 0,
    lives: C.START_LIVES,
    muted: false,
    planktonRemaining: 0,
    drifterIn: C.DRIFTER_INTERVAL,
    brightness: 0,
    brightHold: 0,
    visionRadius: C.VISION_MIN,
    windowRadius: C.KINDLE_VISION_MIN,
    sonar: { ready: true, cooldown: 0, range: C.SONAR_RANGE_BASE },
    ink: { ready: true, cooldown: 0 },
    grid: {
      cols: C.GRID_COLS,
      rows: C.GRID_ROWS,
      tile: C.TILE,
      originX: C.GRID_ORIGIN_X,
      originY: C.GRID_ORIGIN_Y,
    },
    tiles,
    plankton: tiles.map((r) => r.replace(/[^.]/g, "-").replace(/\./g, "*")),
    visibility: tiles.map(() => "u".repeat(C.GRID_COLS)),
    forager: body(17, 13),
    drifters: [],
    predators: [],
    pulses: [],
    inkClouds: [],
    simTime: 0,
    remainder: 0,
    queuedSonar: false,
    queuedInk: false,
    screenIn: 2,
    playTime: 0,
    desired: "up",
    seed: 7421,
    marks: Array<number>(648).fill(0),
    images,
    pointerDown: null,
    pointerX: -1,
    pointerY: -1,
  };
  roster(s);
  return reconcile(s);
}
export function reconcile(s: FathomState) {
  for (const b of [s.forager, ...s.predators, ...s.drifters]) {
    b.tx = Math.floor((b.x - C.GRID_ORIGIN_X) / C.TILE);
    b.ty = Math.floor((b.y - C.GRID_ORIGIN_Y) / C.TILE);
  }
  s.visionRadius = C.VISION_MIN + C.VISION_GAIN * s.brightness;
  s.windowRadius = C.KINDLE_VISION_MIN + C.KINDLE_VISION_GAIN * s.brightness;
  s.planktonRemaining = s.plankton.join("").split("*").length - 1;
  s.sonar.ready = s.sonar.cooldown === 0;
  s.ink.ready = s.ink.cooldown === 0;
  s.sonar.range = Math.max(C.SONAR_RANGE_MIN, C.SONAR_RANGE_BASE - s.depth + 1);
  for (const p of s.predators) {
    p.detectRange =
      p.kind === "gloamfin"
        ? null
        : C.LANTERN_RANGE_BASE + C.LANTERN_RANGE_GAIN * s.brightness;
    p.hearingRange = p.kind === "gloamfin" ? C.GLOAMFIN_HEAR : null;
    p.speed =
      p.kind === "lanternjaw" && p.state !== "chase"
        ? C.DRIFTER_SPEED
        : p.kind === "gloamfin" && p.state === "chase"
          ? p.chaseSpeed
          : C.PREDATOR_SPEED;
  }
  return s;
}
export function distances(s: ReadState, x: number, y: number, den = false) {
  const map = new Map<string, number>();
  const q = [{ tx: x, ty: y }];
  map.set(`${x},${y}`, 0);
  for (let i = 0; i < q.length; i++) {
    const b = q[i];
    for (const d of dirs) {
      const n = neighbor(s, b.tx, b.ty, d),
        key = `${n.tx},${n.ty}`;
      if (open(s, n.tx, n.ty, den) && !map.has(key)) {
        map.set(key, map.get(`${b.tx},${b.ty}`)! + 1);
        q.push(n);
      }
    }
  }
  return map;
}
export function los(
  s: ReadState,
  a: { x: number; y: number },
  b: { x: number; y: number },
) {
  const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 4);
  for (let i = 1; i < n; i++) {
    const x = Math.floor(
        (a.x + ((b.x - a.x) * i) / n - C.GRID_ORIGIN_X) / C.TILE,
      ),
      y = Math.floor((a.y + ((b.y - a.y) * i) / n - C.GRID_ORIGIN_Y) / C.TILE);
    if (
      tile(s, x, y) === "#" &&
      (x !== Math.floor((b.x - C.GRID_ORIGIN_X) / C.TILE) ||
        y !== Math.floor((b.y - C.GRID_ORIGIN_Y) / C.TILE))
    )
      return false;
  }
  return true;
}
function random(s: FathomState) {
  s.seed = (Math.imul(s.seed, 1664525) + 1013904223) >>> 0;
  return s.seed / 4294967296;
}
function choose(
  s: FathomState,
  b: Body,
  target: { tx: number; ty: number } | null,
  den = false,
  within: { tx: number; ty: number } | null = null,
) {
  const bounds = within ? distances(s, within.tx, within.ty) : null;
  let options = dirs.filter((d) => {
    const n = neighbor(s, b.tx, b.ty, d);
    return (
      open(s, n.tx, n.ty, den) &&
      (!bounds ||
        (bounds.get(`${n.tx},${n.ty}`) ?? Infinity) <= C.GLOAMFIN_SEARCH_ROAM)
    );
  });
  if (target) {
    const m = distances(s, target.tx, target.ty, den);
    options.sort((a, c) => {
      const n = neighbor(s, b.tx, b.ty, a),
        o = neighbor(s, b.tx, b.ty, c);
      return (
        (m.get(`${n.tx},${n.ty}`) ?? 999) - (m.get(`${o.tx},${o.ty}`) ?? 999)
      );
    });
    return options[0] ?? b.dir;
  }
  const forward = options.filter(
    (d) => dirs.indexOf(d) !== (dirs.indexOf(b.dir) + 2) % 4,
  );
  options = forward.length ? forward : options;
  return options[Math.floor(random(s) * options.length)] ?? b.dir;
}
function move(
  s: FathomState,
  b: Body,
  speed: number,
  decide: () => Direction,
  den = false,
) {
  b.moving = false;
  if (!open(s, b.tx, b.ty, den)) return;
  let remaining = speed * C.TICK_DT;
  while (remaining > 1e-8) {
    const c = center(b.tx, b.ty);
    const at = Math.abs(c.x - b.x) < 1e-6 && Math.abs(c.y - b.y) < 1e-6;
    if (at) {
      b.dir = decide();
      const n = neighbor(s, b.tx, b.ty, b.dir);
      if (!open(s, n.tx, n.ty, den)) break;
    }
    const [dx, dy] = delta[b.dir];
    let gap = dx
      ? dx > 0
        ? c.x - b.x
        : c.x === b.x
          ? 0
          : b.x - c.x
      : dy > 0
        ? c.y - b.y
        : c.y === b.y
          ? 0
          : b.y - c.y;
    if (gap <= 1e-7) gap += C.TILE;
    const step = Math.min(remaining, gap);
    b.x += dx * step;
    b.y += dy * step;
    if (b.x < C.GRID_ORIGIN_X) b.x += C.GRID_COLS * C.TILE;
    if (b.x >= C.GRID_ORIGIN_X + C.GRID_COLS * C.TILE)
      b.x -= C.GRID_COLS * C.TILE;
    b.tx = Math.floor((b.x - C.GRID_ORIGIN_X) / C.TILE);
    b.ty = Math.floor((b.y - C.GRID_ORIGIN_Y) / C.TILE);
    remaining -= step;
    b.moving = true;
  }
}
function acquire(s: FathomState, p: Predator, force = false) {
  if (p.state !== "chase" || force) {
    p.alertIn = p.kind === "lanternjaw" ? 0 : C.ALERT_TIME;
    p.chaseSpeed = C.GLOAMFIN_CHASE_SPEED;
  }
  p.fix = { tx: s.forager.tx, ty: s.forager.ty };
  const route = choose(s, p, p.fix);
  if (dirs.indexOf(route) === (dirs.indexOf(p.dir) + 2) % 4) p.dir = route;
  p.state = "chase";
  p.linger = C.LINGER_TIME;
  if (p.phase > 0) p.fade = 0.35;
  p.phase = 0;
}
function blind(s: FathomState, p: Predator) {
  return s.inkClouds.some((c) => {
    const f = s.forager,
      dx = f.x - p.x,
      dy = f.y - p.y;
    const t = Math.max(
      0,
      Math.min(
        1,
        ((c.x - p.x) * dx + (c.y - p.y) * dy) / (dx * dx + dy * dy || 1),
      ),
    );
    return Math.hypot(p.x + t * dx - c.x, p.y + t * dy - c.y) <= c.radius;
  });
}
export function sense(s: FathomState) {
  reconcile(s);
  s.visibility = s.visibility.map((r) => r.replace(/l/g, "r"));
  for (let y = 0; y < C.GRID_ROWS; y++)
    for (let x = 0; x < C.GRID_COLS; x++) {
      const c = center(x, y);
      const flare = s.predators.some(
        (p) => p.flaring && Math.hypot(c.x - p.x, c.y - p.y) <= C.FLARE_RADIUS,
      );
      if (
        flare ||
        s.marks[y * C.GRID_COLS + x] > 0 ||
        (Math.hypot(c.x - s.forager.x, c.y - s.forager.y) <= s.visionRadius &&
          los(s, s.forager, c))
      )
        put(s.visibility, x, y, "l");
    }
  for (const b of [...s.predators, ...s.drifters]) {
    const passive =
      Math.hypot(b.x - s.forager.x, b.y - s.forager.y) <= s.visionRadius &&
      los(s, s.forager, b);
    b.lit =
      passive ||
      s.predators.some(
        (p) => p.flaring && Math.hypot(p.x - b.x, p.y - b.y) <= C.FLARE_RADIUS,
      );
    if ("kind" in b) {
      const p = b as Predator;
      p.alert = p.alertIn > 0;
      p.lit =
        p.state !== "den" &&
        (p.lit || p.alert || p.mark > 0 || !!p.flareCharging);
    }
  }
}
export function screen(s: FathomState, value: Screen) {
  const previous = s.screen;
  s.screen = value;
  s.menuIndex =
    value === "title"
      ? s.titleIndex
      : ["paused", "gameover"].includes(value)
        ? 0
        : null;
  s.screenIn = 2;
  if (value === "playing" && previous !== "paused") s.playTime = 0;
  return s;
}
export function attempt(s: FathomState) {
  s.forager = body(17, 13);
  s.queuedSonar = false;
  s.queuedInk = false;
  s.brightness = 0;
  s.brightHold = 0;
  s.pulses = [];
  s.inkClouds = [];
  s.drifters = [];
  s.marks.fill(0);
  s.drifterIn = C.DRIFTER_INTERVAL;
  s.sonar.cooldown = 0;
  s.ink.cooldown = 0;
  roster(s);
  screen(s, "countdown");
  reconcile(s);
}
function tick(s: FathomState, held: boolean, cues: Set<C.CueName>) {
  s.simTime += C.TICK_DT;
  if (s.screen === "countdown") {
    s.screenIn -= C.TICK_DT;
    sense(s);
    if (s.screenIn < 1e-7) screen(s, "playing");
    return;
  }
  if (s.screen === "cleared") {
    s.screenIn -= C.TICK_DT;
    if (s.screenIn < 1e-7) {
      const n = fresh(s.images);
      n.depth = s.depth + 1;
      n.score = s.score;
      n.lives = s.lives;
      n.simTime = s.simTime;
      n.muted = s.muted;
      attempt(n);
      Object.assign(s, n);
    }
    return;
  }
  if (s.screen !== "playing") return;
  {
    if (s.queuedSonar && s.sonar.ready) {
      s.pulses.push({
        source: "forager",
        tint: "cyan",
        ox: s.forager.tx,
        oy: s.forager.ty,
        front: -0.001,
        range: s.sonar.range,
        owner: -1,
        hit: false,
      });
      s.sonar.cooldown = C.SONAR_COOLDOWN;
      cues.add(C.CUES.sonar);
    }
    if (s.queuedInk && s.ink.ready) {
      s.inkClouds.push({
        x: s.forager.x,
        y: s.forager.y,
        radius: C.INK_RADIUS,
        remaining: C.INK_LIFE,
      });
      s.ink.cooldown = C.INK_COOLDOWN;
      cues.add(C.CUES.ink);
    }
  }

  s.queuedSonar = false;
  s.queuedInk = false;
  s.playTime += C.TICK_DT;
  for (const a of [s.sonar, s.ink])
    a.cooldown = Math.max(0, a.cooldown - C.TICK_DT);
  if (s.brightHold > 0) s.brightHold = Math.max(0, s.brightHold - C.TICK_DT);
  else s.brightness *= 0.5 ** (C.TICK_DT / C.BRIGHT_HALFLIFE);
  s.marks = s.marks.map((v) => Math.max(0, v - C.TICK_DT));
  s.inkClouds = s.inkClouds
    .map((c) => ({ ...c, remaining: c.remaining - C.TICK_DT }))
    .filter((c) => c.remaining > 0);
  const f = s.forager;
  if (held) {
    if (dirs.indexOf(s.desired) === (dirs.indexOf(f.dir) + 2) % 4)
      f.dir = s.desired;
    move(s, f, C.FORAGER_SPEED, () => {
      const n = neighbor(s, f.tx, f.ty, s.desired);
      return open(s, n.tx, n.ty) ? s.desired : f.dir;
    });
  } else f.moving = false;
  if (s.plankton[f.ty]?.[f.tx] === "*") {
    put(s.plankton, f.tx, f.ty, "-");
    s.score += C.SCORE_PLANKTON;
    s.brightness = Math.min(1, s.brightness + C.BRIGHT_PER_EAT);
    s.brightHold = C.BRIGHT_HOLD;
    cues.add(C.CUES.eat);
    s.planktonRemaining--;
    if (s.planktonRemaining === 0) {
      s.score += C.SCORE_CLEAR;
      screen(s, "cleared");
      cues.add(C.CUES.descend);
    }
  }
  s.drifterIn = Math.max(0, s.drifterIn - C.TICK_DT);
  if (
    s.drifterIn === 0 &&
    s.planktonRemaining > 0 &&
    s.drifters.length < C.DRIFTER_MAX
  ) {
    const gy = s.tiles.findIndex((r) => r.includes("g"));
    if (gy >= 0) {
      const gx = s.tiles[gy].indexOf("g");
      const n = dirs
        .map((d) => neighbor(s, gx, gy, d))
        .find((n) => open(s, n.tx, n.ty));
      if (n) s.drifters.push(body(n.tx, n.ty));
      s.drifterIn = C.DRIFTER_INTERVAL;
    }
  }
  for (const b of s.drifters)
    if (b.mind && b.travel)
      move(s, b, C.DRIFTER_SPEED, () => choose(s, b, null));
  s.drifters = s.drifters.filter((b) => {
    if (b.tx === f.tx && b.ty === f.ty) {
      s.score += C.SCORE_DRIFTER;
      return false;
    }
    return true;
  });
  for (const [i, p] of s.predators.entries()) {
    if (p.release !== null && s.playTime >= p.release) p.released = true;
    p.mark = Math.max(0, p.mark - C.TICK_DT);
    p.fade = Math.max(0, p.fade - C.TICK_DT);
    if (!p.mind) continue;
    p.alertIn = Math.max(0, p.alertIn - C.TICK_DT);
    if (p.state === "den") {
      const gy = s.tiles.findIndex((r) => r.includes("g"));
      if (!p.released || gy < 0 || !s.tiles.some((r) => r.includes("d")))
        continue;
      const gx = s.tiles[gy].indexOf("g");
      const exit = dirs
        .map((d) => neighbor(s, gx, gy, d))
        .find((n) => open(s, n.tx, n.ty));
      if (exit && p.travel)
        move(s, p, p.speed, () => choose(s, p, exit, true), true);
      if (tile(s, p.tx, p.ty) === ".") p.state = "wander";
      continue;
    }
    const dist = Math.hypot(p.x - f.x, p.y - f.y);
    if (p.kind === "gloamfin") {
      p.hearingLock = dist <= C.GLOAMFIN_HEAR;
      if (p.hearingLock) acquire(s, p);
      p.timer -= C.TICK_DT;
      p.search += p.state === "search" ? C.TICK_DT : 0;
      const special =
        p.state === "search" &&
        p.search >= C.GLOAMFIN_SEARCH_DELAY &&
        !p.searchPing;
      if (
        !p.hearingLock &&
        s.simTime - p.lastPing >= C.GLOAMFIN_PING_MIN_GAP &&
        (special || p.timer <= 0)
      ) {
        s.pulses.push({
          source: "gloamfin",
          tint: special ? "orange" : "violet",
          ox: p.tx,
          oy: p.ty,
          front: -0.001,
          range: C.GLOAMFIN_PING_RANGE,
          owner: i,
          hit: false,
        });
        p.lastPing = s.simTime;
        p.timer = C.GLOAMFIN_PING_INTERVAL;
        if (special) p.searchPing = true;
        cues.add(C.CUES.predatorPing);
      }
      if (
        p.state === "chase" &&
        p.fix &&
        p.tx === p.fix.tx &&
        p.ty === p.fix.ty &&
        !p.hearingLock
      ) {
        p.state = "search";
        p.search = 0;
        p.searchPing = false;
      }
      if (p.state === "search" && p.search >= C.GLOAMFIN_GIVEUP) {
        p.state = "wander";
        p.fix = null;
      }
      p.chaseSpeed = Math.min(
        C.GLOAMFIN_CHASE_SPEED,
        p.chaseSpeed +
          ((C.GLOAMFIN_CHASE_SPEED - C.GLOAMFIN_CORNER_SPEED) * C.TICK_DT) /
            C.GLOAMFIN_RAMP_TIME,
      );
    } else {
      const blocked = blind(s, p);
      const seen =
        !blocked &&
        ((dist <= (p.detectRange ?? 0) && los(s, p, f)) ||
          (p.flaring && dist <= C.FLARE_RADIUS));
      if (seen) acquire(s, p);
      else if (
        blocked ||
        ((p.linger -= C.TICK_DT) <= 0 && p.state === "chase")
      ) {
        if (p.state === "chase") p.timer = C.FLARE_INTERVAL;
        p.state = "wander";
        p.fix = null;
        p.phase = 0;
      }
      if (p.kind === "flarefish") {
        if (p.state === "wander") {
          if (p.phase === 0) {
            p.timer -= C.TICK_DT;
            if (p.timer <= 0) p.phase = C.FLARE_CHARGE + C.FLARE_BLOOM;
          } else {
            const old = p.phase;
            p.phase = Math.max(0, p.phase - C.TICK_DT);
            if (old > C.FLARE_BLOOM && p.phase <= C.FLARE_BLOOM)
              cues.add(C.CUES.flare);
            if (p.phase === 0) {
              p.timer = C.FLARE_INTERVAL;
              p.fade = 0.35;
            }
          }
        }
        p.flareCharging = p.phase > C.FLARE_BLOOM;
        p.flaring = p.phase > 0 && p.phase <= C.FLARE_BLOOM;
        p.flareRadius = p.flaring ? C.FLARE_RADIUS : 0;
      }
    }
    reconcile(s);
    const fixedCenter = p.fix ? center(p.fix.tx, p.fix.ty) : null;
    if (
      p.travel &&
      !(
        p.state === "chase" &&
        p.kind !== "gloamfin" &&
        fixedCenter &&
        Math.hypot(p.x - fixedCenter.x, p.y - fixedCenter.y) < 1e-6
      )
    ) {
      const old = p.dir;
      move(s, p, p.speed, () => {
        if (
          p.state === "search" &&
          p.fix &&
          Math.abs(p.tx - p.fix.tx) + Math.abs(p.ty - p.fix.ty) <=
            C.GLOAMFIN_SEARCH_ROAM
        )
          return choose(s, p, null, false, p.fix);
        return choose(s, p, p.fix);
      });
      if (
        p.kind === "gloamfin" &&
        p.state === "chase" &&
        dirs.indexOf(old) % 2 !== dirs.indexOf(p.dir) % 2
      )
        p.chaseSpeed = C.GLOAMFIN_CORNER_SPEED;
    }
  }
  for (const pulse of s.pulses) {
    const prev = pulse.front;
    pulse.front += C.SONAR_WAVE_SPEED * C.TICK_DT;
    const map = distances(s, pulse.ox, pulse.oy, true);
    for (const [key, d] of map) {
      if (d > pulse.front || d <= prev || d > pulse.range) continue;
      const [x, y] = key.split(",").map(Number);
      if (pulse.source === "forager") {
        s.marks[y * C.GRID_COLS + x] = C.SONAR_MARK_TIME;
        for (const dir of dirs) {
          const n = neighbor(s, x, y, dir);
          if (
            tile(s, n.tx, n.ty) === "#" &&
            n.ty >= 0 &&
            n.ty < C.GRID_ROWS &&
            n.tx >= 0 &&
            n.tx < C.GRID_COLS
          )
            s.marks[n.ty * C.GRID_COLS + n.tx] = C.SONAR_MARK_TIME;
        }
        for (const p of s.predators)
          if (p.tx === x && p.ty === y && p.state !== "den") {
            if (p.kind !== "lanternjaw") p.mark = C.SONAR_MARK_TIME;
            if (p.kind === "gloamfin" && p.mind) acquire(s, p, true);
          }
      } else if (!pulse.hit && x === f.tx && y === f.ty) {
        const p = s.predators[pulse.owner];
        if (p?.mind) acquire(s, p, true);
        pulse.hit = true;
      }
    }
  }
  s.pulses = s.pulses.filter((p) => p.front <= p.range);
  reconcile(s);
  sense(s);
  if (
    s.screen === "playing" &&
    s.predators.some((p) => p.state !== "den" && p.tx === f.tx && p.ty === f.ty)
  ) {
    cues.add(C.CUES.caught);
    if (s.lives === 0) screen(s, "gameover");
    else {
      s.lives--;
      attempt(s);
    }
  }
}
export const menuItems = (s: ReadState) =>
  s.screen === "title"
    ? C.TITLE_ITEMS
    : s.screen === "paused"
      ? C.PAUSE_ITEMS
      : s.screen === "gameover"
        ? C.GAMEOVER_ITEMS
        : [];
export function rect(s: ReadState, i: number) {
  return i >= 0 && i < menuItems(s).length
    ? { x: 110, y: 400 + i * 60, w: 360, h: 48 }
    : null;
}
import { debug } from "./surface";
export type FathomDebugApi = typeof debug;
export const game: Game<FathomState, FathomDebugApi> = {
  async initialize(api) {
    for (const a of C.ACTIONS)
      api.input.register(a, { keys: [...C.BINDINGS[a]] });
    Object.values(C.CUES).forEach((cue, i) =>
      api.audio.define(cue, {
        wave: i % 2 ? "triangle" : "sine",
        freq: 220 + i * 110,
        freqTo: 110 + i * 130,
        durationMs: 80 + i * 45,
        gain: 0.12,
      }),
    );
    const images: Record<string, ImageBitmap[]> = {};
    await Promise.all(
      Object.entries({
        glimmerfin: 8,
        lanternjaw: 16,
        gloamfin: 8,
        flarefish: 8,
        drifter: 8,
        "flare-bloom": 8,
        "trench-walls": 19,
      }).map(async ([name, count]) => {
        images[name] = await Promise.all(
          Array.from({ length: count }, (_, i) =>
            api.assets.loadImage(`${name}/${i}.png`),
          ),
        );
      }),
    );
    for (const k of [
      "screen",
      "depth",
      "score",
      "lives",
      "brightness",
      "visionRadius",
      "windowRadius",
      "planktonRemaining",
    ] as const)
      api.diagnostics.register(k, (s) => s[k]);
    api.diagnostics.register(
      "cooldowns",
      (s) => `${s.sonar.cooldown.toFixed(2)} / ${s.ink.cooldown.toFixed(2)}`,
    );
    api.diagnostics.register(
      "forager",
      (s) => `${s.forager.tx},${s.forager.ty} ${s.forager.dir}`,
    );
    for (let i = 0; i < C.ROSTER_CAP * 3; i++)
      api.diagnostics.register(`predator ${i}`, (s) => {
        const p = s.predators[i];
        return p
          ? `${p.kind} ${p.state} ${p.tx},${p.ty} ${p.speed.toFixed(1)} alert:${p.alert}`
          : "—";
      });
    return [fresh(images), debug];
  },
  update(state, api, dt) {
    let s = clone(state);
    const frameScreen = state.screen;
    if (api.input.pressed("mute")) api.audio.setMuted(!api.audio.muted());
    s.muted = api.audio.muted();
    const pressed = (a: string) => api.input.pressed(a);
    const begin = () => {
      const n = fresh(s.images);
      n.simTime = s.simTime;
      n.titleIndex = s.titleIndex;
      n.muted = s.muted;
      s = screen(n, "countdown");
    };
    const title = () => {
      const n = fresh(s.images);
      n.simTime = s.simTime;
      n.titleIndex = s.titleIndex;
      n.muted = s.muted;
      s = screen(n, "title");
    };
    let confirm = pressed("confirm");
    const back = pressed("back"),
      pause = pressed("pause");
    const pointer = api.input.pointer();
    const hit = (x: number, y: number) =>
      menuItems(s).findIndex((_, i) => {
        const r = rect(s, i)!;
        return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
      });
    if (pointer.x !== s.pointerX || pointer.y !== s.pointerY) {
      const i = hit(pointer.x, pointer.y);
      if (i >= 0) s.menuIndex = i;
      s.pointerX = pointer.x;
      s.pointerY = pointer.y;
    }
    for (const sample of api.input.pointerSamples()) {
      if (sample.type === "down")
        s.pointerDown = s.screen === "howto" ? -2 : hit(sample.x, sample.y);
      if (sample.type === "up") {
        const i = hit(sample.x, sample.y);
        if (s.pointerDown === i && i >= 0) {
          s.menuIndex = i;
          confirm = true;
        }
        if (s.screen === "howto" && s.pointerDown === -2) confirm = true;
        s.pointerDown = null;
      }
    }
    if (s.screen === "paused" && (back || pause)) screen(s, "playing");
    else if (s.screen === "howto") {
      if (back || confirm) title();
    } else if (menuItems(s).length) {
      const items = menuItems(s);
      if (pressed("up"))
        s.menuIndex = ((s.menuIndex ?? 0) + items.length - 1) % items.length;
      if (pressed("down"))
        s.menuIndex = ((s.menuIndex ?? 0) + 1) % items.length;
      if (back && s.screen === "gameover") title();
      else if (confirm) {
        const i = s.menuIndex;
        if (s.screen === "title") {
          s.titleIndex = i ?? 0;
          if (i === 0) begin();
          else screen(s, "howto");
        } else if (s.screen === "paused") {
          if (i === 0) screen(s, "playing");
          else if (i === 1) begin();
          else title();
        } else if (i === 0) begin();
        else title();
      }
    } else if (s.screen === "playing" && pause) screen(s, "paused");
    let held = false;
    for (const d of dirs)
      if (api.input.value(d)) {
        held = true;
        if (api.input.pressed(d) || !api.input.value(s.desired)) s.desired = d;
      }
    const cues = new Set<C.CueName>();
    if (s.screen === "playing" && frameScreen === "playing") {
      s.queuedSonar ||= pressed("a");
      s.queuedInk ||= pressed("b");
    }
    s.remainder += dt;
    while (s.remainder + 1e-9 >= C.TICK_DT) {
      s.remainder -= C.TICK_DT;
      tick(s, held, cues);
      for (const cue of cues) api.audio.play(cue);
      cues.clear();
    }
    return reconcile(s);
  },
  render,
};
