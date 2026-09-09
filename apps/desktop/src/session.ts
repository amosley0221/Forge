import { useCallback, useMemo, useState } from 'react';
import { ANIM_WORDS } from '@forge/core';
import type { Category, EditorMode } from '@forge/core';
import { useForge } from '@forge/ui';
import { desktopBlobs, desktopSecrets, desktopStore } from './storage.js';

export const looksLikeMotion = (prompt: string) => {
  const low = prompt.toLowerCase();
  return ANIM_WORDS.some((w) => new RegExp(`\\b${w}\\b`).test(low));
};

export function useSession() {
  const store = useMemo(() => desktopStore(), []);
  const secrets = useMemo(() => desktopSecrets(), []);
  const blobs = useMemo(() => desktopBlobs(), []);

  const forge = useForge({ device: 'desktop', store, secrets, blobs });

  const [screen, setScreen] = useState<'start' | 'editor'>('start');
  const [mode, setMode] = useState<EditorMode>('Model');
  const [prompt, setPrompt] = useState('');
  const [category, setCategory] = useState<Category>('Creature');
  const [selected, setSelected] = useState<string | null>(null);
  const [wire, setWire] = useState(false);
  // Kept in settings rather than component state so the choice survives a
  // restart — it used to switch itself back on every launch.
  const turntable = forge.settings.turntable;
  const setTurntable = (on: boolean) => void forge.updateSettings({ turntable: on });
  const [clip, setClip] = useState<string | null>(null);
  const [speed, setSpeed] = useState(1);
  const [reviewing, setReviewing] = useState(false);
  const [lastReply, setLastReply] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const { active, generate, say } = forge;

  const openAsset = useCallback(
    (id: string) => {
      forge.setActiveId(id);
      setScreen('editor');
      setMode('Model');
      setPrompt('');
      setLastReply('');
      setClip(null);
      setSelected(null);
      setReviewing(false);
    },
    [forge],
  );

  const goStart = useCallback(() => {
    setScreen('start');
    setPrompt('');
    setLastReply('');
    setClip(null);
  }, []);

  /**
   * Build a model from a picture instead of a description. The prompt box is
   * still read, as an optional note — "the character on the left", "make the
   * cape red" — because the provider takes both.
   */
  const generateFromImage = useCallback(
    async (imageUrl: string) => {
      if (!forge.canGenerate) {
        say('Connect a 3D provider in Settings to generate.');
        return;
      }
      const note = prompt.trim();
      const result = await generate({
        prompt: note || 'the subject of this image',
        category,
        imageUrl,
      });
      if (!result) return;
      setPrompt('');
      openAsset(result.id);
      setLastReply(
        `Built ${result.name} from your image — ${result.versions[0].stats.triangles.toLocaleString()} triangles.`,
      );
    },
    [forge.canGenerate, prompt, category, generate, say, openAsset],
  );

  const submitPrompt = useCallback(async () => {
    const text = prompt.trim();
    if (!text) {
      say('Describe what to make first.');
      return;
    }
    if (!forge.canGenerate) {
      say('Connect a 3D provider in Settings to generate.');
      return;
    }
    if (screen === 'editor' && active && looksLikeMotion(text)) {
      say('Motion comes from Rig & animate in the Animate tab.');
      return;
    }

    const target = screen === 'editor' ? (active ?? undefined) : undefined;
    const result = await generate({
      prompt: text,
      category: target?.category ?? category,
      target,
      note: selected ? `edit on ${selected}` : 'prompt edit',
    });
    if (!result) return;

    setPrompt('');
    setSelected(null);
    const label = result.versions[result.cur].label;
    if (target) {
      setLastReply(
        `Built ${label} from "${text}". The earlier versions are still in the history strip.`,
      );
    } else {
      openAsset(result.id);
      setLastReply(
        `Built ${result.name} — ${result.versions[0].stats.triangles.toLocaleString()} triangles. Rig it to add motion.`,
      );
    }
  }, [prompt, screen, active, category, selected, forge.canGenerate, generate, say, openAsset]);

  return {
    ...forge,
    screen,
    setScreen,
    mode,
    setMode,
    prompt,
    setPrompt,
    category,
    setCategory,
    selected,
    setSelected,
    wire,
    setWire,
    turntable,
    setTurntable,
    clip,
    setClip,
    speed,
    setSpeed,
    reviewing,
    setReviewing,
    lastReply,
    setLastReply,
    settingsOpen,
    setSettingsOpen,
    exportOpen,
    setExportOpen,
    openAsset,
    goStart,
    submitPrompt,
    generateFromImage,
  };
}

export type Session = ReturnType<typeof useSession>;
