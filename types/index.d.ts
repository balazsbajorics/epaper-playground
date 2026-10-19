export interface PanelOptions {
  /** Panel width in pixels. Default 240. */
  width?: number;
  /** Panel height in pixels. Default 320. */
  height?: number;
  /** Duration of a partial refresh in ms. Default 450. */
  partialMs?: number;
  /** Duration of a full refresh (invert, black, white, draw) in ms. Default 1800. */
  fullMs?: number;
  /** Force a full refresh after this many consecutive partials. Default 5. */
  fullEvery?: number;
  /** false = instant, exact bitmap preview with no simulation. Default true. */
  enabled?: boolean;
  /** Seed for the stationary material texture. */
  seed?: number;
}

export interface PanelState {
  mode: 'idle' | 'partial' | 'full';
  partials: number;
  queued: boolean;
  enabled: boolean;
}

export class EpaperPanel {
  constructor(options?: PanelOptions);
  width: number;
  height: number;
  partialMs: number;
  fullMs: number;
  fullEvery: number;
  enabled: boolean;
  seed: number;
  /** Current brightness per pixel, 0 = ink, 1 = paper. */
  pixels: Float32Array;
  ghost: Float32Array;
  partials: number;
  readonly bitmapLength: number;
  readonly busy: boolean;
  readonly state: PanelState;
  /** Submit a packed 1-bit bitmap (MSB first, 1 = white). */
  submit(bitmap: Uint8Array, full?: boolean, now?: number): boolean;
  /** Advance the simulation to `now` (ms) and return `pixels`. */
  tick(now: number): Float32Array;
  refresh(now?: number): void;
  setEnabled(enabled: boolean, now?: number): void;
  reset(): void;
}

export type Dither = 'none' | 'bayer' | 'floyd-steinberg';

export interface ConvertOptions {
  /** Luminance (0..1) at or above which a pixel is paper. Default 0.5. */
  threshold?: number;
  dither?: Dither;
}

export type FrameSource =
  | Uint8Array
  | string
  | ImageData
  | HTMLCanvasElement
  | OffscreenCanvas
  | {pixels: Uint8Array | string; full?: boolean};

export interface DisplayOptions extends PanelOptions, ConvertOptions {
  /** Backing pixels per panel pixel, 1 or 2. Default 2. */
  scale?: 1 | 2;
  onState?: (state: PanelState) => void;
  clock?: () => number;
  requestFrame?: (callback: (now: number) => void) => unknown;
  cancelFrame?: (id: unknown) => void;
}

export interface EpaperDisplay {
  panel: EpaperPanel;
  canvas: HTMLCanvasElement | OffscreenCanvas;
  width: number;
  height: number;
  readonly state: PanelState;
  submit(source: FrameSource, options?: ConvertOptions & {full?: boolean}): boolean;
  refresh(): void;
  setEnabled(enabled: boolean): void;
  reset(): void;
  dispose(): void;
}

export function createEpaperDisplay(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  options?: DisplayOptions,
): EpaperDisplay;

export interface Rasterizer {
  width: number;
  height: number;
  rasterize(pixels: Float32Array, data: Uint8ClampedArray): Uint8ClampedArray;
}
export function createRasterizer(panel: EpaperPanel, scale?: 1 | 2): Rasterizer;

export const PRESETS: Record<
  string,
  Required<Pick<PanelOptions, 'width' | 'height' | 'partialMs' | 'fullMs' | 'fullEvery'>>
>;
export function preset(name: string): PanelOptions;

export function bitmapLength(width: number, height: number): number;
export function createBitmap(width: number, height: number, white?: boolean): Uint8Array;
export function getPixel(bitmap: Uint8Array, width: number, x: number, y: number): 0 | 1;
export function setPixel(
  bitmap: Uint8Array,
  width: number,
  x: number,
  y: number,
  white: boolean,
): void;
export function packBits(
  values: ArrayLike<number>,
  width: number,
  height: number,
  options?: {threshold?: number; max?: number},
): Uint8Array;
export function unpackBits(bitmap: Uint8Array, width: number, height: number): Float32Array;
export function fromImageData(image: ImageData, options?: ConvertOptions): Uint8Array;
export function fromCanvas(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  options?: ConvertOptions,
): Uint8Array;
export function toBitmap(
  source: FrameSource,
  width: number,
  height: number,
  options?: ConvertOptions,
): Uint8Array;
export function toBase64(bitmap: Uint8Array): string;
export function noise(x: number, y: number, seed: number): number;
export function cloud(x: number, y: number, size: number, seed: number): number;

export interface Glyph {
  width: number;
  bbw: number;
  bbh: number;
  bbx: number;
  bby: number;
  rows: Uint8Array[];
}
export interface BdfFont {
  name: string;
  size: number;
  ascent: number;
  descent: number;
  height: number;
  glyphs: Map<number, Glyph>;
  fallback?: Glyph;
}
export interface FontEntry {
  file: string;
  height: number;
  cell: number;
  bold: boolean;
  family: string;
}
export const FONTS: Record<string, FontEntry>;
export function loadFonts(ids?: string[], base?: string | URL): Promise<Record<string, BdfFont>>;
export function loadFontsFromDisk(
  ids?: string[],
  directory?: string | URL,
): Promise<Record<string, BdfFont>>;
export function parseBdf(text: string): BdfFont;
export function loadBdf(url: string | URL): Promise<BdfFont>;
export function toBdf(font: BdfFont, keep?: (codepoint: number) => boolean): string;
export function glyphFor(font: BdfFont, codepoint: number): Glyph | undefined;
export function measureText(font: BdfFont, text: string): number;
export function eachPixel(
  font: BdfFont,
  text: string,
  x: number,
  y: number,
  visit: (x: number, y: number) => void,
): number;
export function drawText(
  ctx: {fillRect(x: number, y: number, w: number, h: number): void},
  font: BdfFont,
  text: string,
  x: number,
  y: number,
): number;
export function drawTextBitmap(
  bitmap: Uint8Array,
  width: number,
  height: number,
  font: BdfFont,
  text: string,
  x: number,
  y: number,
  white?: boolean,
): number;
export function wrapText(font: BdfFont, text: string, maxWidth: number): string[];
