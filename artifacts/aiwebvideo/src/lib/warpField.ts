/**
 * Star streaks that fly outward from the glowing horizon, so the page feels like it is moving forward through space.
 *
 * Each star lives at a depth `z` (1 = far, 0 = at the camera). Its screen distance from the vanishing point is
 * `radius / z`, so as `z` shrinks the star accelerates outward and its trail grows, exactly like flying toward it.
 * When a star leaves the screen it is reborn far away. Stars only fly into the upper fan of the sky, never over
 * the planet at the bottom. The maths is pure (no DOM) so it can be tested.
 */
export interface Star {
  angle: number;   // radians, pointing into the upper half of the screen
  radius: number;  // 0.03 .. 1, distance from the vanishing point in "world" units
  z: number;       // 1 (far) .. ~0 (camera)
  hue: 0 | 1 | 2 | 3;
  weight: number;  // 0.5 .. 1.5, thickness and brightness
}

export const STAR_COLORS = [
  [255, 255, 255],
  [125, 211, 252],
  [196, 181, 253],
  [244, 114, 182],
] as const;

export type Random = () => number;

export function createStar(rand: Random, z = 1, fullSky = false): Star {
  return {
    // upper fan: from just above the left horizon, over the top, to just above the right horizon;
    // a full sky (every direction) is used for the hyperspace jump between pages
    angle: fullSky ? rand() * Math.PI * 2 : Math.PI * (1.04 + rand() * 0.92),
    radius: 0.03 + Math.pow(rand(), 1.6) * 0.97,
    z,
    hue: ([0, 0, 1, 2, 3][Math.floor(rand() * 5)] ?? 0) as Star['hue'],
    weight: 0.5 + rand(),
  };
}

export function createField(count: number, rand: Random, fullSky = false): Star[] {
  // spread through depth so the sky is full from the first frame
  return Array.from({ length: count }, () => createStar(rand, 0.05 + rand() * 0.95, fullSky));
}

/** Moves a star toward the camera. Returns its previous depth (for the trail) and the star (reborn if it left). */
export function advanceStar(star: Star, seconds: number, speed: number, rand: Random, fullSky = false): { star: Star; previousZ: number } {
  const previousZ = star.z;
  const z = star.z - seconds * speed * (0.55 + 0.9 * (1 - star.z));   // accelerates as it nears
  if (z <= 0.035) return { star: createStar(rand, 1, fullSky), previousZ: 1 };
  return { star: { ...star, z }, previousZ };
}

export interface Segment { x1: number; y1: number; x2: number; y2: number; alpha: number; width: number; offscreen: boolean }

export function starSegment(star: Star, previousZ: number, width: number, height: number, centerX = 0.5, centerY = 0.84): Segment {
  const scale = Math.hypot(width, height) * 0.5;
  const cx = width * centerX;
  const cy = height * centerY;
  const at = (z: number) => {
    const r = (star.radius / Math.max(z, 0.02)) * scale * 0.28;
    return { x: cx + Math.cos(star.angle) * r, y: cy + Math.sin(star.angle) * r };
  };
  const head = at(star.z);
  // the trail reaches back toward where the star was a moment ago
  const tail = at(Math.min(1.2, Math.max(star.z, previousZ + (previousZ - star.z) * 3)));
  const fade = Math.min(1, (1 - star.z) * 2.2);                       // far stars are faint
  const alpha = Math.max(0, Math.min(1, fade * (0.35 + 0.5 * star.weight)));
  const offscreen = head.x < -40 || head.x > width + 40 || head.y < -40 || head.y > height + 40;
  return { x1: tail.x, y1: tail.y, x2: head.x, y2: head.y, alpha, width: 0.5 + (1 - star.z) * 1.6 * star.weight, offscreen };
}

/** Controls one canvas: sizing, the animation loop, pausing when hidden, and a still frame for reduced motion. */
export class WarpField {
  private stars: Star[] = [];
  private raf = 0;
  private last = 0;
  private width = 0;
  private height = 0;
  private running = false;
  private readonly ctx: CanvasRenderingContext2D | null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly options: {
      count: number;
      speed: number;
      reducedMotion: boolean;
      rand?: Random;
      /** vertical position of the vanishing point (the road), 0 = top, 1 = bottom */
      centerY?: number;
      /** stars fly in every direction from the centre (hyperspace), not only into the upper sky */
      fullSky?: boolean;
      /** longer streaks for a faster-feeling jump (1 = normal) */
      streak?: number;
    },
  ) {
    this.ctx = canvas.getContext('2d');
    this.stars = createField(options.count, options.rand ?? Math.random, Boolean(options.fullSky));
  }

  /** Changes the travel speed while running (the jump accelerates, then eases out as the page arrives). */
  setSpeed(speed: number) {
    this.options.speed = speed;
  }

  resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    this.width = Math.max(1, this.canvas.clientWidth);
    this.height = Math.max(1, this.canvas.clientHeight);
    this.canvas.width = Math.round(this.width * ratio);
    this.canvas.height = Math.round(this.height * ratio);
    this.ctx?.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.draw(0);
  }

  private draw(seconds: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    const rand = this.options.rand ?? Math.random;
    this.stars = this.stars.map((current) => {
      const fullSky = Boolean(this.options.fullSky);
      const moved = seconds > 0 ? advanceStar(current, seconds, this.options.speed, rand, fullSky) : { star: current, previousZ: current.z };
      const streak = this.options.streak ?? 1;
      const stretchedPrevious = streak === 1 ? moved.previousZ : Math.min(1.2, moved.star.z + (moved.previousZ - moved.star.z) * streak);
      const segment = starSegment(moved.star, stretchedPrevious, this.width, this.height, 0.5, this.options.centerY ?? 0.84);
      if (segment.offscreen) return createStar(rand, 1, fullSky);
      const [r, g, b] = STAR_COLORS[moved.star.hue];
      ctx.strokeStyle = `rgba(${r},${g},${b},${segment.alpha})`;
      ctx.lineWidth = segment.width;
      ctx.beginPath();
      ctx.moveTo(segment.x1, segment.y1);
      ctx.lineTo(segment.x2, segment.y2);
      ctx.stroke();
      return moved.star;
    });
  }

  private frame = (time: number) => {
    if (!this.running) return;
    const seconds = this.last ? Math.min(0.05, (time - this.last) / 1000) : 0;   // never jump after a pause
    this.last = time;
    this.draw(seconds);
    this.raf = requestAnimationFrame(this.frame);
  };

  start() {
    if (this.options.reducedMotion || this.running) return;
    this.running = true;
    this.last = 0;
    this.raf = requestAnimationFrame(this.frame);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }
}
