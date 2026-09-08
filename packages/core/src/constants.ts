import type { Category, EditorMode, EnginePreset, Kind } from './types.js';

/** Design tokens — the only palette either app is allowed to use. */
export const COLORS = {
  canvas: '#0d0e11',
  surface: '#16171a',
  panel: '#1b1c20',
  raised: '#22242a',
  control: '#2a2c31',
  input: '#101114',
  hairline: 'rgba(255,255,255,.08)',
  panelBorder: 'rgba(255,255,255,.10)',
  inputBorder: 'rgba(255,255,255,.14)',
  text: '#e6e4df',
  text2: '#b9b7b1',
  muted: '#8b8a86',
  disabled: '#4a4c52',
  accent: '#F59E3B',
  accentHover: '#ffb866',
  ink: '#1a1200',
  accentTint: 'rgba(245,158,59,.08)',
  accentTint2: 'rgba(245,158,59,.15)',
  accentBorder: 'rgba(245,158,59,.25)',
  accentBorder2: 'rgba(245,158,59,.5)',
  ok: '#34C77B',
  onOk: '#062b17',
  okTint: 'rgba(52,199,123,.15)',
  danger: '#ff5f57',
  light: '#e6e4df',
  lightInk: '#16171a',
} as const;

export const CATEGORIES: Category[] = [
  'Creature',
  'Character',
  'Prop',
  'Vehicle',
  'Environment',
  'Weapon',
  'Modular kit',
];

export const KINDS: Record<Category, Kind> = {
  Character: 'character',
  Creature: 'creature',
  Prop: 'prop',
  Vehicle: 'vehicle',
  Environment: 'environment',
  Weapon: 'weapon',
  'Modular kit': 'kit',
};

export const MODES: EditorMode[] = ['Model', 'Sculpt', 'Paint', 'Rig', 'Animate', 'LOD'];

/** [abbreviation, label] — replace abbreviations with 16px stroke icons. */
export const TOOLS: Record<EditorMode, [string, string][]> = {
  Model: [
    ['SEL', 'Select'],
    ['MOV', 'Move'],
    ['ROT', 'Rotate'],
    ['SCL', 'Scale'],
    ['CUT', 'Split mesh'],
  ],
  Sculpt: [
    ['CLY', 'Clay'],
    ['SMO', 'Smooth'],
    ['INF', 'Inflate'],
    ['CRS', 'Crease'],
    ['GRB', 'Grab'],
  ],
  Paint: [
    ['BRS', 'Brush'],
    ['FIL', 'Fill'],
    ['DEC', 'Decal'],
    ['SMU', 'Smudge'],
    ['ERS', 'Erase'],
  ],
  Rig: [
    ['BON', 'Add bone'],
    ['WGT', 'Weight paint'],
    ['POS', 'Pose'],
    ['MIR', 'Mirror'],
    ['IKS', 'IK setup'],
  ],
  Animate: [
    ['PLY', 'Play / pause'],
    ['KEY', 'Keyframe'],
    ['CRV', 'Curves'],
    ['RTG', 'Retarget'],
    ['CAM', 'Camera path'],
  ],
  LOD: [
    ['DEC', 'Decimate'],
    ['PRV', 'Preview LOD'],
    ['DST', 'Distance'],
    ['BAK', 'Bake'],
    ['CMP', 'Compare'],
  ],
};

/** Guide copy: [title, body, suggestions]. Final copy — reuse verbatim. */
export const GUIDE: Record<EditorMode, [string, string, string[]]> = {
  Model: [
    'Model mode',
    'Move, rotate and scale parts, or split the mesh. Click a part in the 3D view to select it; then drag with a tool or just ask for the change in the bar below.',
    ['Make the head 20% bigger', 'Split the tail into its own part', 'Center the pivot at the ground'],
  ],
  Sculpt: [
    'Sculpt mode',
    'Push and pull the surface like clay. Start with a large, soft brush for shape, then go smaller for detail. Symmetry keeps both sides matched.',
    ['Add dents and scrapes', 'Smooth out the back', 'Make the silhouette chunkier'],
  ],
  Paint: [
    'Paint mode',
    'Paint directly on the model. Fill picks a whole part; Decal stamps an image. The palette was pulled from your sprite pixels.',
    ['Add darker stripes on the back', 'Brighten the belly', 'Give the eyes a highlight'],
  ],
  Rig: [
    'Rig mode',
    'A rig lets the model animate in your engine. Forge builds a standard skeleton automatically — check it moves right with Pose, then fix weights where it stretches.',
    ['Auto-rig as a quadruped', 'Add a tail chain with 4 bones', 'Test a jump pose'],
  ],
  Animate: [
    'Animate mode',
    "Ask for a motion and Forge generates the clip; play it, orbit around it, then say if it's good or needs work. Approved clips ship with the export.",
    ['Show me it walking', 'Show me it running', 'Make the run bouncier and faster'],
  ],
  LOD: [
    'LOD mode',
    'LODs are lighter copies shown far from the camera. Four levels are typical; each roughly halves the triangle count. Preview to check nothing important vanishes.',
    ['Generate 4 LOD levels', 'Keep the ears visible until LOD2', 'Target 800 tris at LOD3'],
  ],
};

export const ENGINES: EnginePreset[] = [
  { name: 'Unity', format: 'FBX 2020', axis: 'Y-up · m' },
  { name: 'Unreal', format: 'FBX 2020', axis: 'Z-up · cm' },
  { name: 'Godot', format: 'GLB', axis: 'Y-up · m' },
  { name: 'Roblox', format: 'OBJ', axis: 'Y-up · studs' },
  { name: 'VRM', format: 'VRM 1.0', axis: 'Y-up · m' },
  { name: 'Raw', format: 'GLB + PNG', axis: 'Y-up · m' },
];

export const STARTERS = [
  'Fire-type fox creature, chunky proportions, big eyes, toon shading, for a monster-collecting RPG',
  'Rusty six-wheeled desert rover, low-poly, hand-painted, top-down survival game',
  'Modular sandstone wall kit — 3 straight pieces, 1 corner, 1 gate',
];

/** Motion words that mean "play a clip" rather than "change the model". */
export const ANIM_WORDS = [
  'idle',
  'walk',
  'walking',
  'run',
  'running',
  'sprint',
  'drive',
  'driving',
  'attack',
  'attacking',
  'bite',
  'hurt',
  'hit',
  'spin',
  'rotate',
  'breathe',
];

export const STYLES = ['toon', 'hand-painted', 'low-poly', 'realistic PBR', 'voxel'];
