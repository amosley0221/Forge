import { useState } from 'react';
import {
  COLORS,
  ENGINES,
  buildExportBundle,
  exportOptions,
  formatBytes,
  formatSize,
  formatTris,
  isBundled,
  readBlob,
} from '@forge/core';
import type { ExportFormat } from '@forge/core';
import { Chip, SectionLabel, mono } from '@forge/ui';
import type { Session } from '../session.js';
import { canRevealFiles, saveModel, showInFolder } from '../files.js';

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
  const [savedTo, setSavedTo] = useState<string | null>(null);
  const [format, setFormat] = useState<ExportFormat>('glb');
  const [progress, setProgress] = useState<string | null>(null);
  if (!a || !v) return null;

  const engine = ENGINES[engineIdx];
  const approved = a.clips.filter((c) => c.status === 'approved').map((c) => c.name);
  const unreviewed = a.clips.filter((c) => c.status !== 'approved').length;

  const options = exportOptions(v);
  const chosen = options.find((o) => o.format === format) ?? options[0];

  const exportModel = async () => {
    setBusy(true);
    setSavedTo(null);
    try {
      let blob: Blob | null;
      let filename: string;

      if (isBundled(format)) {
        // FBX and OBJ come from the provider, not from the stored GLB.
        if (!v.taskId || !s.credentials.apiKey) {
          throw new Error('This version has no Meshy task behind it to fetch other formats from.');
        }
        blob = await buildExportBundle({
          apiKey: s.credentials.apiKey,
          taskId: v.taskId,
          format: format as 'fbx' | 'obj',
          name: `${a.name}_${v.label}`,
          onProgress: (p) => setProgress(p.label),
        });
        filename = `${a.name}_${v.label}_${format}.zip`;
      } else {
        if (!v.fileId) throw new Error('This version has no model file cached on this computer.');
        blob = await readBlob(s.blobs, v.fileId);
        if (!blob) throw new Error('Could not read the model file');
        filename = `${a.name}_${v.label}.glb`;
      }

      const { path } = await saveModel(blob, filename);
      if (path) {
        setSavedTo(path);
        s.say(`Saved to ${path}`);
      }
    } catch (e) {
      s.say(e instanceof Error ? e.message : 'Could not export the model');
    } finally {
      setProgress(null);
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

        <SectionLabel style={{ marginBottom: 8 }}>Format</SectionLabel>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {options.map((o) => (
            <Chip
              key={o.format}
              label={o.label}
              on={o.format === format}
              onClick={() => o.available && setFormat(o.format)}
              style={o.available ? undefined : { opacity: 0.45, cursor: 'not-allowed' }}
              title={o.note}
            />
          ))}
        </div>
        <p style={{ fontSize: 11, color: COLORS.muted, lineHeight: 1.6, margin: '0 0 16px' }}>
          {chosen.note}
        </p>

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
          ['File you get', isBundled(format) ? `${format.toUpperCase()} + textures (.zip)` : 'GLB'],
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

        {engine.format.startsWith('FBX') && format !== 'fbx' && (
          <p style={{ fontSize: 11, color: A, lineHeight: 1.6, marginTop: 14 }}>
            {engine.name} prefers FBX. Pick <strong>FBX + textures</strong> above and Forge fetches
            the FBX Meshy already built for this model — no conversion, no extra credits.
          </p>
        )}
        {!engine.format.startsWith('FBX') &&
          engine.format !== 'GLB' &&
          engine.format !== 'GLB + PNG' &&
          !isBundled(format) && (
            <p style={{ fontSize: 11, color: A, lineHeight: 1.6, marginTop: 14 }}>
              {engine.name} prefers {engine.format}. Forge exports what the provider built — convert
              it in your engine, or in Blender, before importing.
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
          onClick={() => void exportModel()}
          disabled={busy || !chosen.available}
          style={{
            width: '100%',
            marginTop: 18,
            padding: '10px 0',
            borderRadius: 6,
            border: 'none',
            background: chosen.available ? A : COLORS.control,
            color: chosen.available ? COLORS.ink : COLORS.muted,
            fontWeight: 600,
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          {busy
            ? (progress ?? 'Preparing…')
            : isBundled(format)
              ? `Save ${a.name}_${v.label}_${format}.zip…`
              : `Save ${a.name}_${v.label}.glb…`}
        </button>

        {savedTo && (
          <div
            style={{
              marginTop: 10,
              padding: 10,
              borderRadius: 8,
              background: COLORS.okTint,
              border: '1px solid rgba(52,199,123,.3)',
            }}
          >
            <div style={{ fontSize: 11, color: COLORS.ok }}>Saved</div>
            <div
              style={{
                fontFamily: mono,
                fontSize: 10,
                color: COLORS.text2,
                margin: '4px 0 0',
                wordBreak: 'break-all',
              }}
            >
              {savedTo}
            </div>
            {canRevealFiles() && (
              <button
                type="button"
                onClick={() => void showInFolder(savedTo)}
                style={{
                  marginTop: 8,
                  padding: '6px 11px',
                  borderRadius: 6,
                  border: `1px solid ${COLORS.inputBorder}`,
                  background: 'transparent',
                  color: COLORS.text2,
                  fontSize: 11,
                  cursor: 'pointer',
                }}
              >
                Show in folder
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}
