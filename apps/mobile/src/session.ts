import { useCallback, useState } from 'react';
import { ANIMS, matchAnimWord, uid } from '@forge/core';
import type { Asset, ClipName } from '@forge/core';
import { useForge } from '@forge/ui';

export type Tab = 'Library' | 'Asset' | 'Capture' | 'Export';

/**
 * Android session. Same store and same mutations as the desktop app — the
 * difference is only which surfaces exist here (no editor modes, no LODs).
 */
export function useMobileSession() {
  const forge = useForge({ device: 'android', syncedLabel: 'Synced with desktop' });

  const [tab, setTab] = useState<Tab>('Library');
  const [filter, setFilter] = useState('All');
  const [prompt, setPrompt] = useState('');
  const [anim, setAnim] = useState<ClipName>('idle');
  const [reviewing, setReviewing] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [lastReply, setLastReply] = useState('');
  const [engineIdx, setEngineIdx] = useState(0);

  const { active, runJob, setClipStatus, addVersion, upsert, say } = forge;
  const kind = active?.kind ?? 'prop';
  const clips = ANIMS[kind] ?? ['idle'];
  const cur = active?.versions[active.cur];

  const open = useCallback(
    (id: string) => {
      forge.setActiveId(id);
      setTab('Asset');
      setAnim('idle');
      setReviewing(false);
      setSelected(null);
      setPrompt('');
      setLastReply('');
    },
    [forge],
  );

  const generateClip = useCallback(
    (name: ClipName, asset?: Asset | null) => {
      const a = asset ?? active;
      if (!a) return;
      runJob(`Show ${a.name} ${name}ing`, () => {
        setClipStatus(a, name, 'review', `${a.name}: ${name} clip generated on Android`);
        setAnim(name);
        setReviewing(true);
        setPrompt('');
        setLastReply(`Here's the ${name} loop. Orbit around it — good, or needs work?`);
      });
    },
    [active, runJob, setClipStatus],
  );

  const submitPrompt = useCallback(() => {
    const p = prompt.trim();
    if (!p || !active) return;
    const word = matchAnimWord(p);
    if (word && clips.includes(word)) {
      generateClip(word);
      return;
    }
    if (reviewing) {
      const clip = anim;
      runJob(`Rework ${clip}: ${p}`, () => {
        setClipStatus(active, clip, 'review', `${active.name}: ${clip} reworked on Android`);
        setPrompt('');
        setLastReply(`Updated the ${clip} — "${p}". Check it again.`);
      });
      return;
    }
    runJob(p, () => {
      const label = 'v' + (active.versions.length + 1);
      addVersion(
        active,
        { note: selected ? 'edit on ' + selected : 'prompt edit', prompt: p },
        `${active.name} ${label} created on Android`,
      );
      setPrompt('');
      setSelected(null);
      setLastReply(
        `Done → ${label}. "${p}" applied${selected ? ' to ' + selected : ''}. It's on your desktop too.`,
      );
    });
  }, [prompt, active, clips, reviewing, anim, selected, runJob, generateClip, setClipStatus, addVersion]);

  /** A capture becomes a `device: 'android'` asset that shows up on desktop. */
  const createFromCapture = useCallback(
    (subject: { name: string; size: string }, note: string) => {
      const name = subject.name.toLowerCase().replace(/\s+/g, '_');
      runJob(`${subject.name} from camera${note ? ' — ' + note : ''}`, () => {
        const asset: Asset = {
          id: uid(),
          name,
          category: 'Prop',
          kind: 'prop',
          variant: 1,
          device: 'android',
          updatedAt: Date.now(),
          cur: 0,
          anims: [{ name: 'idle', status: 'approved' }],
          versions: [
            {
              label: 'v1',
              tris: '2,840',
              mats: 1,
              note: 'from camera',
              size: subject.size,
              prompt: `${subject.name} from camera`,
              device: 'android',
            },
          ],
        };
        upsert(asset, `${name} captured on Android`);
        open(asset.id);
        setLastReply(`Built ${name} from your photo — it's already in the desktop library.`);
      });
    },
    [runJob, upsert, open],
  );

  const goTab = useCallback(
    (next: Tab) => {
      if ((next === 'Asset' || next === 'Export') && !active) {
        say('Pick an asset from the library first');
        return;
      }
      setTab(next);
    },
    [active, say],
  );

  return {
    ...forge,
    tab,
    setTab,
    goTab,
    filter,
    setFilter,
    prompt,
    setPrompt,
    anim,
    setAnim,
    reviewing,
    setReviewing,
    selected,
    setSelected,
    lastReply,
    setLastReply,
    engineIdx,
    setEngineIdx,
    kind,
    clips,
    cur,
    open,
    generateClip,
    submitPrompt,
    createFromCapture,
  };
}

export type MobileSession = ReturnType<typeof useMobileSession>;
