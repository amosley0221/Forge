import { useState } from 'react';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
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
import { mono } from '@forge/ui';
import type { MobileSession } from '../session.js';
import { modelFileUri } from '../storage.js';
import { canSaveToDownloads, saveBlobToDownloads, saveModelToDownloads } from '../files.js';

const A = COLORS.accent;

/**
 * Export hands over the actual file. Forge does not convert formats on the
 * phone — the GLB the provider produced is what leaves, and the engine chips
 * say what each engine expects so you know whether conversion is needed.
 */
export function ExportTab({ s }: { s: MobileSession }) {
  const a = s.active;
  const v = s.version;
  const [busy, setBusy] = useState(false);
  const [savedTo, setSavedTo] = useState<string | null>(null);
  const [format, setFormat] = useState<ExportFormat>('glb');
  const [progress, setProgress] = useState<string | null>(null);
  if (!a || !v) return null;

  const engine = ENGINES[s.engineIdx];
  const approved = a.clips.filter((c) => c.status === 'approved').map((c) => c.name);
  const unreviewed = a.clips.filter((c) => c.status !== 'approved').length;

  const shareModel = async () => {
    if (!v.fileId) {
      s.say('This version has no model file on this device.');
      return;
    }
    setBusy(true);
    try {
      if (Capacitor.isNativePlatform()) {
        const uri = await modelFileUri(v.fileId);
        if (!uri) throw new Error('Could not find the model file');
        await Share.share({
          title: `${a.name}_${v.label}.glb`,
          url: uri,
          dialogTitle: 'Send the model to…',
        });
      } else {
        // Browser: hand the blob over as a download.
        const blob = await readBlob(s.blobs, v.fileId);
        if (!blob) throw new Error('Could not read the model file');
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${a.name}_${v.label}.glb`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      }
    } catch (e) {
      s.say(e instanceof Error ? e.message : 'Could not share the model');
    } finally {
      setBusy(false);
    }
  };

  const options = exportOptions(v);
  const chosen = options.find((o) => o.format === format) ?? options[0];

  const saveToDownloads = async () => {
    setBusy(true);
    setSavedTo(null);
    try {
      if (isBundled(format)) {
        if (!v.taskId || !s.credentials.apiKey) {
          throw new Error('This version has no Meshy task behind it to fetch other formats from.');
        }
        const blob = await buildExportBundle({
          apiKey: s.credentials.apiKey,
          taskId: v.taskId,
          format: format as 'fbx' | 'obj',
          name: `${a.name}_${v.label}`,
          onProgress: (p) => setProgress(p.label),
        });
        const name = `${a.name}_${v.label}_${format}.zip`;
        await saveBlobToDownloads(blob, name);
        setSavedTo(`Downloads/${name}`);
      } else {
        if (!v.fileId) throw new Error('This version has no model file on this device.');
        const name = `${a.name}_${v.label}.glb`;
        await saveModelToDownloads(v.fileId, name);
        setSavedTo(`Downloads/${name}`);
      }
      s.say('Saved to your Downloads folder');
    } catch (e) {
      s.say(e instanceof Error ? e.message : 'Could not save the model');
    } finally {
      setProgress(null);
      setBusy(false);
    }
  };

  return (
    <div style={{ padding: '14px 14px 24px', overflowY: 'auto', height: '100%' }}>
      <div style={{ fontSize: 16, fontWeight: 600 }}>Export {a.name}</div>
      <div style={{ fontFamily: mono, fontSize: 10, color: COLORS.muted, marginTop: 2 }}>
        {v.label} · {formatTris(v.stats.triangles)} tris
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '14px 0 8px' }}>
        {options.map((o) => {
          const on = o.format === format;
          return (
            <button
              key={o.format}
              type="button"
              onClick={() => o.available && setFormat(o.format)}
              style={{
                padding: '8px 14px',
                borderRadius: 20,
                border: `1px solid ${on ? A : COLORS.inputBorder}`,
                background: on ? A : 'transparent',
                color: on ? COLORS.ink : COLORS.text2,
                fontWeight: on ? 600 : 400,
                fontSize: 12,
                opacity: o.available ? 1 : 0.45,
                cursor: o.available ? 'pointer' : 'not-allowed',
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      <p style={{ fontSize: 11, color: COLORS.muted, lineHeight: 1.6, margin: '0 0 14px' }}>
        {chosen.note}
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '14px 0' }}>
        {ENGINES.map((e, i) => {
          const on = i === s.engineIdx;
          return (
            <button
              key={e.name}
              type="button"
              onClick={() => s.setEngineIdx(i)}
              style={{
                padding: '8px 14px',
                borderRadius: 20,
                border: `1px solid ${on ? A : COLORS.inputBorder}`,
                background: on ? A : 'transparent',
                color: on ? COLORS.ink : COLORS.text2,
                fontWeight: on ? 600 : 400,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              {e.name}
            </button>
          );
        })}
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
      ].map(([k, val]) => (
        <div
          key={k}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            padding: '11px 0',
            fontSize: 13,
            borderTop: `1px solid ${COLORS.hairline}`,
          }}
        >
          <span style={{ color: COLORS.muted }}>{k}</span>
          <span style={{ fontFamily: mono, textAlign: 'right' }}>{val}</span>
        </div>
      ))}

      {engine.format.startsWith('FBX') && format !== 'fbx' && (
        <p style={{ fontSize: 11, color: A, lineHeight: 1.6, marginTop: 14 }}>
          {engine.name} prefers FBX — pick <strong>FBX + textures</strong> above.
        </p>
      )}

      {unreviewed > 0 && (
        <p style={{ fontSize: 11, color: A, lineHeight: 1.6, marginTop: 10 }}>
          {unreviewed} clip{unreviewed > 1 ? 's are' : ' is'} not approved yet. They still ship
          inside the GLB — review them on the asset screen if that matters.
        </p>
      )}

      <button
        type="button"
        onClick={() => void shareModel()}
        disabled={busy || !v.fileId}
        style={{
          width: '100%',
          marginTop: 18,
          padding: '13px 0',
          borderRadius: 8,
          border: 'none',
          background: v.fileId ? A : COLORS.control,
          color: v.fileId ? COLORS.ink : COLORS.muted,
          fontWeight: 600,
          fontSize: 13,
          cursor: 'pointer',
        }}
      >
        {busy ? (progress ?? 'Preparing…') : `Share ${a.name}_${v.label}.glb`}
      </button>

      {canSaveToDownloads() && (
        <button
          type="button"
          onClick={() => void saveToDownloads()}
          disabled={busy || !chosen.available}
          style={{
            width: '100%',
            marginTop: 9,
            padding: '12px 0',
            borderRadius: 8,
            border: `1px solid ${COLORS.inputBorder}`,
            background: 'transparent',
            color: COLORS.text2,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          {isBundled(format) ? `Save ${format.toUpperCase()} + textures to Downloads` : 'Save to Downloads'}
        </button>
      )}

      {savedTo && (
        <div
          style={{
            marginTop: 10,
            padding: 10,
            borderRadius: 8,
            background: COLORS.okTint,
            border: '1px solid rgba(52,199,123,.3)',
            fontSize: 11,
            color: COLORS.ok,
          }}
        >
          Saved as <span style={{ fontFamily: mono }}>{savedTo}</span> — it will show up in Chrome's
          downloads and the Files app.
        </div>
      )}

      <p style={{ fontSize: 10, color: COLORS.muted, lineHeight: 1.6, marginTop: 12 }}>
        {v.stats.bytes ? `${formatBytes(v.stats.bytes)} on disk` : 'Size unknown'}
        {v.provider ? ` · generated by ${v.provider}` : ' · imported'}
      </p>
    </div>
  );
}
