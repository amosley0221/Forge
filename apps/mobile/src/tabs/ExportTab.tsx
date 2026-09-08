import { COLORS, ENGINES } from '@forge/core';
import { mono } from '@forge/ui';
import type { MobileSession } from '../session.js';

const A = COLORS.accent;

export function ExportTab({ s }: { s: MobileSession }) {
  const a = s.active;
  const v = s.cur;
  if (!a || !v) return null;

  const engine = ENGINES[s.engineIdx];
  const approved = (a.anims || []).filter((c) => c.status === 'approved').map((c) => c.name);

  return (
    <div style={{ padding: '14px 14px 20px', overflowY: 'auto', height: '100%' }}>
      <div style={{ fontSize: 16, fontWeight: 600 }}>Export {a.name}</div>
      <div style={{ fontFamily: mono, fontSize: 10, color: COLORS.muted, marginTop: 2 }}>
        {v.label} · {v.tris} tris
      </div>

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
        ['Format', engine.format],
        ['Axis · units', engine.axis],
        ['Animations', approved.join(' · ') || 'none'],
        ['LODs', 'LOD0–LOD3'],
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

      <p style={{ fontSize: 11, color: COLORS.muted, lineHeight: 1.6, marginTop: 16 }}>
        Files are written by the desktop app or the cloud — your phone hands over the job and the
        settings.
      </p>

      <button
        type="button"
        onClick={() => {
          s.commit(s.assets, {
            msg: `Android asked to export ${a.name} ${v.label} to ${engine.name}`,
          });
          s.say(`Sent — desktop will export ${a.name} to ${engine.name}`);
        }}
        style={{
          width: '100%',
          padding: '13px 0',
          borderRadius: 8,
          border: 'none',
          background: A,
          color: COLORS.ink,
          fontWeight: 600,
          fontSize: 13,
          cursor: 'pointer',
        }}
      >
        Send to desktop → {engine.name} project
      </button>
      <button
        type="button"
        onClick={() => s.say('Link copied · valid 7 days')}
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
        Share download link
      </button>
    </div>
  );
}
