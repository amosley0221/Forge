import { useCallback, useMemo, useState } from 'react';
import { ANIM_WORDS } from '@forge/core';
import type { Asset, Category } from '@forge/core';
import { useForge } from '@forge/ui';
import { filesystemBlobStore, preferencesStore, secretStore } from './storage.js';

export type Tab = 'Library' | 'Asset' | 'Capture' | 'Export';

/** True when the prompt is asking to play motion rather than change the mesh. */
export const looksLikeMotion = (prompt: string) => {
  const low = prompt.toLowerCase();
  return ANIM_WORDS.some((w) => new RegExp(`\\b${w}\\b`).test(low));
};

export function useMobileSession() {
  const store = useMemo(() => preferencesStore(), []);
  const secrets = useMemo(() => secretStore(), []);
  const blobs = useMemo(() => filesystemBlobStore(), []);

  const forge = useForge({ device: 'android', store, secrets, blobs });

  const [tab, setTab] = useState<Tab>('Library');
  const [filter, setFilter] = useState<'All' | 'Needs review'>('All');
  const [prompt, setPrompt] = useState('');
  const [category, setCategory] = useState<Category>('Prop');
  const [clip, setClip] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [lastReply, setLastReply] = useState('');
  const [engineIdx, setEngineIdx] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const { active, generate, say } = forge;

  const open = useCallback(
    (id: string) => {
      forge.setActiveId(id);
      setTab('Asset');
      setClip(null);
      setSelected(null);
      setReviewing(false);
      setPrompt('');
      setLastReply('');
    },
    [forge],
  );

  const goTab = useCallback(
    (next: Tab) => {
      if ((next === 'Asset' || next === 'Export') && !active) {
        say('Open an asset from your library first');
        return;
      }
      setTab(next);
    },
    [active, say],
  );

  /** Prompt on the asset screen makes a new version of that asset. */
  const submitPrompt = useCallback(async () => {
    const text = prompt.trim();
    if (!text) return;
    if (!forge.canGenerate) {
      say('Connect a 3D provider in Settings to generate.');
      return;
    }
    if (active && looksLikeMotion(text)) {
      say('Motion comes from Rig & animate on the asset screen.');
      return;
    }
    const result = await generate({
      prompt: text,
      category: active?.category ?? category,
      target: active ?? undefined,
      note: selected ? `edit on ${selected}` : 'prompt edit',
    });
    if (result) {
      setPrompt('');
      setSelected(null);
      const label = result.versions[result.cur].label;
      setLastReply(
        active
          ? `Built ${label} from "${text}". Your earlier versions are still in the history below.`
          : `Built ${result.name}. It is in your library on every signed-in device.`,
      );
      if (!active) open(result.id);
    }
  }, [prompt, active, category, selected, forge.canGenerate, generate, say, open]);

  const currentAsset: Asset | null = active;

  return {
    ...forge,
    tab,
    setTab,
    goTab,
    filter,
    setFilter,
    prompt,
    setPrompt,
    category,
    setCategory,
    clip,
    setClip,
    selected,
    setSelected,
    reviewing,
    setReviewing,
    lastReply,
    setLastReply,
    engineIdx,
    setEngineIdx,
    settingsOpen,
    setSettingsOpen,
    open,
    submitPrompt,
    currentAsset,
  };
}

export type MobileSession = ReturnType<typeof useMobileSession>;
