/**
 * Real sprite-sheet analysis, done on the actual pixels of the file the user
 * dropped: find the frame grid, count frames, and pull the palette so the
 * generated asset can be asked to match it.
 */

export interface SheetReading {
  name: string;
  width: number;
  height: number;
  frameWidth: number;
  frameHeight: number;
  columns: number;
  rows: number;
  frames: number;
  /** Dominant colours, most common first, as #rrggbb. */
  palette: string[];
  /** How the grid was determined — shown to the user, never guessed silently. */
  method: 'transparent gutters' | 'even division' | 'whole image';
}

const CANDIDATE_SIZES = [128, 96, 80, 64, 48, 40, 32, 24, 16, 8];

function readPixels(image: ImageBitmap | HTMLImageElement): ImageData {
  const w = 'width' in image ? image.width : 0;
  const h = 'height' in image ? image.height : 0;
  const canvas =
    typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(w, h)
      : Object.assign(document.createElement('canvas'), { width: w, height: h });
  const ctx = (canvas as OffscreenCanvas).getContext('2d', {
    willReadFrequently: true,
  }) as OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null;
  if (!ctx) throw new Error('Could not read the image — no 2D canvas available');
  ctx.drawImage(image as CanvasImageSource, 0, 0);
  return ctx.getImageData(0, 0, w, h);
}

/** Columns/rows that are entirely transparent act as frame gutters. */
function emptyLines(data: ImageData): { cols: boolean[]; rows: boolean[] } {
  const { width, height, data: px } = data;
  const cols = new Array<boolean>(width).fill(true);
  const rows = new Array<boolean>(height).fill(true);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (px[(y * width + x) * 4 + 3] > 8) {
        cols[x] = false;
        rows[y] = false;
      }
    }
  }
  return { cols, rows };
}

/** Distance between the starts of consecutive runs of content. */
function pitchFrom(empty: boolean[]): number | null {
  const starts: number[] = [];
  for (let i = 0; i < empty.length; i++) {
    if (!empty[i] && (i === 0 || empty[i - 1])) starts.push(i);
  }
  if (starts.length < 2) return null;
  const gaps = starts.slice(1).map((s, i) => s - starts[i]);
  const first = gaps[0];
  // Only trust it when the spacing is genuinely regular.
  return gaps.every((g) => Math.abs(g - first) <= 1) ? first : null;
}

function paletteOf(data: ImageData, max = 6): string[] {
  const counts = new Map<number, number>();
  const { data: px } = data;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 128) continue;
    // Quantise to 4 bits per channel so near-identical shades group together.
    const key = ((px[i] >> 4) << 8) | ((px[i + 1] >> 4) << 4) | (px[i + 2] >> 4);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([key]) => {
      const r = ((key >> 8) & 0xf) * 17;
      const g = ((key >> 4) & 0xf) * 17;
      const b = (key & 0xf) * 17;
      return '#' + [r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('');
    });
}

export function analyzeSheet(
  name: string,
  image: ImageBitmap | HTMLImageElement,
): SheetReading {
  const data = readPixels(image);
  const { width, height } = data;

  let frameWidth = width;
  let frameHeight = height;
  let method: SheetReading['method'] = 'whole image';

  const { cols, rows } = emptyLines(data);
  const pitchX = pitchFrom(cols);
  const pitchY = pitchFrom(rows);

  if (pitchX && pitchY && pitchX > 3 && pitchY > 3) {
    frameWidth = pitchX;
    frameHeight = pitchY;
    method = 'transparent gutters';
  } else {
    // Packed sheets have no gutters: fall back to the largest square frame
    // size that divides both dimensions evenly and leaves more than one frame.
    const size = CANDIDATE_SIZES.find(
      (s) => width % s === 0 && height % s === 0 && (width / s) * (height / s) > 1,
    );
    if (size) {
      frameWidth = size;
      frameHeight = size;
      method = 'even division';
    }
  }

  const columns = Math.max(1, Math.round(width / frameWidth));
  const rowCount = Math.max(1, Math.round(height / frameHeight));

  return {
    name,
    width,
    height,
    frameWidth,
    frameHeight,
    columns,
    rows: rowCount,
    frames: columns * rowCount,
    palette: paletteOf(data),
    method,
  };
}

/** Decode a File into something `analyzeSheet` can read. */
export async function decodeImage(file: File | Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') return createImageBitmap(file);
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Could not decode the image'));
      img.src = url;
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}

/** Crop of the source image the user chose, as a data URI for image-to-3D. */
export async function cropToDataUrl(
  image: ImageBitmap | HTMLImageElement,
  rect: { x: number; y: number; w: number; h: number },
): Promise<string> {
  const w = Math.max(1, Math.round(rect.w));
  const h = Math.max(1, Math.round(rect.h));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not crop the image — no 2D canvas available');
  ctx.drawImage(image as CanvasImageSource, rect.x, rect.y, rect.w, rect.h, 0, 0, w, h);
  return canvas.toDataURL('image/png');
}
