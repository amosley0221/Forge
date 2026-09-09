import { useCallback, useEffect, useState } from 'react';
import { COLORS, formatTris } from '@forge/core';
import type { Asset } from '@forge/core';
import { Spinner, mono } from './components.js';
import type { MeshPart } from './viewer/meshedit.js';
import type { ViewerEngine } from './viewer/engine.js';

const A = COLORS.accent;

export interface MeshToolsProps {
  asset: Asset;
  engine: ViewerEngine | null;
  busy: boolean;
  /** Store an edited GLB as a new version. */
  onApply: (blob: Blob, note: string) => Promise<unknown>;
  say: (text: string) => void;
  compact?: boolean;
}

/**
 * The handful of mesh edits a generated model actually needs, done here rather
 * than in a round trip through Blender.
 *
 * Nothing in this panel talks to the provider, so nothing here costs credits —
 * it all works on the geometry already loaded, and every change lands as a new
 * version with the old one still in the history.
 */
export function MeshTools({ asset, engine, busy, onApply, say, compact }: MeshToolsProps) {
  const [parts, setParts] = useState<MeshPart[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [keep, setKeep] = useState(0.5);
  const [working, setWorking] = useState(false);
  const [morphs, setMorphs] = useState<{ name: string; value: number }[]>([]);

  const scan = useCallback(() => {
    if (!engine) return;
    setParts(engine.parts());
    setSelected(new Set());
  }, [engine]);

  // Blend shapes belong to the file, so re-read them whenever it changes.
  useEffect(() => {
    setParts(null);
    setSelected(new Set());
    setMorphs(engine?.morphTargets() ?? []);
  }, [engine, asset.cur, asset.id]);

  const run = async (make: () => Promise<Blob | null>, note: string) => {
    setWorking(true);
    try {
      const blob = await make();
      if (!blob) {
        say('Nothing to change.');
        return;
      }
      await onApply(blob, note);
      setParts(null);
      setSelected(new Set());
    } catch (e) {
      say(e instanceof Error ? e.message : 'That edit failed');
    } finally {
      setWorking(false);
    }
  };

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const label = { fontSize: 11, color: COLORS.text2, lineHeight: 1.6 } as const;
  const btn = (on: boolean) =>
    ({
      width: '100%',
      padding: compact ? '12px 0' : '9px 0',
      borderRadius: 8,
      border: 'none',
      background: on ? A : COLORS.control,
      color: on ? COLORS.ink : COLORS.muted,
      fontWeight: 600,
      fontSize: 12,
      cursor: on ? 'pointer' : 'not-allowed',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    }) as const;

  const strays = parts?.filter((p) => p.fraction < 0.02) ?? [];

  return (
    <>
      <p style={{ fontSize: 11, color: COLORS.muted, lineHeight: 1.6, margin: '0 0 10px' }}>
        Edits to the mesh you already have. None of this uses provider credits, and each change
        lands as a new version.
      </p>

      {/* ---- separate pieces ---- */}
      {!parts ? (
        <button
          type="button"
          onClick={scan}
          disabled={!engine || busy}
          style={{
            width: '100%',
            padding: compact ? '12px 0' : '9px 0',
            borderRadius: 8,
            border: `1px solid ${COLORS.inputBorder}`,
            background: 'transparent',
            color: COLORS.text2,
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          Find separate pieces
        </button>
      ) : (
        <>
          <div style={{ ...label, marginBottom: 8 }}>
            {parts.length === 1
              ? 'One connected piece — nothing to split or clean up.'
              : `${parts.length} separate pieces.${
                  strays.length
                    ? ` ${strays.length} of them are tiny, which is usually a stray shell.`
                    : ''
                }`}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 4 }}>
            {parts.slice(0, 40).map((p, i) => {
              const on = selected.has(p.id);
              return (
                <div
                  key={p.id}
                  onPointerEnter={() => engine?.highlightPart(p.id)}
                  onPointerLeave={() => engine?.highlightPart(null)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    minWidth: 0,
                    padding: '6px 8px',
                    borderRadius: 6,
                    background: on ? COLORS.accentTint : COLORS.surface,
                    border: `1px solid ${on ? COLORS.accentBorder : COLORS.hairline}`,
                    cursor: 'pointer',
                  }}
                  onClick={() => toggle(p.id)}
                >
                  <span style={{ fontFamily: mono, fontSize: 9, color: on ? A : COLORS.disabled }}>
                    {on ? '✓' : String(i + 1).padStart(2, '0')}
                  </span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 11, color: COLORS.text2 }}>
                    {i === 0 ? 'main body' : p.fraction < 0.02 ? 'small piece' : 'piece'}
                  </span>
                  <span style={{ fontFamily: mono, fontSize: 9, color: COLORS.muted }}>
                    {formatTris(p.triangles)} · {p.size < 0.1 ? `${Math.round(p.size * 100)}cm` : `${p.size}m`}
                  </span>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'grid', gap: 6, marginTop: 9 }}>
            <button
              type="button"
              disabled={!selected.size || working || busy}
              onClick={() =>
                void run(
                  () => engine!.withoutParts([...selected]),
                  `deleted ${selected.size} piece${selected.size > 1 ? 's' : ''}`,
                )
              }
              style={btn(Boolean(selected.size) && !working && !busy)}
            >
              {working && <Spinner size={12} />}
              Delete selected
            </button>
            <button
              type="button"
              disabled={selected.size !== 1 || working || busy}
              onClick={() => void run(() => engine!.partAsModel([...selected][0]), 'split out a piece')}
              title="Save just this piece as its own asset"
              style={{
                ...btn(selected.size === 1 && !working && !busy),
                background: 'transparent',
                border: `1px solid ${COLORS.inputBorder}`,
                color: selected.size === 1 ? COLORS.text2 : COLORS.disabled,
              }}
            >
              Split the selected piece out
            </button>
          </div>
        </>
      )}

      {/* ---- triangles ---- */}
      <div style={{ marginTop: 16 }}>
        <div style={{ ...label, marginBottom: 6 }}>
          Reduce triangles to {Math.round(keep * 100)}% —{' '}
          <span style={{ fontFamily: mono }}>
            about {formatTris(Math.round(asset.versions[asset.cur].stats.triangles * keep))}
          </span>
        </div>
        <input
          type="range"
          min={5}
          max={95}
          step={5}
          value={Math.round(keep * 100)}
          onChange={(e) => setKeep(+e.target.value / 100)}
          style={{ width: '100%', accentColor: A }}
        />
        <button
          type="button"
          disabled={working || busy}
          onClick={() => void run(() => engine!.simplified(keep), `reduced to ${Math.round(keep * 100)}%`)}
          style={{
            ...btn(!working && !busy),
            background: 'transparent',
            border: `1px solid ${COLORS.inputBorder}`,
            color: COLORS.text2,
            marginTop: 8,
          }}
        >
          Reduce
        </button>
        <p style={{ fontSize: 10, color: COLORS.muted, lineHeight: 1.5, margin: '6px 0 0' }}>
          Not available once a model is rigged — simplifying drops the skin weights, so do it
          before rigging.
        </p>
      </div>

      {/* ---- blend shapes ---- */}
      <div style={{ marginTop: 16 }}>
        <div style={{ ...label, marginBottom: 6 }}>Face and expression</div>
        {morphs.length === 0 ? (
          <p style={{ fontSize: 10, color: COLORS.muted, lineHeight: 1.6, margin: 0 }}>
            This file has no blend shapes. Meshy does not produce them, so its models have no
            mouth, eye or eyelid movement to drive — those have to be authored, or come from a
            character made in a tool that ships them (VRM, Ready Player Me, Character Creator).
            Import one of those and its expressions appear here.
          </p>
        ) : (
          <div style={{ display: 'grid', gap: 7 }}>
            {morphs.map((m) => (
              <label key={m.name} style={{ display: 'grid', gap: 3 }}>
                <span style={{ fontFamily: mono, fontSize: 9, color: COLORS.muted }}>{m.name}</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(m.value * 100)}
                  onChange={(e) => {
                    const value = +e.target.value / 100;
                    engine?.setMorph(m.name, value);
                    setMorphs((prev) =>
                      prev.map((x) => (x.name === m.name ? { ...x, value } : x)),
                    );
                  }}
                  style={{ width: '100%', accentColor: A }}
                />
              </label>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
