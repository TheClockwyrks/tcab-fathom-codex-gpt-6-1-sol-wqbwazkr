import { describe, it, expect } from "vitest";
import { createEngine, ConstantClock } from "@clockwyrks/simple-2d";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { fresh, game, distances, neighbor, dirs, tile, los } from "./game";
import { debug } from "./surface";
import * as C from "./constants";
const targets = new WeakMap<object, EventTarget>();
function key(engine: object, code: string, down = true) {
  const event = new Event(down ? "keydown" : "keyup");
  Object.assign(event, { code, repeat: false });
  targets.get(engine)!.dispatchEvent(event);
}
async function harness(ms = 1000 / 60) {
  const canvas = createCanvas(1280, 720);
  const events = new EventTarget();
  const engine = createEngine({
    canvas: canvas as unknown as HTMLCanvasElement,
    width: 1280,
    height: 720,
    clock: new ConstantClock(ms),
    game: {
      ...game,
      async initialize(api) {
        return game.initialize({
          ...api,
          assets: {
            ...api.assets,
            loadImage: async (path) =>
              (await loadImage("assets/" + path)) as unknown as ImageBitmap,
          },
        });
      },
    },
    surface: {
      cssWidth: () => 1280,
      cssHeight: () => 720,
      dpr: () => 1,
      events: () => events,
    },
  });
  targets.set(engine, events);
  await engine.initialize();
  return engine;
}
describe("Fathom simulation", () => {
  it("lays out one connected, symmetric maze with narrow looping corridors", () => {
    const s = fresh();
    const cells = s.tiles.flatMap((r, y) =>
      [...r].flatMap((t, x) => (t === "." ? [{ tx: x, ty: y }] : [])),
    );
    expect(distances(s, 17, 13).size).toBe(cells.length);
    expect(cells.length / 544).toBeGreaterThanOrEqual(C.MAZE_DENSITY_MIN);
    const degrees = cells.map(
      (c) =>
        dirs.filter((d) => {
          const n = neighbor(s, c.tx, c.ty, d);
          return tile(s, n.tx, n.ty) === ".";
        }).length,
    );
    expect(Math.min(...degrees)).toBeGreaterThanOrEqual(2);
    expect(
      degrees.reduce((a, b) => a + b, 0) / cells.length,
    ).toBeLessThanOrEqual(C.MAZE_OPENNESS_MAX);
    for (let y = 0; y < 18; y++)
      for (let x = 0; x < 35; x++) {
        expect(
          [
            tile(s, x, y),
            tile(s, x + 1, y),
            tile(s, x, y + 1),
            tile(s, x + 1, y + 1),
          ].join(""),
        ).not.toBe("....");
        if (!"dg".includes(tile(s, x, y)) && !"dg".includes(tile(s, 35 - x, y)))
          expect(tile(s, x, y)).toBe(tile(s, 35 - x, y));
      }
  });
  it("advances the same ticks at different frame rates", async () => {
    const a = await harness(),
      b = await harness(1000 / 120);
    await a.advance(60);
    await b.advance(120);
    expect(a.state.simTime).toBeCloseTo(1, 10);
    expect(a.state.simTime).toBe(b.state.simTime);
    a.destroy();
    b.destroy();
  });
  it("eats only in play, preserves prior states and freezes when paused", async () => {
    const e = await harness();
    const before = e.state;
    e.apply((s) => debug.clearPredators(s));
    e.apply((s) => debug.setScreen(s, "playing"));
    await e.advance(1);
    expect(e.state.score).toBe(C.SCORE_PLANKTON);
    expect(before.score).toBe(0);
    e.apply((s) => debug.setScreen(s, "paused"));
    const hold = e.state.brightHold;
    await e.advance(120);
    expect(e.state.brightHold).toBe(hold);
    e.destroy();
  });
  it("reconciles without revealing and rejects invalid poses", () => {
    let s = fresh();
    s = debug.setBrightness(s, 1);
    s = debug.clearFog(s);
    expect(s.windowRadius).toBe(320);
    expect(s.visibility.join("")).not.toContain("l");
    expect(debug.reconcile(s)).toEqual(s);
    expect(() => debug.setBrightness(s, 2)).toThrow();
    expect(() => debug.setMenuIndex(s, 4)).toThrow();
    expect(() => debug.setMaze(s, ["."])).toThrow();
    expect(() => debug.setForagerTile(s, 0, 0)).toThrow();
  });
  it("costs reserve lives and ends the fourth attempt", async () => {
    const e = await harness();
    e.apply((s) => debug.clearPredators(s));
    e.apply((s) => debug.addPredator(s, "lanternjaw", 17, 13));
    e.apply((s) => debug.setPredatorMind(s, 0, false));
    e.apply((s) => debug.setScreen(s, "playing"));
    await e.advance(1);
    expect(e.state.lives).toBe(2);
    expect(e.state.screen).toBe("countdown");
    expect(e.state.score).toBe(C.SCORE_PLANKTON);
    e.apply((s) => debug.clearPredators(s));
    e.apply((s) => debug.addPredator(s, "lanternjaw", 17, 13));
    e.apply((s) => debug.setLives(s, 0));
    e.apply((s) => debug.setScreen(s, "playing"));
    await e.advance(1);
    expect(e.state.screen).toBe("gameover");
    e.destroy();
  });
  it("clears only when the last plankton is eaten and descends", async () => {
    const e = await harness();
    e.apply((s) => debug.clearPredators(s));
    e.apply((s) => debug.clearPlankton(s));
    e.apply((s) => debug.setScreen(s, "playing"));
    await e.advance(1);
    expect(e.state.screen).toBe("playing");
    e.apply((s) => debug.setPlankton(s, 17, 13, true));
    await e.advance(1);
    expect(e.state.screen).toBe("cleared");
    expect(e.state.score).toBe(C.SCORE_PLANKTON + C.SCORE_CLEAR);
    await e.advance(120);
    expect(e.state.depth).toBe(2);
    expect(e.state.predators.length).toBe(4);
    e.destroy();
  });
  it("light respects intervening rock", () => {
    const s = fresh();
    expect(los(s, { x: 112, y: 128 }, { x: 112, y: 128 })).toBe(true);
  });
});

