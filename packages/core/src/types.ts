/**
 * Shared data model. Mirrors the handoff spec (design/forge-store.js) so the
 * desktop app, the Android companion and the server all agree on shapes.
 */

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

export type ClipName = 'idle' | 'walk' | 'run' | 'drive' | 'attack' | 'hurt' | 'spin';

export type ClipStatus = 'approved' | 'review' | 'rework';

export interface AssetVersion {
  label: string; // v1, v2, …
  tris: string;
  mats: number;
  note: string;
  size: string;
  prompt: string;
  device: DeviceKind;
  fileUrl?: string;
}

export interface AssetClip {
  name: ClipName;
  status: ClipStatus;
  clipUrl?: string;
}

export interface Asset {
  id: string;
  name: string;
  category: Category;
  kind: Kind;
  variant?: number;
  device: DeviceKind;
  updatedAt: number;
  /** index of the displayed version */
  cur: number;
  versions: AssetVersion[];
  anims?: AssetClip[];
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

/* ------------------------------------------------------------------ *
 * Agent contract (server-side). See docs/ARCHITECTURE.md.
 * ------------------------------------------------------------------ */

export type AttachmentType = 'photo' | 'sprite_sheet';

export interface AgentAttachment {
  type: AttachmentType;
  url: string;
}

export interface AgentDefaults {
  engine: EnginePreset['name'];
  style: string;
  triBudget: number;
  textureSize: number;
}

export interface AgentRequest {
  projectId: string;
  assetId?: string;
  selectedPart?: string | null;
  mode: EditorMode;
  prompt: string;
  attachments?: AgentAttachment[];
  defaults: AgentDefaults;
}

export type JobStage =
  | 'understanding'
  | 'shape'
  | 'retopo_uv'
  | 'texturing'
  | 'checks';

export interface JobProgress {
  jobId: string;
  stage: JobStage;
  percent: number;
}

export interface AgentQuestion {
  question: string;
  options: { id: string; label: string; meta?: string }[];
}

export interface AgentResponse {
  /** ≤ 2 sentences; names the parts touched and offers a next step. */
  reply: string;
  version?: AssetVersion;
  clip?: AssetClip;
  question?: AgentQuestion;
}

export interface DetectedSubject {
  name: string;
  bbox: { x: number; y: number; w: number; h: number };
  confidence: number;
  sizeEstimate: string;
  kind: Kind;
}

export interface SpriteSheetReading {
  frameSize: string;
  directions: number;
  frames: number;
  cycles: ClipName[];
  palette: string[];
  bodyType: 'quadruped' | 'humanoid' | 'generic';
}

export interface GameReadyChecks {
  watertight: boolean;
  uvOverlap: boolean;
  scale: boolean;
  boneCount: number;
  materials: number;
}
