import { meshy } from './meshy.js';
import { tripo } from './tripo.js';
import type { GenerationProvider, ProviderId } from './types.js';

export * from './types.js';
export { meshy, meshyRawTaskId } from './meshy.js';
export { tripo } from './tripo.js';
export * from './meshy-rig.js';

export const PROVIDERS: GenerationProvider[] = [meshy, tripo];

export function providerById(id: ProviderId | null | undefined): GenerationProvider | null {
  return PROVIDERS.find((p) => p.id === id) ?? null;
}