describe("Player input and sensing", () => {
  it("swims continuously, reverses mid-tile and stops on release", async () => {
    const e = await harness();
    e.apply((s) => debug.clearPredators(s));
    e.apply((s) => debug.setScreen(s, "playing"));
    const x = e.state.forager.x;
    key(e, "ArrowRight");
    await e.advance(6);
    expect(e.state.forager.x).toBeCloseTo(x + 12.8);
    key(e, "ArrowRight", false);
    key(e, "ArrowLeft");
    await e.advance(6);
    expect(e.state.forager.x).toBeCloseTo(x);
    key(e, "ArrowLeft", false);
    await e.advance(20);
    expect(e.state.forager.x).toBeCloseTo(x);
    expect(e.state.forager.moving).toBe(false);
    e.destroy();
  });
  it("casts traveling sonar, arms ink, and freezes their clocks when paused", async () => {
    const e = await harness();
    e.apply((s) => debug.clearPredators(s));
    e.apply((s) => debug.setScreen(s, "playing"));
    key(e, "Space");
    key(e, "ShiftLeft");
    await e.advance(6);
    expect(e.state.pulses[0].front).toBeCloseTo(
      C.SONAR_WAVE_SPEED * 0.1 - 0.001,
    );
    expect(e.state.inkClouds).toHaveLength(1);
    key(e, "Escape");
    await e.advance(1);
    expect(e.state.screen).toBe("paused");
    const front = e.state.pulses[0].front;
    await e.advance(60);
    expect(e.state.pulses[0].front).toBe(front);
    key(e, "Escape", false);
    key(e, "Escape");
    await e.advance(1);
    expect(e.state.screen).toBe("playing");
    e.destroy();
  });
  it("uses light for Lanternjaw, sound for Gloamfin, and ink only blinds light hunters", async () => {
    const e = await harness();
    e.apply((s) => debug.clearPredators(s));
    e.apply((s) => debug.setForagerTile(s, 9, 13));
    e.apply((s) => debug.addPredator(s, "lanternjaw", 13, 13));
    e.apply((s) => debug.addPredator(s, "gloamfin", 9, 12));
    e.apply((s) => debug.setPredatorTravel(s, 0, false));
    e.apply((s) => debug.setPredatorTravel(s, 1, false));
    e.apply((s) => debug.setScreen(s, "playing"));
    await e.advance(1);
    expect(e.state.predators[0].state).toBe("chase");
    expect(e.state.predators[1].hearingLock).toBe(true);
    key(e, "ShiftLeft");
    await e.advance(1);
    expect(e.state.predators[0].state).toBe("wander");
    expect(e.state.predators[1].state).toBe("chase");
    e.destroy();
  });
  it("remembers terrain across a catch and resets it on a new dive", async () => {
    const e = await harness();
    e.apply((s) => debug.clearPredators(s));
    e.apply((s) => debug.setScreen(s, "playing"));
    await e.advance(1);
    expect(e.state.visibility.join("")).toContain("l");
    e.apply((s) => debug.addPredator(s, "lanternjaw", 17, 13));
    e.apply((s) => debug.setPredatorMind(s, 0, false));
    await e.advance(1);
    expect(e.state.visibility.join("")).toContain("l");
    e.apply((s) => debug.reset(s));
    expect(e.state.visibility.join("")).toBe("u".repeat(648));
    expect(e.state.simTime).toBe(0);
    e.destroy();
  });
});

