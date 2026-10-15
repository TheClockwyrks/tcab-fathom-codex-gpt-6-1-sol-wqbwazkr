import * as C from "./constants";
import {
  clone,
  fresh,
  reconcile,
  screen,
  roster,
  rect,
  menuItems,
  put,
  center,
  body,
  predator,
  tile,
  dirs,
} from "./game";
import type { ReadState, Screen, Direction, FathomState } from "./game";
function assert(ok: boolean) {
  if (!ok) throw new RangeError("Invalid Fathom pose");
}
function number(n: number, min = 0, max = Infinity, integer = false) {
  assert(
    Number.isFinite(n) &&
      n >= min &&
      n <= max &&
      (!integer || Number.isInteger(n)),
  );
}
function pos(s: ReadState, x: number, y: number, allowed: string) {
  number(x, 0, C.GRID_COLS - 1, true);
  number(y, 0, C.GRID_ROWS - 1, true);
  assert(allowed.includes(tile(s, x, y)));
}
function pose(s: ReadState, fn: (n: FathomState) => void) {
  const n = clone(s);
  fn(n);
  return reconcile(n);
}
function indexed<T>(a: T[], i: number) {
  number(i, 0, a.length - 1, true);
  return a[i];
}
export const debug = {
  version: C.FATHOM_DEBUG_VERSION,
  reset: (s: ReadState) => ({
    ...fresh(s.images as Record<string, ImageBitmap[]>),
    muted: s.muted,
  }),
  snapshot: (s: ReadState) => {
    const {
      images: _images,
      remainder: _r,
      queuedSonar: _qs,
      queuedInk: _qi,
      screenIn: _si,
      playTime: _pt,
      desired: _d,
      seed: _seed,
      marks: _m,
      pointerDown: _pd,
      pointerX: _px,
      pointerY: _py,
      ...world
    } = clone(s);
    return JSON.parse(
      JSON.stringify({
        ...world,
        forager: {
          x: s.forager.x,
          y: s.forager.y,
          tx: s.forager.tx,
          ty: s.forager.ty,
          dir: s.forager.dir,
          moving: s.forager.moving,
        },
        drifters: s.drifters.map((b) => ({
          x: b.x,
          y: b.y,
          tx: b.tx,
          ty: b.ty,
          lit: b.lit,
          mind: b.mind,
          travel: b.travel,
        })),
        predators: s.predators.map((p) => ({
          kind: p.kind,
          x: p.x,
          y: p.y,
          tx: p.tx,
          ty: p.ty,
          dir: p.dir,
          state: p.state,
          released: p.released,
          mind: p.mind,
          travel: p.travel,
          speed: p.speed,
          alert: p.alert,
          lit: p.lit,
          detectRange: p.detectRange,
          hearingRange: p.hearingRange,
          hearingLock: p.hearingLock,
          flareCharging: p.flareCharging,
          flaring: p.flaring,
          flareRadius: p.flareRadius,
        })),
        pulses: s.pulses.map((p) => ({
          source: p.source,
          tint: p.tint,
          ox: p.ox,
          oy: p.oy,
          front: p.front,
          range: p.range,
        })),
      }),
    ) as Omit<FathomState, "images">;
  },
  reconcile: (s: ReadState) => reconcile(clone(s)),
  setScreen: (s: ReadState, v: Screen) => {
    assert(
      [
        "title",
        "howto",
        "countdown",
        "playing",
        "paused",
        "cleared",
        "gameover",
      ].includes(v),
    );
    return screen(clone(s), v);
  },
  setMenuIndex: (s: ReadState, i: number) => {
    number(i, 0, menuItems(s).length - 1, true);
    return pose(s, (n) => {
      n.menuIndex = i;
    });
  },
  setTitleIndex: (s: ReadState, i: number) => {
    number(i, 0, C.TITLE_ITEMS.length - 1, true);
    return pose(s, (n) => {
      n.titleIndex = i;
    });
  },
  menuItemRect: rect,
  setScore: (s: ReadState, v: number) => {
    number(v, 0, Infinity, true);
    return pose(s, (n) => {
      n.score = v;
    });
  },
  setLives: (s: ReadState, v: number) => {
    number(v, 0, Infinity, true);
    return pose(s, (n) => {
      n.lives = v;
    });
  },
  setDepth: (s: ReadState, v: number) => {
    number(v, 1, Infinity, true);
    return pose(s, (n) => {
      n.depth = v;
      roster(n);
    });
  },
  setMaze: (s: ReadState, rows: string[]) => {
    assert(
      rows.length === C.GRID_ROWS &&
        rows.every((r) => r.length === C.GRID_COLS && /^[#.dg]+$/.test(r)),
    );
    const all = rows.join("");
    assert(!/[dg]/.test(all) || all.split("g").length === 2);
    return pose(s, (n) => {
      n.tiles = [...rows];
    });
  },
  setPlankton: (s: ReadState, x: number, y: number, present: boolean) => {
    pos(s, x, y, ".");
    return pose(s, (n) => put(n.plankton, x, y, present ? "*" : "-"));
  },
  clearPlankton: (s: ReadState) =>
    pose(s, (n) => {
      n.plankton = n.plankton.map((r) => r.replace(/\*/g, "-"));
    }),
  clearFog: (s: ReadState) =>
    pose(s, (n) => {
      n.visibility = n.visibility.map((r) => "u".repeat(r.length));
      n.marks.fill(0);
    }),
  setForagerTile: (s: ReadState, x: number, y: number) => {
    pos(s, x, y, ".");
    return pose(s, (n) => {
      Object.assign(n.forager, center(x, y), { moving: false });
    });
  },
  setForagerDir: (s: ReadState, d: Direction) => {
    assert(dirs.includes(d));
    return pose(s, (n) => {
      n.forager.dir = d;
      n.desired = d;
      n.forager.moving = false;
    });
  },
  setBrightness: (s: ReadState, v: number) => {
    number(v, 0, 1);
    return pose(s, (n) => {
      n.brightness = v;
    });
  },
  setBrightHold: (s: ReadState, v: number) => {
    number(v, 0, C.BRIGHT_HOLD);
    return pose(s, (n) => {
      n.brightHold = v;
    });
  },
  clearPredators: (s: ReadState) =>
    pose(s, (n) => {
      n.predators = [];
    }),
  addPredator: (s: ReadState, k: C.PredatorKind, x: number, y: number) => {
    assert(C.DEN_ORDER.includes(k));
    pos(s, x, y, ".");
    return pose(s, (n) => {
      n.predators.push(predator(k, x, y));
    });
  },
  setPredatorTile: (s: ReadState, i: number, x: number, y: number) => {
    pos(s, x, y, ".dg");
    return pose(s, (n) => Object.assign(indexed(n.predators, i), center(x, y)));
  },
  setPredatorDir: (s: ReadState, i: number, d: Direction) => {
    assert(dirs.includes(d));
    return pose(s, (n) => {
      indexed(n.predators, i).dir = d;
    });
  },
  setPredatorState: (s: ReadState, i: number, v: "den" | "wander" | "chase") =>
    pose(s, (n) => {
      assert(["den", "wander", "chase"].includes(v));
      const p = indexed(n.predators, i);
      pos(s, p.tx, p.ty, v === "den" ? "dg" : ".");
      p.state = v;
      p.fix = v === "chase" ? { tx: s.forager.tx, ty: s.forager.ty } : null;
      p.linger = v === "chase" ? C.LINGER_TIME : 0;
      p.chaseSpeed = C.GLOAMFIN_CHASE_SPEED;
    }),
  setPredatorReleased: (s: ReadState, i: number, v: boolean) =>
    pose(s, (n) => {
      indexed(n.predators, i).released = v;
    }),
  setPredatorMind: (s: ReadState, i: number, v: boolean) =>
    pose(s, (n) => {
      indexed(n.predators, i).mind = v;
    }),
  setPredatorTravel: (s: ReadState, i: number, v: boolean) =>
    pose(s, (n) => {
      indexed(n.predators, i).travel = v;
    }),
  spawnDrifter: (s: ReadState, x: number, y: number) => {
    pos(s, x, y, ".");
    return pose(s, (n) => {
      n.drifters.push(body(x, y));
    });
  },
  clearDrifters: (s: ReadState) =>
    pose(s, (n) => {
      n.drifters = [];
    }),
  setDrifterMind: (s: ReadState, i: number, v: boolean) =>
    pose(s, (n) => {
      indexed(n.drifters, i).mind = v;
    }),
  setDrifterTravel: (s: ReadState, i: number, v: boolean) =>
    pose(s, (n) => {
      indexed(n.drifters, i).travel = v;
    }),
  setDrifterIn: (s: ReadState, v: number) => {
    number(v, 0, C.DRIFTER_INTERVAL);
    return pose(s, (n) => {
      n.drifterIn = v;
    });
  },
  setSonarCooldown: (s: ReadState, v: number) => {
    number(v);
    return pose(s, (n) => {
      n.sonar.cooldown = v;
    });
  },
  setInkCooldown: (s: ReadState, v: number) => {
    number(v);
    return pose(s, (n) => {
      n.ink.cooldown = v;
    });
  },
};
