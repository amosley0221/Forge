import { useState } from 'react';
import { COLORS, ENGINES, formatBytes, formatSize, formatTris, readBlob } from '@forge/core';
import { Chip, SectionLabel, mono } from '@forge/ui';
import type { Session } from '../session.js';

const A = COLORS.accent;

/**
 * Export writes out the actual GLB. Forge does not convert formats — the chips
 * say what each engine expects so you know whether a conversion step is needed.
 */
export function ExportDrawer({ s }: { s: Session }) {
  const a = s.active;
  const v = s.version;
  const [engineIdx, setEngineIdx] = useState(
    Math.max(0, ENGINES.findIndex((e) => e.name === s.settings.engine)),
  );
  const [busy, setBusy] = useState(false);
  if (!a || !v) return null;

  const engine = ENGINES[engineIdx];
  const approved = a.clips.filter((c) => c.status === 'approved').map((c) => c.name);
  const unreviewed = a.clips.filter((c) => c.status !== 'approved').length;

  const save = async () => {
    if (!v.fileId) {
      s.say('This version has no model file cached on this computer.');
      return;
    }
    setBusy(true);
    try {
      const blob = await readBlob(s.blobs, v.fileId);
      if (!blob) throw new Error('Could not read the model file');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${a.name}_${v.label}.glb`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      s.setExportOpen(false);
      s.say(`Saved ${a.name}_${v.label}.glb`);
    } catch (e) {
      s.say(e instanceof Error ? e.message : 'Could not export the model');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div
        onClick={() => s.setExportOpen(false)}
        style={{ position: 'absolute', inset: 0, background: 'rgba(13,14,17,.5)', zIndex: 60 }}
      />
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: 360,
          maxWidth: '100%',
          background: COLORS.panel,
          borderLeft: `1px solid ${COLORS.panelBorder}`,
          padding: 16,
          overflowY: 'auto',
          zIndex: 61,
          animation: 'rise 300ms ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>Export {a.name}</div>
          <button
            type="button"
            onClick={() => s.setExportOpen(false)}
            style={{ background: 'none', border: 'none', color: COLORS.muted, cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        <SectionLabel style={{ marginBottom: 8 }}>Target engine</SectionLabel>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
          {ENGINES.map((e, i) => (
            <Chip
              key={e.name}
              label={e.name}
              on={i === engineIdx}
              onClick={() => {
                setEngineIdx(i);
                s.updateSettings({ engine: e.name });
              }}
            />
          ))}
        </div>

        {[
          ['File you get', 'GLB'],
          [`${engine.name} expects`, engine.format],
          ['Axis · units', engine.axis],
          ['Triangles', formatTris(v.stats.triangles)],
          ['Materials', String(v.stats.materials)],
          ['Size', v.stats.sizeMeters ? formatSize(v.stats.sizeMeters) : '—'],
          ['Clips in file', v.stats.clipNames.length ? v.stats.clipNames.join(' · ') : 'none'],
          ['Approved clips', approved.join(' · ') || 'none'],
          ['On disk', v.stats.bytes ? formatBytes(v.stats.bytes) : '—'],
        ].map(([k, val]) => (
          <div
            key={k}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
              padding: '8px 0',
              fontSize: 12,
              borderTop: `1px solid ${COLORS.hairline}`,
            }}
          >
            <span style={{ color: COLORS.muted }}>{k}</span>
            <span style={{ fontFamily: mono, textAlign: 'right' }}>{val}</span>
          </div>
        ))}

        {engine.format !== 'GLB' && engine.format !== 'GLB + PNG' && (
          <p style={{ fontSize: 11, color: A, lineHeight: 1.6, marginTop: 14 }}>
            {engine.name} prefers {engine.format}. Forge exports the GLB as it is — convert it in
            your engine, or in Blender, before importing.
          </p>
        )}

        {unreviewed > 0 && (
          <p style={{ fontSize: 11, color: A, lineHeight: 1.6, marginTop: 10 }}>
            {unreviewed} clip{unreviewed > 1 ? 's are' : ' is'} not approved yet. They ship inside
            the GLB either way — review them first if that matters.
          </p>
        )}

        <button
          type="button"
          onClick={() => void save()}
          disabled={busy || !v.fileId}
          style={{
            width: '100%',
            marginTop: 18,
            padding: '10px 0',
            borderRadius: 6,
            border: 'none',
            background: v.fileId ? A : COLORS.control,
            color: v.fileId ? COLORS.ink : COLORS.muted,
            fontWeight: 600,
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          {busy ? 'Preparing…' : `Save ${a.name}_${v.label}.glb`}
        </button>
      </div>
    </>
  );
}
