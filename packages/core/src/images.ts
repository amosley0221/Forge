/**
 * Getting a picture into a shape a provider will accept.
 *
 * Image-to-3D takes the image inline as a data URI, so the file goes over the
 * wire base64-encoded — a third larger than it already was. A photo straight
 * off a phone or a camera is several megabytes before that, which is slow at
 * best and rejected at worst, and none of that size buys any detail: the
 * providers work from a modest square. So everything is scaled down first.
 */

/** Longest edge, in pixels, that actually helps the reconstruction. */
export const PROVIDER_IMAGE_EDGE = 1024;

export interface PreparedImage {
  dataUrl: string;
  width: number;
  height: number;
  /** Approximate bytes on the wire, base64 included. */
  bytes: number;
}

const decode = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('That file could not be read as an image'));
    img.src = src;
  });

export const fileToDataUrl = (file: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read that file'));
    reader.readAsDataURL(file);
  });

/**
 * Scale so the longest edge is at most `maxEdge`, and re-encode.
 *
 * PNG sources keep their alpha: a cut-out subject on a transparent background
 * is the single biggest thing that improves an image-to-3D result, so throwing
 * it away to save bytes would be a bad trade. Everything else becomes JPEG.
 */
export async function prepareImage(
  source: Blob | string,
  maxEdge = PROVIDER_IMAGE_EDGE,
): Promise<PreparedImage> {
  const original = typeof source === 'string' ? source : await fileToDataUrl(source);
  const img = await decode(original);

  const longest = Math.max(img.naturalWidth, img.naturalHeight);
  if (!longest) throw new Error('That image has no size');
  const scale = Math.min(1, maxEdge / longest);
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not prepare the image — no 2D canvas available');
  ctx.drawImage(img, 0, 0, width, height);

  const keepAlpha = original.startsWith('data:image/png') || original.startsWith('data:image/webp');
  const dataUrl = keepAlpha ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.9);

  return { dataUrl, width, height, bytes: Math.round((dataUrl.length * 3) / 4) };
}
