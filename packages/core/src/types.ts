/**
 * Shared data model. Every number here is measured from a real file — triangle
 * and material counts and the bounding box come from the generated GLB, and
 * clip names are the animation tracks the file actually contains.
 */

import type { ProviderId } from './providers/types.js';

export type Category =
  | 'Creature'
  | 'Character'
  | 'Prop'
  | 'Vehicle'
  | 'Environment'
  | 'Weapon'
  | 'Modular kit';

export type Kind =
  | 'creature'
  | 'character'
  | 'prop'
  | 'vehicle'
  | 'environment'
  | 'weapon'
  | 'kit';

export type DeviceKind = 'desktop' | 'android';

export type ClipStatus = 'approved' | 'review' | 'rework';

/** What the mesh is made of, read from the GLB after download. */
export interface MeshStats {
  triangles: number;
  materials: number;
  /** Largest bounding-box dimension, in metres, as authored. */
  sizeMeters: number;
  /** Animation track names found in the file. */
  clipNames: string[];
  /** Size of the GLB on disk, in bytes. */
  bytes: number;
}

export interface AssetVersion {
  label: string; // v1, v2, …
  note: string;
  prompt: string;
  device: DeviceKind;
  createdAt: number;
  stats: MeshStats;
  /** Key into the app's BlobStore, where the GLB is cached on this device. */
  fileId?: string;
  /** Provider URL the model was downloaded from. */
  sourceUrl?: string;
  provider?: ProviderId;
  /** Provider task this version came from; rigging needs it as its input. */
  taskId?: string;
  /** Set once the model has been rigged, so clips can be baked onto it. */
  riggedTaskId?: string;
}

export interface AssetClip {
  /** The animation track's own name from the GLB. */
  name: string;
  status: ClipStatus;
}

export interface Asset {
  id: string;
  name: string;
  category: Category;
  kind: Kind;
  device: DeviceKind;
  createdAt: number;
  updatedAt: number;
  /** index of the displayed version */
  cur: number;
  versions: AssetVersion[];
  clips: AssetClip[];
}

export type EditorMode = 'Model' | 'Sculpt' | 'Paint' | 'Rig' | 'Animate' | 'LOD';

export type EnginePreset = {
  name: 'Unity' | 'Unreal' | 'Godot' | 'Roblox' | 'VRM' | 'Raw';
  format: string;
  axis: string;
};

/** Metadata carried alongside a store commit so clients can toast remote edits. */
export interface SyncMeta {
  from?: DeviceKind;
  msg?: string;
  remote?: boolean;
}

export const emptyStats = (): MeshStats => ({
  triangles: 0,
  materials: 0,
  sizeMeters: 0,
  clipNames: [],
  bytes: 0,
});
