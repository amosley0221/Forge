import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  ANIMS,
  COLORS,
  ENGINES,
  KINDS,
  STYLES,
  matchAnimWord,
  nameFrom,
  randomTris,
} from '@forge/core';
import type { Asset, Category, ClipName, EditorMode, EnginePreset } from '@forge/core';
import { useForge } from '@forge/ui';

export interface Defaults {
  guide: boolean;
  triBudget: number;
  style: string;
  engineIdx: number;
  textureSize: string;
}

const DEFAULTS: Defaults = {
  guide: true,
  triBudget: 20000,
  style: 'toon',
  engineIdx: 0,
  textureSize: '2K PNG · packed ORM',
};

/**
 * Desktop session: the shared store plus everything only the desktop app
 * needs — editor mode, selection, viewport toggles and the modal stack.
 */
export function useSession() {
  const forge = useForge({ device: 'desktop', syncedLabel: 'Synced · Android' });

  const [screen, setScreen] = useState<'start' | 'editor'>('start');
  const [mode, setMode] = useState<EditorMode>('Model');
  const [tool, setTool] = useState(0);
  const [prompt, setPrompt] = useState('');
  const [category, setCategory] = useState<Category>('Creature');
  const [filter, setFilter] = useState('All');
  const [selected, setSelected] = useState<string | null>(null);
  const [wire, setWire] = useState(false);
  const [turntable, setTurntable] = useState(true);
  const [anim, setAnim] = useState<ClipName>('idle');
  const [speed, setSpeed] = useState(1);
  const [reviewing, setReviewing] = useState(false);
  const [lastReply, setLastReply] = useState('');
  const [brush, setBrush] = useState(40);
  const [defaults, setDefaults] = useState<Defaults>(DEFAULTS);
  const [modal, setModal] = useState<null | 'sprites' | 'photo' | 'camera' | 'settings'>(null);
  const [exportOpen, setExportOpen] = useState(false);

  const { active, runJob, newAsset, addVersion, setClipStatus, say, setActiveId } = forge;
  const engine: EnginePreset = ENGINES[defaults.engineIdx];
  const kind = active?.kind ?? 'prop';
  const clips = ANIMS[kind] ?? ['idle'];
  const curVersion = active?.versions[active.cur];

  const openAsset = useCallback(
    (id: string) => {
      const a = forge.assets.find((x) => x.id === id);
      setActiveId(id);
      setScreen('editor');
      setPrompt('');
      setLastReply('');
      setAnim('idle');
      setReviewing(false);
      setMode('Model');
      setTool(0);
      setSelected(null);
      if (a) setCategory(a.category);
    },
    [forge.assets, setActiveId],
  );

  const goStart = useCallback(() => {
    setScreen('start');
    setPrompt('');
    setLastReply('');
    setReviewing(false);
    setAnim('idle');
  }, []);

  const generateClip = useCallback(
    (name: ClipName, asset?: Asset | null) => {
      const a = asset ?? active;
      if (!a) return;
      runJob(`Show ${a.name} ${name === 'drive' ? 'driving' : name === 'idle' ? 'idling' : name + 'ing'}`, () => {
        setClipStatus(a, name, 'review', `${a.name}: ${name} clip generated on desktop`);
        setMode('Animate');
        setTool(0);
        setAnim(name);
        setReviewing(true);
        setPrompt('');
        setLastReply(
          `Generated a ${name} loop from the rig${a.kind === 'creature' ? ' and the sprite cycle' : ''}. Orbit around it — does it read right? Say "Looks good" or tell me what's off.`,
        );
      });
    },
    [active, runJob, setClipStatus],
  );

  /**
   * One entry point for both the start-screen Generate button and the editor
   * prompt bar. Motion verbs route to clip generation, a rework note re-runs
   * the clip under review, anything else appends a version.
   */
  const submitPrompt = useCallback(() => {
    const p = prompt.trim();
    if (!p) {
      say('Describe what to make first — or pick a suggestion');
      return;
    }
    const low = p.toLowerCase();

    if (screen === 'editor' && active) {
      const word = matchAnimWord(low);
      const intent = /show|see|play|preview|animate|make it|let me/.test(low);
      if (word && (intent || (clips.includes(word) && low.split(' ').length <= 4))) {
        const clip = clips.includes(word) ? word : clips[1] ?? 'idle';
        setPrompt('');
        generateClip(clip);
        return;
      }
      if (mode === 'Animate' && reviewing) {
        const clip = anim;
        runJob(`Rework ${clip}: ${p}`, () => {
          setClipStatus(active, clip, 'review', `${active.name}: ${clip} reworked on desktop`);
          setPrompt('');
          setReviewing(true);
          setLastReply(`Updated the ${clip} loop — "${p}". Check it again.`);
        });
        return;
      }
      runJob(p, () => {
        const nextLabel = 'v' + (active.versions.length + 1);
        addVersion(
          active,
          {
            mats: (curVersion?.mats ?? 1) + (low.includes('decal') ? 1 : 0),
            note: selected ? 'edit on ' + selected : 'prompt edit',
            prompt: p,
          },
          `${active.name} ${nextLabel} created on desktop`,
        );
        setPrompt('');
        setSelected(null);
        setLastReply(
          `Done → ${nextLabel}. Applied "${p}"${selected ? ' to ' + selected : ''}. Nothing else was touched.`,
        );
      });
      return;
    }

    runJob(p, () => {
      const name = nameFrom(p);
      const k = KINDS[category] ?? 'prop';
      const created = newAsset({
        name,
        category,
        kind: k,
        variant: Math.floor(Math.random() * 5),
        tris: randomTris(),
        note: 'generated from prompt',
        size: k === 'vehicle' ? '3.4 m' : k === 'creature' ? '0.8 m' : '1.8 m',
        prompt: p,
        anims: k === 'environment' ? [] : [{ name: 'idle', status: 'approved' }],
      });
      openAsset(created.id);
      setLastReply(
        `Built ${name} — ${k === 'creature' || k === 'character' ? 'rigged, ' : ''}UVs unwrapped, pivot at ground. Ask "show me it walking" to generate motion.`,
      );
    });
  }, [
    prompt,
    screen,
    active,
    clips,
    mode,
    reviewing,
    anim,
    curVersion,
    selected,
    category,
    runJob,
    say,
    generateClip,
    setClipStatus,
    addVersion,
    newAsset,
    openAsset,
  ]);

  return {
    ...forge,
    screen,
    setScreen,
    mode,
    setMode,
    tool,
    setTool,
    prompt,
    setPrompt,
    category,
    setCategory,
    filter,
    setFilter,
    selected,
    setSelected,
    wire,
    setWire,
    turntable,
    setTurntable,
    anim,
    setAnim,
    speed,
    setSpeed,
    reviewing,
    setReviewing,
    lastReply,
    setLastReply,
    brush,
    setBrush,
    defaults,
    setDefaults,
    modal,
    setModal,
    exportOpen,
    setExportOpen,
    engine,
    kind,
    clips,
    curVersion,
    openAsset,
    goStart,
    generateClip,
    submitPrompt,
    styles: STYLES,
    colors: COLORS,
  };
}

export type Session = ReturnType<typeof useSession>;

const Ctx = createContext<Session | null>(null);

export function SessionProvider({ value, children }: { value: Session; children: ReactNode }) {
  const memo = useMemo(() => value, [value]);
  return <Ctx.Provider value={memo}>{children}</Ctx.Provider>;
}

export function useSessionCtx(): Session {
  const s = useContext(Ctx);
  if (!s) throw new Error('useSessionCtx must be used inside <SessionProvider>');
  return s;
}
