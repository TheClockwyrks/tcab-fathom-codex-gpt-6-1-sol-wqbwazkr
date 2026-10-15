import type { RenderApi } from "@clockwyrks/simple-2d";
import * as C from "./constants";
import {
  center,
  tile,
  neighbor,
  dirs,
  distances,
  menuItems,
  rect,
} from "./game";
import type { ReadState, Direction } from "./game";
const cyan = "#8cf6ed",
  dim = "#587782",
  amber = "#ff925c";
export function render(s: ReadState, { ctx: g }: RenderApi) {
  g.imageSmoothingEnabled = false;
  const text = (t: string, x: number, y: number, size = 16, color = cyan) => {
    g.font = `${size}px ui-monospace, SFMono-Regular, Consolas, monospace`;
    g.fillStyle = color;
    g.fillText(t, x, y);
  };
  const line = (
    x: number,
    y: number,
    x2: number,
    y2: number,
    color = "#18313d",
  ) => {
    g.strokeStyle = color;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x2, y2);
    g.stroke();
  };
  const glow = (x: number, y: number, r: number, color: string) => {
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, color);
    grad.addColorStop(1, "transparent");
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  };
  const sprite = (
    name: string,
    frame: number,
    x: number,
    y: number,
    size = 32,
  ) => {
    const im = s.images[name]?.[frame];
    if (im) g.drawImage(im, x - size / 2, y - size / 2, size, size);
  };
  const face = (d: Direction) => ({ down: 0, up: 2, left: 4, right: 6 })[d];
  const animate = Math.floor(s.playTime * 8) % 2;
  const mote = (x: number, y: number) => {
    glow(x, y - 5, 17, "#ff804b65");
    g.fillStyle = amber;
    g.beginPath();
    g.arc(x, y - 5, 3, 0, Math.PI * 2);
    g.fill();
  };
  const terrain = (onlyFlare = false) => {
    for (let y = 0; y < C.GRID_ROWS; y++)
      for (let x = 0; x < C.GRID_COLS; x++) {
        const v = s.visibility[y][x];
        if (v === "u") continue;
        const p = center(x, y);
        if (
          onlyFlare &&
          !s.predators.some(
            (b) =>
              b.flaring && Math.hypot(p.x - b.x, p.y - b.y) <= C.FLARE_RADIUS,
          )
        )
          continue;
        let frame = 16;
        if (tile(s, x, y) === "#") {
          frame = 0;
          dirs.forEach((d, i) => {
            const n = neighbor(s, x, y, d);
            if (tile(s, n.tx, n.ty) === "#") frame += 1 << i;
          });
        } else if (tile(s, x, y) === "g") frame = 18;
        g.globalAlpha = v === "l" ? 1 : 0.27;
        sprite("trench-walls", frame, p.x, p.y);
        if (s.plankton[y][x] === "*") {
          glow(p.x, p.y, 8, "#52e8ca26");
          g.fillStyle = "#a9eee1";
          g.beginPath();
          g.arc(p.x, p.y, C.PLANKTON_DOT / 2, 0, Math.PI * 2);
          g.fill();
        }
        g.globalAlpha = 1;
      }
  };
  const maze = () => {
    g.save();
    g.beginPath();
    g.arc(s.forager.x, s.forager.y, s.windowRadius, 0, Math.PI * 2);
    g.clip();
    terrain();
    glow(s.forager.x, s.forager.y, s.windowRadius, "#1b8a8c18");
    for (const b of s.drifters) {
      mote(b.x, b.y);
      if (b.lit) sprite("drifter", Math.floor(s.playTime * 8) % 8, b.x, b.y);
    }
    for (const p of s.predators)
      if (p.kind === "lanternjaw" && p.state !== "den") mote(p.x, p.y);
    g.restore();
    terrain(true);
    for (const b of s.drifters)
      if (
        b.lit &&
        s.predators.some(
          (p) =>
            p.flaring && Math.hypot(p.x - b.x, p.y - b.y) <= C.FLARE_RADIUS,
        )
      )
        sprite("drifter", Math.floor(s.playTime * 8) % 8, b.x, b.y);
    for (const p of s.pulses) {
      const map = distances(s, p.ox, p.oy, true);
      g.strokeStyle =
        p.tint === "cyan"
          ? "#69f5ec"
          : p.tint === "orange"
            ? "#ffac68"
            : "#bd8cff";
      g.shadowColor = g.strokeStyle;
      g.shadowBlur = 12;
      g.lineWidth = 3;
      for (const [k, d] of map) {
        const strength = 1 - Math.abs(d - p.front) / 1.2;
        if (strength <= 0) continue;
        const [x, y] = k.split(",").map(Number);
        const c = center(x, y);
        g.globalAlpha = strength;
        g.strokeRect(c.x - 11, c.y - 11, 22, 22);
      }
      g.globalAlpha = 1;
      g.shadowBlur = 0;
    }
    for (const p of s.predators) {
      if (p.fade > 0) {
        g.globalAlpha = p.fade / 0.35;
        sprite(
          "flare-bloom",
          p.fade > 0.175 ? 6 : 7,
          p.x,
          p.y,
          C.FLARE_RADIUS * 2,
        );
        g.globalAlpha = 1;
      }
      if (p.flareCharging || p.flaring) {
        const frame = p.flareCharging
          ? Math.min(2, Math.floor(((1.5 - p.phase) / C.FLARE_CHARGE) * 3))
          : 3 + Math.min(2, Math.floor((1 - p.phase) * 3));
        sprite("flare-bloom", frame, p.x, p.y, C.FLARE_RADIUS * 2);
      }
      if (!p.lit) continue;
      const frame =
        p.kind === "lanternjaw" && p.state === "wander"
          ? 8 + (Math.floor(s.playTime * 8) % 8)
          : face(p.dir) + animate;
      sprite(p.kind, frame, p.x, p.y);
      if (p.alert) {
        const r = 18 + (1 - p.alertIn / C.ALERT_TIME) * 35;
        g.strokeStyle = p.kind === "gloamfin" ? "#c4a1ff" : "#ffc49a";
        g.lineWidth = 2;
        g.globalAlpha = p.alertIn / C.ALERT_TIME;
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI) / 4;
          line(
            p.x + Math.cos(a) * 18,
            p.y + Math.sin(a) * 18,
            p.x + Math.cos(a) * r,
            p.y + Math.sin(a) * r,
            g.strokeStyle,
          );
        }
        g.globalAlpha = 1;
      }
    }
    for (const c of s.inkClouds) {
      glow(c.x, c.y, c.radius, "#00040cfa");
      g.fillStyle = "#00040bd9";
      g.beginPath();
      g.arc(c.x, c.y, c.radius * 0.85, 0, Math.PI * 2);
      g.fill();
    }
    glow(s.forager.x, s.forager.y, 40, "#64fff54a");
    sprite(
      "glimmerfin",
      face(s.forager.dir) + (s.forager.moving ? animate : 0),
      s.forager.x,
      s.forager.y,
    );
  };
  const hud = () => {
    text("F A T H O M", 64, 40, 20);
    text(C.DIVE_LABEL, 64, 62, 11, dim);
    text(s.score.toString().padStart(6, "0"), 490, 59, 48, "#d6f8ee");
    text("PLANKTON", 1000, 33, 11, dim);
    text(
      String(s.planktonRemaining).padStart(3, "0") + " REMAIN",
      1000,
      57,
      18,
    );
    line(64, 70, 1216, 70);
    line(64, 664, 1216, 664);
    for (let i = 0; i < s.lives; i++)
      sprite("glimmerfin", 6, 80 + i * 30, 690, 24);
    text(`DEPTH ${s.depth}`, 215, 697, 16);
    const gauge = (x: number, label: string, cool: number, max: number) => {
      text(label, x, 688, 11, dim);
      g.fillStyle = "#16323d";
      g.fillRect(x, 699, 150, 3);
      g.fillStyle = cool === 0 ? cyan : "#358b94";
      g.fillRect(x, 699, 150 * (1 - cool / max), 3);
      text(cool === 0 ? "READY" : cool.toFixed(1) + "s", x + 98, 688, 11);
    };
    gauge(475, "SPACE / SONAR", s.sonar.cooldown, C.SONAR_COOLDOWN);
    gauge(725, "SHIFT / INK", s.ink.cooldown, C.INK_COOLDOWN);
    text("P PAUSE  ·  M SOUND", 1000, 697, 12, dim);
  };
  if (["playing", "countdown", "paused", "cleared"].includes(s.screen)) {
    maze();
    hud();
    if (s.screen === "playing") return;
    if (s.screen === "countdown" || s.screen === "cleared") {
      g.fillStyle = "#02090f99";
      g.fillRect(350, 270, 580, 150);
      text(
        s.screen === "countdown" ? "D I V E" : `DEPTH ${s.depth} CLEARED`,
        460,
        330,
        36,
      );
      text(
        s.screen === "countdown"
          ? String(Math.ceil(s.screenIn))
          : "DESCENDING INTO THE DARK",
        600,
        380,
        22,
      );
      return;
    }
  }
  if (s.screen === "title" || s.screen === "gameover") {
    // A quiet field illustration: contour rings and drifting biological lights.
    for (let i = 0; i < 8; i++) {
      g.strokeStyle = `rgba(57,117,130,${0.13 - i * 0.009})`;
      g.beginPath();
      g.ellipse(920, 355, 100 + i * 40, 120 + i * 39, -0.2, 0, Math.PI * 2);
      g.stroke();
    }
    glow(920, 350, 245, "#12677532");
    for (let i = 0; i < 44; i++) {
      const x = 650 + ((i * 113) % 570),
        y = 100 + ((i * 73) % 500);
      g.fillStyle = i % 5 === 0 ? "#4ca6a4" : "#163c49";
      g.fillRect(x, y, 2, 2);
    }
    glow(910, 350, 100, "#38c8c326");
    sprite("glimmerfin", 6, 910, 350, 150);
    mote(1080, 230);
    sprite("drifter", 2, 1080, 240, 48);
    text("ABYSSAL EXPEDITION / 01", 110, 145, 12, dim);
    text(
      s.screen === "title" ? C.TITLE_TEXT : "DIVE ENDED",
      104,
      255,
      s.screen === "title" ? 90 : 58,
      "#d7f9ef",
    );
    text(
      s.screen === "title"
        ? C.TAGLINE_TEXT
        : `SCORE ${s.score}   /   DEPTH ${s.depth}`,
      110,
      304,
      18,
      "#61c6c2",
    );
    line(110, 345, 470, 345);
    text("A small light. A very deep dark.", 110, 370, 12, dim);
    text("K I N D L E", 110, 635, 12, dim);
    text("MOVE  ↑ ↓ ← →     SONAR  SPACE     INK  SHIFT", 110, 670, 12, dim);
    text("36° N / 4,800 M BELOW", 925, 635, 11, dim);
  } else if (s.screen === "howto") {
    text("FIELD GUIDE", 110, 120, 14, dim);
    text("READ THE DARK", 110, 190, 48, "#d7f9ef");
    const rows = [
      [
        "01 / SWIM",
        "Arrow keys or WASD. Graze every glowing plankton to descend.",
      ],
      [
        "02 / LISTEN",
        "Space sends sonar around corners. It reveals paths — and tells on you.",
      ],
      [
        "03 / DISAPPEAR",
        "Shift releases ink. Light hunters lose you; sound hunters do not.",
      ],
      [
        "04 / KNOW YOUR HUNTERS",
        "Lanternjaw follows your glow, disguised as an amber drifter.",
      ],
      ["", "Gloamfin hears you through stone. Turn corners to lose its speed."],
      ["", "Flarefish burns the dark away. Get clear before its bloom."],
      [
        "05 / KEEP YOUR BEARINGS",
        "Your light reveals stone. Your outer circle holds remembered paths.",
      ],
      [
        "",
        "Eat to grow brighter — and easier to find. P / Esc pauses. M mutes.",
      ],
    ];
    rows.forEach(([a, b], i) => {
      text(a, 110, 255 + i * 43, 12, "#6ad6cd");
      text(b, 365, 255 + i * 43, 14, "#b1c8cc");
    });
    text("ENTER / ESC / CLICK ANYWHERE TO RETURN", 110, 660, 13, dim);
    return;
  } else if (s.screen === "paused") {
    g.fillStyle = "#02090fe6";
    g.fillRect(64, 80, 560, 576);
    text("HOLDING POSITION", 110, 205, 12, dim);
    text("PAUSED", 110, 285, 56, "#d7f9ef");
  }
  menuItems(s).forEach((item, i) => {
    const r = rect(s, i)!;
    if (s.menuIndex === i) {
      g.fillStyle = "#123039";
      g.fillRect(r.x, r.y, r.w, r.h);
      g.fillStyle = cyan;
      g.fillRect(r.x, r.y, 3, r.h);
    }
    text(
      s.menuIndex === i ? "›  " + item : "   " + item,
      r.x + 18,
      r.y + 31,
      18,
      s.menuIndex === i ? "#d7fff1" : dim,
    );
  });
}
