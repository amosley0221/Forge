import { ANIM_WORDS } from './constants.js';
import type { Asset, ClipName } from './types.js';

export const uid = () => 'a' + Math.random().toString(36).slice(2, 8);

/** Derive a snake_case asset name from the prompt, as the prototype does. */
export function nameFrom(p: string): string {
  return (
    p
      .split(/[,.\n—-]/)[0]
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !['the', 'and', 'with', 'for'].includes(w))
      .slice(0, 2)
      .join('_') || 'asset'
  );
}

export function ago(t: number): string {
  const d = Math.max(0, Date.now() - t) / 1000;
  if (d < 60) return 'just now';
  if (d < 3600) return Math.floor(d / 60) + 'm ago';
  if (d < 86400) return Math.floor(d / 3600) + 'h ago';
  return Math.floor(d / 86400) + 'd ago';
}

/** First motion verb in the prompt, if any. */
export function matchAnimWord(prompt: string): ClipName | null {
  const low = prompt.toLowerCase();
  const key = Object.keys(ANIM_WORDS).find((k) => new RegExp('\\b' + k + '\\b').test(low));
  return key ? ANIM_WORDS[key] : null;
}

/** A plausible triangle count string, used until a real mesh reports its own. */
export function randomTris(min = 6, span = 12): string {
  return (
    (Math.floor(Math.random() * span) + min).toLocaleString() +
    ',' +
    String(Math.floor(Math.random() * 900) + 100)
  );
}

export const reviewCount = (a: Asset | null | undefined) =>
  (a?.anims || []).filter((c) => c.status === 'review').length;

export const approvedCount = (a: Asset | null | undefined) =>
  (a?.anims || []).filter((c) => c.status === 'approved').length;

export const gerund = (clip: ClipName): string =>
  clip === 'drive' ? 'driving' : clip === 'idle' ? 'idling' : clip + 'ing';
