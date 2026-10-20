/**
 * Procedural, canvas-drawn night-sea scene for the intro.
 *
 * Story (seconds): a moonlit sea under drifting cloud, a tall ship sails in from the left and rides the swell, the
 * camera slowly approaches a lighthouse whose rotating beam sweeps the water, the ship and the fog. On the last
 * sweep the beam points straight at the viewer: the lamp blooms and swallows the whole screen (T_FLASH .. T_WHITE).
 * Everything is a pure function of time, so the intro can be skipped forward without any state to repair.
 */

export const T_FLASH = 5.9; // the beam points at the viewer
export const T_WHITE = T_FLASH + 0.8; // the screen is completely filled with light
export const TITLE_AT = 1.9;
export const FLASH_UI_AT = T_FLASH - 0.9;

const TAU = Math.PI * 2;
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeIn = (t: number) => t * t * t;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const mix = (a: number[], b: number[], t: number) => a.map((v, i) => Math.round(lerp(v, b[i], t)));
const rgb = (c: number[], a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Lighthouse beam model (see Scene.beams). */
const BEAM = {
  period: 4.4, // seconds per full turn of the lens; two opposite beams -> a flash every half turn
  focal: 2.4, // focal length, in canvas widths (long lens: little perspective distortion)
  tilt: 0.55, // beam drop per lamp distance, in lamp heights
  eye: 0.1, // camera eye height above the sea, in lamp heights
  reach: 2.6, // longest beam, in lamp distances
  r0: 0.02, // lens radius, in lamp heights
  tan: 0.035, // cone half-angle (tangent)
  g: 0.55, // forward-scattering asymmetry of the haze
  ext: 1.5, // atmospheric extinction length
  spread: 1.6, // surface brightness loss as the cone widens
  gain: 0.9, // overall beam brightness
  pool: 0.5, // brightness of the pool of light on the sea
};

const LAYERS = 8;
const SHIP_LAYER = 3; // the ship is drawn right before this wave layer, so the layer's crest hides the waterline

/** Ship geometry in its own units (about 345 long, bow to the right, waterline at y = 0 after the offset below). */
const HULL = new Path2D('M-168 -44 L176 -44 C170 -12 130 18 60 24 L-96 24 C-140 18 -166 -6 -168 -44 Z');
const STERN = new Path2D('M-168 -44 L-168 -84 L-104 -84 L-100 -44 Z');
const BOW = new Path2D('M120 -44 L124 -64 L176 -58 L176 -44 Z');
const SAILS: Array<{ p: Path2D; cx: number; top: number }> = [
  ['M-20 -300 L40 -300 Q44 -279 38 -258 Q10 -250 -18 -258 Q-24 -279 -20 -300 Z', 10, -300],
  ['M-36 -246 L56 -246 Q62 -212 54 -178 Q10 -168 -32 -178 Q-42 -212 -36 -246 Z', 10, -246],
  ['M-50 -166 L70 -166 Q78 -122 68 -78 Q10 -66 -48 -78 Q-60 -122 -50 -166 Z', 10, -166],
  ['M76 -250 L116 -250 Q119 -230 114 -210 Q96 -204 78 -210 Q73 -230 76 -250 Z', 96, -250],
  ['M68 -196 L124 -196 Q130 -165 122 -134 Q96 -126 70 -134 Q62 -165 68 -196 Z', 96, -196],
  ['M62 -124 L130 -124 Q136 -94 128 -66 Q96 -58 64 -66 Q56 -94 62 -124 Z', 96, -124],
  ['M-88 -212 L-36 -212 Q-31 -182 -38 -152 Q-62 -144 -86 -152 Q-93 -182 -88 -212 Z', -62, -212],
  ['M-66 -146 L-66 -90 L-146 -88 Q-112 -118 -66 -146 Z', -66, -146],
  ['M98 -252 L246 -98 L100 -92 Z', 98, -252],
  ['M100 -176 L218 -86 L102 -82 Z', 100, -176],
].map(([d, cx, top]) => ({ p: new Path2D(d as string), cx: cx as number, top: top as number }));

interface Star { x: number; y: number; r: number; ph: number; sp: number }
interface Puff { x: number; y: number; r: number; v: number; a: number }
interface Bird { y: number; s: number; t0: number; ph: number }
interface Glint { u: number; g: number; ph: number; sp: number; a: number }
interface Foam { x: number; layer: number; ph: number; r: number; v: number }

interface Geom {
  p: number;
  cx: number;
  baseY: number;
  h: number;
  lampX: number;
  lampY: number;
}

export class Scene {
  private ctx: CanvasRenderingContext2D;
  private W = 0;
  private H = 0;
  private yH = 0;
  private S = 1; // size unit for the ship (width driven on narrow screens)
  private Sv = 1; // size unit for the sea (height driven)
  private stars: Star[] = [];
  private fog: Puff[] = [];
  private birds: Bird[] = [];
  private glints: Glint[] = [];
  private foam: Foam[] = [];
  private rock: number[] = [];
  private tileFar: HTMLCanvasElement | null = null;
  private tileNear: HTMLCanvasElement | null = null;
  private tileW = 0;
  private lit = 0;
  private phase = LAYER_PHASES();

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas is not supported.');
    this.ctx = ctx;
  }

  resize(w: number, h: number, dpr: number) {
    this.W = w;
    this.H = h;
    this.yH = h * 0.56;
    this.Sv = h / 900;
    this.S = Math.min(w * 0.0017, h / 900);
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const rnd = mulberry32(7);
    this.stars = Array.from({ length: 170 }, () => ({
      x: rnd() * w,
      y: Math.pow(rnd(), 1.35) * this.yH * 0.92,
      r: (0.4 + rnd() * 1.1) * Math.max(0.8, this.Sv),
      ph: rnd() * TAU,
      sp: 0.6 + rnd() * 2.2,
    }));
    this.fog = Array.from({ length: 14 }, () => ({
      x: rnd() * w * 1.6,
      y: this.yH + (rnd() - 0.55) * h * 0.05,
      r: (90 + rnd() * 220) * this.Sv,
      v: 6 + rnd() * 14,
      a: 0.05 + rnd() * 0.08,
    }));
    this.birds = [
      { y: 0.3, s: 1.0, t0: 0.8, ph: 0 },
      { y: 0.36, s: 0.75, t0: 1.25, ph: 1.7 },
      { y: 0.26, s: 0.6, t0: 1.9, ph: 3.1 },
    ];
    this.glints = Array.from({ length: 170 }, () => ({ u: Math.pow(rnd(), 1.6), g: (rnd() + rnd() + rnd() - 1.5) / 1.5, ph: rnd() * TAU, sp: 1.5 + rnd() * 3, a: 0.25 + rnd() * 0.6 }));
    this.foam = Array.from({ length: 90 }, () => ({ x: rnd() * w, layer: 3 + Math.floor(rnd() * (LAYERS - 3)), ph: rnd() * TAU, r: 0.8 + rnd() * 1.8, v: 8 + rnd() * 22 }));
    this.rock = Array.from({ length: 22 }, () => rnd());
    this.buildClouds(rnd);
  }

  /** Cloud banks are painted once into two wide tiles that scroll sideways at different speeds. */
  private buildClouds(rnd: () => number) {
    const make = (count: number, ymin: number, ymax: number, size: number, color: number[], alpha: number) => {
      const tw = Math.round(this.W * 2.2);
      const th = Math.round(this.yH);
      const c = document.createElement('canvas');
      const k = 0.5;
      c.width = Math.round(tw * k);
      c.height = Math.round(th * k);
      const g = c.getContext('2d')!;
      g.scale(k, k);
      for (let i = 0; i < count; i++) {
        const x = rnd() * tw;
        const y = (ymin + rnd() * (ymax - ymin)) * th;
        const r = (size * (0.5 + rnd())) * this.Sv;
        for (const ox of [-tw, 0, tw]) {
          g.save();
          g.translate(x + ox, y);
          g.scale(2.6, 0.55);
          const gr = g.createRadialGradient(0, 0, 0, 0, 0, r);
          gr.addColorStop(0, rgb(color, alpha * (0.6 + rnd() * 0.4)));
          gr.addColorStop(1, rgb(color, 0));
          g.fillStyle = gr;
          g.beginPath();
          g.arc(0, 0, r, 0, TAU);
          g.fill();
          g.restore();
        }
      }
      this.tileW = tw;
      return c;
    };
    this.tileFar = make(34, 0.08, 0.78, 150, [92, 116, 158], 0.2);
    this.tileNear = make(22, 0.3, 0.9, 190, [10, 16, 34], 0.5);
  }

  /** Where the lamp is on screen at time t (the point the light grows from). */
  lamp(t: number) {
    const g = this.geom(t);
    return { x: g.lampX, y: g.lampY };
  }

  private geom(t: number): Geom {
    const { W, H, yH } = this;
    const p = clamp(t / T_FLASH);
    const e = easeInOut(p) * 0.35 + p * 0.65;
    const hmax = Math.min(0.4 * H, 0.85 * W);
    const h = lerp(hmax * 0.38, hmax, e);
    const cx = lerp(W * 0.8, W * 0.66, e);
    const baseY = yH + lerp(0.004 * H, 0.075 * H, e);
    const y1 = baseY - h * 0.05 - h;
    return { p, cx, baseY, h, lampX: cx, lampY: y1 - h * 0.075 };
  }

  private waveY(i: number, x: number, t: number): number {
    const f = i / (LAYERS - 1);
    const base = this.yH + (this.H - this.yH) * Math.pow(f, 1.6) * 0.95 + this.H * 0.004;
    const amp = (2 + 34 * Math.pow(f, 1.4)) * this.Sv;
    const k = lerp(0.011, 0.0034, f) / Math.max(0.55, this.Sv);
    const sp = lerp(0.45, 1.05, f);
    const ph = this.phase[i];
    return base + amp * (0.6 * Math.sin(x * k + t * sp + ph[0]) + 0.3 * Math.sin(x * k * 2.3 - t * sp * 1.3 + ph[1]) + 0.45 * Math.sin(x * k * 0.45 + t * 0.4 + ph[2]));
  }

  draw(t: number) {
    const { ctx, W, H } = this;
    if (t >= T_WHITE) {
      this.paintWhite();
      return;
    }
    const g = this.geom(t);
    this.updateBeams(g, t);

    // Camera: slow handheld sway, a gentle push-in, then a rush toward the lamp during the final bloom.
    const rush = easeIn(clamp((t - (T_FLASH - 1.3)) / 2.0));
    const zoom = 1.035 + 0.05 * clamp(t / T_FLASH) + 0.9 * rush;
    ctx.save();
    ctx.translate(g.lampX, g.lampY);
    ctx.scale(zoom, zoom);
    ctx.translate(-g.lampX + Math.sin(t * 0.8) * 2.5 * this.Sv, -g.lampY + Math.sin(t * 1.15 + 1) * 3 * this.Sv);

    this.sky(t);
    this.sea(g, t);
    this.beams(g, t);
    this.glitter(t);
    this.nearFog(t);
    ctx.restore();

    // Vignette and fade in from black.
    const v = ctx.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * 0.35, W / 2, H * 0.55, Math.hypot(W, H) * 0.62);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,3,10,0.62)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
    const fade = 1 - smooth(0, 1.1, t);
    if (fade > 0) {
      ctx.fillStyle = `rgba(0,0,0,${fade})`;
      ctx.fillRect(0, 0, W, H);
    }

    this.bloom(g, t);
  }

  /* ---------------------------------------------------------------- sky */

  private sky(t: number) {
    const { ctx, W, H, yH } = this;
    const sky = ctx.createLinearGradient(0, 0, 0, yH);
    sky.addColorStop(0, '#01040c');
    sky.addColorStop(0.45, '#061226');
    sky.addColorStop(0.8, '#0f2a4f');
    sky.addColorStop(1, '#2a4c75');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, yH + 2);

    for (const s of this.stars) {
      const tw = 0.55 + 0.45 * Math.sin(t * s.sp + s.ph);
      const a = tw * (1 - (s.y / yH) * 0.85);
      ctx.fillStyle = `rgba(225,236,255,${a.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, TAU);
      ctx.fill();
    }

    // Moon
    const mx = W * 0.2;
    const my = yH * 0.3;
    const mr = Math.min(W, H) * 0.052;
    let gr = ctx.createRadialGradient(mx, my, mr * 0.6, mx, my, mr * 9);
    gr.addColorStop(0, 'rgba(190,212,255,0.34)');
    gr.addColorStop(0.25, 'rgba(120,150,210,0.12)');
    gr.addColorStop(1, 'rgba(120,150,210,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(mx - mr * 9, my - mr * 9, mr * 18, mr * 18);
    gr = ctx.createRadialGradient(mx - mr * 0.3, my - mr * 0.3, mr * 0.1, mx, my, mr);
    gr.addColorStop(0, '#fffdf0');
    gr.addColorStop(1, '#dcd8bd');
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.arc(mx, my, mr, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(120,118,104,0.2)';
    for (const [dx, dy, r] of [[-0.3, -0.1, 0.28], [0.25, 0.22, 0.2], [0.1, -0.38, 0.15], [-0.15, 0.4, 0.12]]) {
      ctx.beginPath();
      ctx.arc(mx + dx * mr, my + dy * mr, r * mr, 0, TAU);
      ctx.fill();
    }

    // Clouds drift across the moon.
    if (this.tileFar && this.tileNear) {
      const tw = this.tileW;
      const draw = (tile: HTMLCanvasElement, speed: number, alpha: number) => {
        const off = -((t * speed) % tw);
        ctx.globalAlpha = alpha;
        ctx.drawImage(tile, off, 0, tw, yH);
        ctx.drawImage(tile, off + tw, 0, tw, yH);
        ctx.globalAlpha = 1;
      };
      draw(this.tileFar, 9 * this.Sv, 1);
      // Moon glow on top of the thin cloud so it reads as lit from behind.
      ctx.globalCompositeOperation = 'screen';
      gr = ctx.createRadialGradient(mx, my, 0, mx, my, mr * 7);
      gr.addColorStop(0, 'rgba(170,195,245,0.28)');
      gr.addColorStop(1, 'rgba(170,195,245,0)');
      ctx.fillStyle = gr;
      ctx.fillRect(mx - mr * 7, my - mr * 7, mr * 14, mr * 14);
      ctx.globalCompositeOperation = 'source-over';
      draw(this.tileNear, 16 * this.Sv, 0.85);
    }

    // Gulls
    ctx.strokeStyle = 'rgba(205,218,240,0.75)';
    ctx.lineCap = 'round';
    for (const b of this.birds) {
      const k = (t - b.t0) / 7.5;
      if (k < 0 || k > 1) continue;
      const x = lerp(W * 1.08, -W * 0.08, k);
      const y = H * b.y + Math.sin(k * 5 + b.ph) * 10 * this.Sv - k * 40 * this.Sv;
      const flap = Math.sin(t * 7 + b.ph) * 0.9;
      const s = 15 * b.s * this.Sv;
      ctx.lineWidth = 1.7 * this.Sv * b.s + 0.4;
      ctx.beginPath();
      ctx.moveTo(x - s, y - flap * s * 0.35);
      ctx.quadraticCurveTo(x - s * 0.45, y - s * 0.4 - flap * s * 0.5, x, y);
      ctx.quadraticCurveTo(x + s * 0.45, y - s * 0.4 - flap * s * 0.5, x + s, y - flap * s * 0.35);
      ctx.stroke();
    }

    // Haze over the horizon
    const hz = ctx.createLinearGradient(0, yH - H * 0.14, 0, yH + H * 0.02);
    hz.addColorStop(0, 'rgba(70,104,150,0)');
    hz.addColorStop(0.85, 'rgba(76,112,158,0.34)');
    hz.addColorStop(1, 'rgba(90,126,170,0)');
    ctx.fillStyle = hz;
    ctx.fillRect(0, yH - H * 0.14, W, H * 0.16);
  }

  /* ---------------------------------------------------------------- lighthouse */

  private lighthouse(g: Geom, t: number) {
    const { ctx } = this;
    const { cx, baseY, h } = g;
    const flare = this.flare(t);
    const rockH = h * 0.13;
    const rw = h * 0.72;

    // Island: jagged dark rock with a moonlit left rim.
    ctx.beginPath();
    ctx.moveTo(cx - rw, baseY + h * 0.05);
    const n = this.rock.length;
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1);
      const x = cx - rw + u * rw * 2;
      const prof = Math.sin(u * Math.PI);
      const y = baseY - rockH * Math.pow(prof, 0.8) * (0.35 + this.rock[i] * 0.9);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(cx + rw, baseY + h * 0.05);
    ctx.closePath();
    const rg = ctx.createLinearGradient(cx - rw, 0, cx + rw, 0);
    rg.addColorStop(0, '#1b2b45');
    rg.addColorStop(0.45, '#0a1426');
    rg.addColorStop(1, '#04080f');
    ctx.fillStyle = rg;
    ctx.fill();

    // Surf at the foot of the rock
    ctx.save();
    ctx.translate(cx, baseY + h * 0.012);
    ctx.scale(1, 0.1);
    const sg = ctx.createRadialGradient(0, 0, 0, 0, 0, rw * 1.05);
    sg.addColorStop(0, 'rgba(225,238,255,0.35)');
    sg.addColorStop(0.7, 'rgba(225,238,255,0.12)');
    sg.addColorStop(1, 'rgba(225,238,255,0)');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.arc(0, 0, rw * 1.05, 0, TAU);
    ctx.fill();
    ctx.restore();

    // Tower
    const y0 = baseY - rockH * 0.55;
    const y1 = y0 - h;
    const bw = h * 0.125;
    const tw = h * 0.082;
    const pt = (f: number) => ({ y: y0 - h * f, w: lerp(bw, tw, f) });
    const bands: Array<[number, number, string]> = [
      [0, 0.22, '#d9d6cb'],
      [0.22, 0.4, '#b5443f'],
      [0.4, 0.58, '#d9d6cb'],
      [0.58, 0.76, '#b5443f'],
      [0.76, 1, '#d9d6cb'],
    ];
    for (const [a, b, col] of bands) {
      const A = pt(a);
      const B = pt(b);
      ctx.beginPath();
      ctx.moveTo(cx - A.w, A.y);
      ctx.lineTo(cx + A.w, A.y);
      ctx.lineTo(cx + B.w, B.y);
      ctx.lineTo(cx - B.w, B.y);
      ctx.closePath();
      ctx.fillStyle = col;
      ctx.fill();
    }
    // Night shading: moonlit on the left, deep shadow on the right.
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx - bw, y0);
    ctx.lineTo(cx + bw, y0);
    ctx.lineTo(cx + tw, y1);
    ctx.lineTo(cx - tw, y1);
    ctx.closePath();
    ctx.clip();
    const sh = ctx.createLinearGradient(cx - bw, 0, cx + bw, 0);
    sh.addColorStop(0, 'rgba(8,18,40,0.42)');
    sh.addColorStop(0.35, 'rgba(4,10,26,0.66)');
    sh.addColorStop(1, 'rgba(2,5,14,0.9)');
    ctx.fillStyle = sh;
    ctx.fillRect(cx - bw, y1, bw * 2, h);
    // Lamp light spilling onto the upper tower
    const spill = ctx.createRadialGradient(cx, y1, 0, cx, y1, h * 0.55);
    spill.addColorStop(0, `rgba(255,226,150,${0.35 + 0.4 * flare})`);
    spill.addColorStop(1, 'rgba(255,226,150,0)');
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = spill;
    ctx.fillRect(cx - bw, y1 - 10, bw * 2, h * 0.6);
    ctx.globalCompositeOperation = 'source-over';
    // Windows
    ctx.fillStyle = 'rgba(255,214,130,0.85)';
    for (const f of [0.3, 0.5, 0.68]) {
      const P = pt(f);
      ctx.fillRect(cx - h * 0.008, P.y - h * 0.022, h * 0.016, h * 0.032);
    }
    ctx.restore();

    // Gallery with railing
    const gw = tw * 1.55;
    ctx.fillStyle = '#10182a';
    ctx.fillRect(cx - gw, y1 - h * 0.012, gw * 2, h * 0.02);
    ctx.strokeStyle = 'rgba(16,24,42,0.95)';
    ctx.lineWidth = Math.max(1, h * 0.004);
    ctx.beginPath();
    for (let i = 0; i <= 8; i++) {
      const x = cx - gw + (i / 8) * gw * 2;
      ctx.moveTo(x, y1 - h * 0.012);
      ctx.lineTo(x, y1 - h * 0.05);
    }
    ctx.moveTo(cx - gw, y1 - h * 0.05);
    ctx.lineTo(cx + gw, y1 - h * 0.05);
    ctx.stroke();

    // Lantern room: glass lit from inside
    const lw = tw * 0.95;
    const lh = h * 0.1;
    const lg = ctx.createLinearGradient(0, y1 - h * 0.012 - lh, 0, y1 - h * 0.012);
    lg.addColorStop(0, '#fff6d0');
    lg.addColorStop(1, '#ffd477');
    ctx.fillStyle = lg;
    ctx.fillRect(cx - lw, y1 - h * 0.012 - lh, lw * 2, lh);
    ctx.fillStyle = 'rgba(20,24,40,0.85)';
    for (const f of [-1, -0.34, 0.34, 1]) ctx.fillRect(cx + f * lw - Math.max(1, h * 0.003) / 2, y1 - h * 0.012 - lh, Math.max(1, h * 0.003), lh);
    // Dome
    ctx.beginPath();
    ctx.moveTo(cx - lw * 1.2, y1 - h * 0.012 - lh);
    ctx.quadraticCurveTo(cx, y1 - h * 0.012 - lh - h * 0.12, cx + lw * 1.2, y1 - h * 0.012 - lh);
    ctx.closePath();
    ctx.fillStyle = '#6f2a2a';
    ctx.fill();
    ctx.fillStyle = '#0f1626';
    ctx.fillRect(cx - h * 0.003, y1 - h * 0.012 - lh - h * 0.085, h * 0.006, h * 0.03);

  }

  /* ---------------------------------------------------------------- beams */

  private halo(g: Geom, t: number) {
    const { ctx } = this;
    const flare = this.flare(t);
    ctx.globalCompositeOperation = 'lighter';
    const h = g.h;
    // A real lamp does not flicker: the glow only swells (forward scattering) when the beam turns toward the viewer.
    const r = h * (0.5 + 0.55 * flare);
    const hg = ctx.createRadialGradient(g.lampX, g.lampY, 0, g.lampX, g.lampY, r);
    hg.addColorStop(0, `rgba(255,240,190,${0.62 + 0.3 * flare})`);
    hg.addColorStop(0.18, `rgba(255,214,130,${0.28 + 0.12 * flare})`);
    hg.addColorStop(0.5, `rgba(255,205,120,${0.07 + 0.05 * flare})`);
    hg.addColorStop(1, 'rgba(255,200,110,0)');
    ctx.fillStyle = hg;
    ctx.fillRect(g.lampX - r, g.lampY - r, r * 2, r * 2);
    ctx.globalCompositeOperation = 'source-over';
  }

  /** Focal length (px) of the virtual long lens the beams are projected with. */
  private focal() {
    return BEAM.focal * Math.max(this.W, this.H * 0.8);
  }

  /** Bearing of the camera as seen from the lamp at the moment of the final flash (the beam is aimed straight at it). */
  private camBearing() {
    const g = this.geom(T_FLASH);
    return Math.PI / 2 + Math.atan((g.lampX - this.W / 2) / this.focal());
  }

  /** Beam bearing: a lens turns at a constant rate, and points exactly at the camera at T_FLASH. */
  private theta(t: number) {
    return this.camBearing() - (TAU / BEAM.period) * (T_FLASH - t);
  }

  /** Smallest signed angle between two bearings. */
  private angDiff(a: number, b: number) {
    let d = (((a - b) % TAU) + TAU) % TAU;
    if (d > Math.PI) d -= TAU;
    return d;
  }

  /** 0..1: how directly one of the two beams is aimed at the camera (a Gaussian in the angle, like a real lens). */
  private flare(t: number) {
    const th = this.theta(t);
    const cam = this.camBearing();
    let f = 0;
    for (const k of [0, 1]) {
      const d = this.angDiff(th + k * Math.PI, cam);
      f = Math.max(f, Math.exp(-(d * d) / (2 * 0.3 * 0.3)));
    }
    // The glare grows smoothly toward the final flash instead of switching on.
    return f * (0.3 + 0.7 * smooth(T_FLASH - 2.6, T_FLASH - 0.6, t));
  }

  /** How strongly the beam currently falls on the ship (it only does as the beam sweeps past its bearing). */
  private updateBeams(_g: Geom, t: number) {
    const th = this.theta(t);
    const target = Math.PI - 0.6;
    let best = 0;
    for (const k of [0, 1]) {
      const d = this.angDiff(th + k * Math.PI, target);
      best = Math.max(best, Math.exp(-(d * d) / (2 * 0.3 * 0.3)));
    }
    this.lit = best;
  }

  /**
   * The two beams are real 3D cones (apex at the lamp, slightly tilted toward the sea) seen through a pinhole camera:
   * a beam that turns toward us gets closer, wider and brighter (forward scattering), one that turns away narrows toward
   * the horizon and fades. Where a beam reaches the sea it leaves a pool of light.
   * Units: the lamp is 1 above the camera's eye, distances along the beam are measured in lamp distances.
   */
  private beams(g: Geom, t: number) {
    const { ctx, W, yH } = this;
    this.halo(g, t);
    const th = this.theta(t);
    const F = this.focal();
    const lx = g.lampX;
    const ly = g.lampY;
    const a = lx - W / 2; // lamp offset from the screen centre (px)
    const b = yH - ly; // lamp height above the horizon (px) = F / distance
    const hgp = (c: number) => (1 - BEAM.g * BEAM.g) / Math.pow(1 + BEAM.g * BEAM.g - 2 * BEAM.g * c, 1.5);
    const hg1 = hgp(1);
    const prof = (r: number) => Math.exp(-2.6 * r * r); // soft Gaussian cross-section
    const LAYERS_X = 7;

    ctx.globalCompositeOperation = 'lighter';
    for (const k of [0, 1]) {
      const phi = th + k * Math.PI;
      const dx = Math.cos(phi);
      const dz = Math.sin(phi); // > 0: toward the viewer
      const proj = (s: number) => {
        const zr = 1 - s * dz;
        return { x: W / 2 + (a + F * s * dx) / zr, y: yH - (b * (1 - BEAM.tilt * s)) / zr, zr };
      };
      const half = (s: number) => (BEAM.r0 * b + s * F * BEAM.tan) / (1 - s * dz);
      const swater = (1 + BEAM.eye) / BEAM.tilt;
      let end = Math.min(BEAM.reach, swater);
      if (dz > 0.02) end = Math.min(end, 0.72 / dz); // stop short of the camera plane
      const e = proj(end);
      const len = Math.hypot(e.x - lx, e.y - ly);
      if (len < 3) continue;
      const ux = (e.x - lx) / len;
      const uy = (e.y - ly) / len;
      const nx = -uy;
      const ny = ux;

      // Forward scattering: brightest when the beam travels toward the viewer.
      const amp = 0.16 + 0.84 * Math.pow(hgp(dz) / hg1, 0.5);
      const bright = (s: number) => {
        const tip = 1 - smooth(0.7, 1, s / end);
        const root = smooth(0, 0.03 * end, s);
        return (amp * Math.exp(-s / BEAM.ext) * tip * root) / (1 + BEAM.spread * s);
      };

      const N = 12;
      const ss: number[] = [];
      const us: number[] = [];
      for (let i = 0; i <= N; i++) {
        const s = end * Math.pow(i / N, 1.6);
        const p = proj(s);
        ss.push(s);
        us.push(clamp(((p.x - lx) * ux + (p.y - ly) * uy) / len));
      }

      for (let j = LAYERS_X; j >= 1; j--) {
        const m = j / LAYERS_X;
        const la = prof((j - 1) / LAYERS_X) - prof(m);
        const grad = ctx.createLinearGradient(lx, ly, e.x, e.y);
        for (let i = 0; i <= N; i++) grad.addColorStop(us[i], `rgba(255,244,208,${(la * BEAM.gain * bright(ss[i])).toFixed(4)})`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        for (let i = 0; i <= N; i++) {
          const p = proj(ss[i]);
          const w = half(ss[i]) * m;
          if (i === 0) ctx.moveTo(p.x + nx * w, p.y + ny * w);
          else ctx.lineTo(p.x + nx * w, p.y + ny * w);
        }
        for (let i = N; i >= 0; i--) {
          const p = proj(ss[i]);
          const w = half(ss[i]) * m;
          ctx.lineTo(p.x - nx * w, p.y - ny * w);
        }
        ctx.closePath();
        ctx.fill();
      }

      // Pool of light where the beam meets the sea (perspective-flattened ellipse).
      if (end >= swater - 1e-6) {
        const p = proj(swater);
        const strength = BEAM.pool * bright(swater * 0.82);
        if (strength > 0.004 && p.x > -W * 0.3 && p.x < W * 1.3) {
          const rx = Math.max(18, half(swater) * 3.2);
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.scale(1, 0.16);
          const pr = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
          pr.addColorStop(0, `rgba(255,236,170,${strength})`);
          pr.addColorStop(1, 'rgba(255,236,170,0)');
          ctx.fillStyle = pr;
          ctx.beginPath();
          ctx.arc(0, 0, rx, 0, TAU);
          ctx.fill();
          ctx.restore();
        }
      }
    }

    // Beam aimed at the viewer: the lamp blooms and a few soft diffraction streaks spread from it.
    const f = this.flare(t);
    if (f > 0.01) {
      const r = this.H * (0.22 + 0.7 * f);
      const fg = ctx.createRadialGradient(lx, ly, 0, lx, ly, r);
      fg.addColorStop(0, `rgba(255,250,225,${0.95 * f})`);
      fg.addColorStop(0.25, `rgba(255,226,150,${0.5 * f})`);
      fg.addColorStop(1, 'rgba(255,200,110,0)');
      ctx.fillStyle = fg;
      ctx.fillRect(lx - r, ly - r, r * 2, r * 2);
      const rays = 12;
      ctx.save();
      ctx.translate(lx, ly);
      for (let i = 0; i < rays; i++) {
        const ang = (i / rays) * TAU + 0.31;
        const rl = r * (1.2 + 0.45 * Math.sin(i * 7.3));
        const rg = ctx.createLinearGradient(0, 0, Math.cos(ang) * rl, Math.sin(ang) * rl);
        rg.addColorStop(0, `rgba(255,240,190,${0.16 * f * f})`);
        rg.addColorStop(1, 'rgba(255,240,190,0)');
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(ang - 0.03) * rl, Math.sin(ang - 0.03) * rl);
        ctx.lineTo(Math.cos(ang + 0.03) * rl, Math.sin(ang + 0.03) * rl);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  /* ---------------------------------------------------------------- sea and ship */

  private sea(g: Geom, t: number) {
    const { ctx, W, H, yH } = this;
    // Water below the horizon, so gaps between wave crests never show sky.
    const base = ctx.createLinearGradient(0, yH, 0, H);
    base.addColorStop(0, '#2b4d78');
    base.addColorStop(1, '#030914');
    ctx.fillStyle = base;
    ctx.fillRect(0, yH - 1, W, H - yH + 2);

    // The island sits between the wave layers: first layer that starts below its foot is drawn in front of it.
    let lhLayer = LAYERS - 1;
    for (let i = 0; i < LAYERS; i++) {
      const f0 = i / (LAYERS - 1);
      if (yH + (H - yH) * Math.pow(f0, 1.6) * 0.95 + H * 0.004 > g.baseY) {
        lhLayer = i;
        break;
      }
    }
    for (let i = 0; i < LAYERS; i++) {
      if (i === lhLayer) this.lighthouse(g, t);
      if (i === SHIP_LAYER) this.ship(g, t);
      const f = i / (LAYERS - 1);
      const top = mix([48, 84, 128], [34, 62, 98], Math.pow(f, 0.7));
      const bottom = mix([12, 28, 54], [2, 7, 16], Math.pow(f, 0.6));
      const y0 = this.waveY(i, 0, 0);
      const amp = (2 + 34 * Math.pow(f, 1.4)) * this.Sv;
      const grad = ctx.createLinearGradient(0, y0 - amp, 0, y0 + amp * 2.4 + 34 * this.Sv);
      grad.addColorStop(0, rgb(top));
      grad.addColorStop(1, rgb(bottom));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(-8, H + 10);
      for (let x = -8; x <= W + 8; x += 8) ctx.lineTo(x, this.waveY(i, x, t));
      ctx.lineTo(W + 8, H + 10);
      ctx.closePath();
      ctx.fill();

      // Mist drifting between the distant swells
      if (i === 1 || i === 2) {
        const mg = ctx.createLinearGradient(0, y0 - amp * 2, 0, y0 + H * 0.06);
        mg.addColorStop(0, 'rgba(120,150,195,0)');
        mg.addColorStop(0.6, 'rgba(120,150,195,0.12)');
        mg.addColorStop(1, 'rgba(120,150,195,0)');
        ctx.fillStyle = mg;
        ctx.fillRect(0, y0 - amp * 2, W, H * 0.06 + amp * 2);
      }
    }

    // Foam flecks on the near crests
    for (const fm of this.foam) {
      const x = (((fm.x + t * fm.v) % (W + 40)) + W + 40) % (W + 40) - 20;
      const y = this.waveY(fm.layer, x, t) + 1.5 * this.Sv;
      const a = (0.12 + 0.22 * (0.5 + 0.5 * Math.sin(t * 2.4 + fm.ph))) * (fm.layer / LAYERS + 0.3);
      ctx.fillStyle = `rgba(215,230,250,${a.toFixed(3)})`;
      ctx.beginPath();
      ctx.ellipse(x, y, fm.r * 2.4 * this.Sv, fm.r * 0.9 * this.Sv, 0, 0, TAU);
      ctx.fill();
    }
  }

  private ship(_g: Geom, t: number) {
    const { ctx, W } = this;
    const sc = this.S;
    const k = easeOut(clamp(t / (T_FLASH + 0.4)));
    const x = lerp(-W * 0.3, W * 0.3, k);
    const wl = this.waveY(SHIP_LAYER, x, t) + 2 * sc;
    const slope = (this.waveY(SHIP_LAYER, x + 70 * sc, t) - this.waveY(SHIP_LAYER, x - 70 * sc, t)) / (140 * sc);
    const roll = Math.atan(slope) * 0.9 + 0.012 * Math.sin(t * 2.3);
    const lit = this.lit;

    // Wake behind the stern and a bow wave
    ctx.save();
    ctx.translate(x, wl + 28 * sc);
    for (const [dx, w, a] of [[-210, 110, 0.14], [-290, 150, 0.1], [150, 46, 0.16]]) {
      ctx.save();
      ctx.translate(dx * sc, 0);
      ctx.scale(1, 0.14);
      const wg = ctx.createRadialGradient(0, 0, 0, 0, 0, w * sc);
      wg.addColorStop(0, `rgba(215,230,250,${a})`);
      wg.addColorStop(1, 'rgba(215,230,250,0)');
      ctx.fillStyle = wg;
      ctx.beginPath();
      ctx.arc(0, 0, w * sc, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();

    const body = (alpha: number) => {
      const sailLo = [96, 112, 148];
      const sailHi = [255, 238, 188];
      const sailCol = mix(sailLo, sailHi, clamp(lit * 1.1));
      const sailGrad = ctx.createLinearGradient(-60, 0, 250, 0);
      sailGrad.addColorStop(0, rgb(mix(sailCol, [190, 205, 235], 0.25), alpha));
      sailGrad.addColorStop(1, rgb(mix(sailCol, [10, 18, 40], 0.4), alpha));

      // hull
      const hg = ctx.createLinearGradient(0, -90, 0, 26);
      hg.addColorStop(0, rgb(mix([46, 34, 28], [150, 110, 70], lit * 0.8), alpha));
      hg.addColorStop(1, rgb([12, 9, 8], alpha));
      ctx.fillStyle = hg;
      ctx.fill(HULL);
      ctx.fill(STERN);
      ctx.fill(BOW);
      ctx.strokeStyle = rgb(mix([120, 94, 56], [255, 214, 140], lit), alpha * 0.9);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-168, -44);
      ctx.lineTo(176, -44);
      ctx.stroke();
      // gun ports
      ctx.fillStyle = rgb([6, 5, 5], alpha);
      for (const px of [-110, -70, -30, 10, 50, 90]) ctx.fillRect(px, -22, 10, 7);
      // cabin windows
      const wf = 0.78 + 0.22 * Math.sin(t * 6.2);
      ctx.fillStyle = rgb([255, 205, 120], alpha * wf);
      for (const px of [-156, -138, -120]) ctx.fillRect(px, -72, 9, 11);

      // masts
      ctx.strokeStyle = rgb([34, 24, 19], alpha);
      ctx.lineCap = 'round';
      for (const [x1, y1, x2, y2, w] of [[10, -44, 10, -318, 6], [96, -58, 96, -262, 5], [-62, -84, -62, -222, 5], [170, -56, 250, -96, 6]]) {
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      // sails, filling slightly in the wind
      SAILS.forEach((s, i) => {
        const bil = Math.sin(t * 1.5 + i * 0.7);
        ctx.save();
        ctx.translate(s.cx, s.top);
        ctx.transform(1 + 0.015 * bil, 0, 0.03 * bil, 1 + 0.01 * bil, 0, 0);
        ctx.translate(-s.cx, -s.top);
        ctx.fillStyle = sailGrad;
        ctx.fill(s.p);
        ctx.strokeStyle = rgb([60, 70, 96], alpha * 0.45);
        ctx.lineWidth = 1;
        ctx.stroke(s.p);
        ctx.restore();
      });

      // yards
      ctx.strokeStyle = rgb([34, 24, 19], alpha);
      ctx.lineWidth = 3.4;
      ctx.beginPath();
      for (const [a, b, y] of [[-22, 42, -300], [-38, 58, -246], [-52, 72, -166], [74, 118, -250], [66, 126, -196], [60, 132, -124], [-90, -34, -212]]) {
        ctx.moveTo(a, y);
        ctx.lineTo(b, y);
      }
      ctx.stroke();

      // rigging
      ctx.strokeStyle = rgb([200, 210, 235], alpha * 0.25);
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const [x1, y1, x2, y2] of [[10, -318, 176, -56], [10, -318, -166, -84], [96, -262, 250, -96], [-62, -222, -166, -84], [10, -200, -40, -44], [10, -200, 64, -44], [96, -170, 60, -44], [96, -170, 134, -44]]) {
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
      }
      ctx.stroke();

      // pennants
      for (const [px, py, len, col, ph] of [[10, -316, 54, [215, 70, 76], 0], [96, -262, 40, [226, 190, 96], 0.8]] as Array<[number, number, number, number[], number]>) {
        const fl = Math.sin(t * 7 + ph);
        ctx.fillStyle = rgb(mix(col, [255, 240, 200], lit * 0.5), alpha);
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + len * (0.9 + 0.1 * fl), py + 8 + 4 * fl);
        ctx.lineTo(px, py + 20);
        ctx.closePath();
        ctx.fill();
      }

      // stern lantern
      ctx.globalCompositeOperation = 'lighter';
      const lg = ctx.createRadialGradient(-172, -90, 0, -172, -90, 38);
      lg.addColorStop(0, rgb([255, 226, 150], 0.75 * alpha));
      lg.addColorStop(1, rgb([255, 200, 110], 0));
      ctx.fillStyle = lg;
      ctx.fillRect(-212, -130, 80, 80);
      ctx.globalCompositeOperation = 'source-over';
    };

    // Reflection first (mirrored, faint), then the ship itself.
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, wl + 6 * sc, W, this.H);
    ctx.clip();
    ctx.translate(x, wl + 8 * sc);
    ctx.rotate(-roll * 0.6);
    ctx.scale(sc, -sc * 0.6);
    body(0.2);
    ctx.restore();

    ctx.save();
    ctx.translate(x, wl);
    ctx.rotate(roll);
    ctx.scale(sc, sc);
    body(1);
    ctx.restore();
  }

  /* ---------------------------------------------------------------- overlays */

  /** Moonlight on the water: a soft column plus tiny sparkles (no hard lines). */
  private glitter(t: number) {
    const { ctx, W, H, yH } = this;
    const mx = W * 0.2;
    ctx.globalCompositeOperation = 'lighter';
    for (const [gx, gw, ga] of [[mx, 0.07, 0.2], [mx, 0.03, 0.16]] as Array<[number, number, number]>) {
      ctx.save();
      ctx.translate(gx, yH + (H - yH) * 0.42);
      ctx.scale(gw * W, (H - yH) * 0.55);
      const cg = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      cg.addColorStop(0, `rgba(165,195,245,${ga})`);
      cg.addColorStop(1, 'rgba(165,195,245,0)');
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.arc(0, 0, 1, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    // Warm reflection of the lamp beneath the lighthouse.
    const g = this.geom(t);
    const wf = 0.5 + 0.5 * this.flare(t);
    for (const s of this.glints) {
      const u = s.u;
      const y = g.baseY + (H - g.baseY) * u * 0.9 + 4;
      const x = g.cx + s.g * (6 + 60 * u) * this.Sv;
      const a = s.a * wf * 0.8 * Math.pow(0.5 + 0.5 * Math.sin(t * s.sp * 0.8 + s.ph + 2), 2) * (1 - u * 0.5);
      if (a < 0.03) continue;
      ctx.fillStyle = `rgba(255,222,150,${a.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(x, y, (0.7 + 2 * u) * this.Sv, 0, TAU);
      ctx.fill();
    }
    for (const s of this.glints) {
      const y = yH + (H - yH) * s.u * 0.95 + 2;
      const spread = (8 + 190 * s.u) * this.Sv;
      const x = mx + s.g * spread;
      const a = s.a * Math.pow(0.5 + 0.5 * Math.sin(t * s.sp + s.ph), 2) * (1 - s.u * 0.4);
      if (a < 0.03) continue;
      const r = (0.8 + 2.6 * s.u) * this.Sv;
      ctx.fillStyle = `rgba(225,238,255,${a.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  private nearFog(t: number) {
    const { ctx, W } = this;
    for (const f of this.fog) {
      const span = W + f.r * 5;
      const x = ((((f.x + t * f.v) % span) + span) % span) - f.r * 2.5;
      ctx.save();
      ctx.translate(x, f.y);
      ctx.scale(1, 0.16);
      const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, f.r * 2);
      gr.addColorStop(0, `rgba(150,176,215,${f.a})`);
      gr.addColorStop(1, 'rgba(150,176,215,0)');
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.arc(0, 0, f.r * 2, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  /** The lamp swallows the screen: a growing disc of light, brightest at the centre. */
  private bloom(g: Geom, t: number) {
    const { ctx, W, H } = this;
    const start = T_FLASH - 0.4;
    if (t < start) return;
    const k = clamp((t - start) / (T_WHITE - start));
    const diag = Math.hypot(W, H) * 1.25;
    const r = lerp(H * 0.08, diag, easeIn(k));
    const a = smooth(0, 0.25, k);
    const gr = ctx.createRadialGradient(g.lampX, g.lampY, 0, g.lampX, g.lampY, r);
    gr.addColorStop(0, `rgba(255,253,240,${a})`);
    gr.addColorStop(0.45, `rgba(255,240,190,${a * 0.96})`);
    gr.addColorStop(0.8, `rgba(255,214,130,${a * 0.6})`);
    gr.addColorStop(1, 'rgba(255,200,110,0)');
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
    if (k > 0.8) {
      ctx.fillStyle = `rgba(255,248,224,${smooth(0.8, 1, k)})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  private paintWhite() {
    const { ctx, W, H } = this;
    ctx.setTransform(this.canvas.width / W, 0, 0, this.canvas.height / H, 0, 0);
    ctx.fillStyle = '#fff8e0';
    ctx.fillRect(0, 0, W, H);
  }
}

function LAYER_PHASES(): number[][] {
  const rnd = mulberry32(31);
  return Array.from({ length: LAYERS }, () => [rnd() * TAU, rnd() * TAU, rnd() * TAU]);
}