describe("Predator timing and fixtures", () => {
  it("releases the roster on staggered live time, with no travel while held", async () => {
    const e = await harness();
    e.apply((s) => debug.clearPlankton(s));
    for (let i = 0; i < 3; i++)
      e.apply((s) => debug.setPredatorTravel(s, i, false));
    e.apply((s) => debug.setScreen(s, "playing"));
    await e.advance(1);
    expect(e.state.predators.map((p) => p.released)).toEqual([
      true,
      false,
      false,
    ]);
    await e.advance(300);
    expect(e.state.predators.map((p) => p.released)).toEqual([
      true,
      true,
      false,
    ]);
    expect(e.state.predators.every((p) => p.state === "den")).toBe(true);
    e.destroy();
  });
  it("charges, blooms and remembers rock through a flare", async () => {
    const e = await harness();
    e.apply((s) => debug.clearPredators(s));
    e.apply((s) => debug.clearPlankton(s));
    e.apply((s) => debug.addPredator(s, "flarefish", 1, 1));
    e.apply((s) => debug.setPredatorTravel(s, 0, false));
    e.apply((s) => debug.setScreen(s, "playing"));
    await e.advance(425);
    expect(e.state.predators[0].flareCharging).toBe(true);
    await e.advance(30);
    expect(e.state.predators[0].flaring).toBe(true);
    expect(e.state.visibility[1][1]).toBe("l");
    await e.advance(60);
    expect(e.state.predators[0].flaring).toBe(false);
    expect(e.state.visibility[1][1]).toBe("r");
    e.destroy();
  });
  it("holds den predators out of play on a fixture with no den", async () => {
    const e = await harness();
    const rows = Array.from({ length: 18 }, () => ".".repeat(36));
    e.apply((s) => debug.setMaze(s, rows));
    e.apply((s) => debug.clearPlankton(s));
    e.apply((s) => debug.setDrifterIn(s, 0));
    e.apply((s) => debug.setScreen(s, "playing"));
    const x = e.state.predators[0].x;
    await e.advance(60);
    expect(e.state.predators[0].x).toBe(x);
    expect(e.state.predators[0].lit).toBe(false);
    expect(e.state.drifters).toHaveLength(0);
    e.destroy();
  });
  it("crosses the wrap tunnel continuously in one ordinary tile step", async () => {
    const e = await harness();
    e.apply((s) => debug.clearPredators(s));
    e.apply((s) => debug.setForagerTile(s, 0, 13));
    e.apply((s) => debug.setForagerDir(s, "left"));
    e.apply((s) => debug.setScreen(s, "playing"));
    key(e, "ArrowLeft");
    await e.advance(15);
    expect(e.state.forager.tx).toBe(35);
    expect(e.state.forager.x).toBeCloseTo(C.GRID_ORIGIN_X + 35.5 * C.TILE);
    e.destroy();
  });
  it("preserves the den clock across a pause and resumes once per Escape", async () => {
    const e = await harness();
    e.apply((s) => debug.clearPlankton(s));
    e.apply((s) => debug.setScreen(s, "playing"));
    await e.advance(100);
    const t = e.state.playTime;
    key(e, "Escape");
    await e.advance(1);
    await e.advance(50);
    expect(e.state.playTime).toBe(t);
    key(e, "Escape", false);
    key(e, "Escape");
    await e.advance(1);
    expect(e.state.screen).toBe("playing");
    expect(e.state.playTime).toBeGreaterThan(t);
    e.destroy();
  });
});
