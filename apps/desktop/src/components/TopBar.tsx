import { COLORS, MODES } from '@forge/core';
import { SyncPill, mono } from '@forge/ui';
import { useSessionCtx } from '../session.js';

const A = COLORS.accent;

/** 44px window chrome: traffic lights, breadcrumb, mode control, sync, account. */
export function TopBar({ batch }: { batch?: { done: number; total: number } | null }) {
  const s = useSessionCtx();
  const inEditor = s.screen === 'editor';

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 44,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '0 14px',
        zIndex: 40,
      }}
      data-tauri-drag-region
    >
      <div style={{ display: 'flex', gap: 8 }}>
        {['#ff5f57', '#febc2e', '#28c840'].map((c) => (
          <span key={c} style={{ width: 11, height: 11, borderRadius: 6, background: c }} />
        ))}
      </div>

      <button
        type="button"
        onClick={s.goStart}
        style={{
          background: 'none',
          border: 'none',
          color: COLORS.text,
          fontWeight: 600,
          fontSize: 13,
          cursor: 'pointer',
          padding: 0,
        }}
      >
        Forge
      </button>

      <div style={{ fontFamily: mono, fontSize: 11, color: COLORS.muted }}>
        / Dustline{inEditor && s.active ? ` / ${s.active.name}` : ''}
      </div>

      {inEditor && s.curVersion && (
        <span
          style={{
            fontFamily: mono,
            fontSize: 10,
            padding: '2px 7px',
            borderRadius: 4,
            background: COLORS.accentTint2,
            color: A,
          }}
        >
          {s.curVersion.label}
        </span>
      )}

      {inEditor && (
        <div
          style={{
            display: 'flex',
            gap: 2,
            padding: 2,
            borderRadius: 6,
            background: COLORS.surface,
            border: `1px solid ${COLORS.hairline}`,
          }}
        >
          {MODES.map((m) => {
            const on = m === s.mode;
            return (
              <button
                key={m}
                type="button"
                onClick={() => {
                  s.setMode(m);
                  s.setTool(0);
                  if (m !== 'Animate') {
                    s.setAnim('idle');
                    s.setReviewing(false);
                  }
                }}
                style={{
                  padding: '5px 11px',
                  borderRadius: 4,
                  border: 'none',
                  background: on ? A : 'transparent',
                  color: on ? COLORS.ink : COLORS.muted,
                  fontWeight: on ? 600 : 400,
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                {m}
              </button>
            );
          })}
        </div>
      )}

      <div style={{ flex: 1 }} />

      {batch && (
        <button
          type="button"
          onClick={() => s.setModal('sprites')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            padding: '5px 11px',
            borderRadius: 20,
            border: `1px solid ${COLORS.accentBorder2}`,
            background: COLORS.accentTint,
            color: A,
            fontSize: 11,
            fontFamily: mono,
            cursor: 'pointer',
          }}
        >
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 5,
              border: `2px solid ${A}`,
              borderTopColor: 'transparent',
              animation: 'spin 900ms linear infinite',
            }}
          />
          Batch {batch.done} / {batch.total}
        </button>
      )}

      {inEditor && (
        <button
          type="button"
          onClick={() => s.setExportOpen(true)}
          style={{
            padding: '6px 13px',
            borderRadius: 6,
            border: 'none',
            background: COLORS.light,
            color: COLORS.lightInk,
            fontWeight: 600,
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          Export ▾
        </button>
      )}

      <SyncPill label={s.sync.label} ok={s.sync.ok} />

      <button
        type="button"
        onClick={() => s.setDefaults({ ...s.defaults, guide: !s.defaults.guide })}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '5px 11px',
          borderRadius: 20,
          border: `1px solid ${s.defaults.guide ? COLORS.accentBorder2 : COLORS.inputBorder}`,
          background: 'transparent',
          color: s.defaults.guide ? A : COLORS.muted,
          fontSize: 11,
          cursor: 'pointer',
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            background: s.defaults.guide ? A : '#3a3c42',
          }}
        />
        Guide
      </button>

      <button
        type="button"
        onClick={() => s.setModal('settings')}
        title="Settings & account"
        style={{
          width: 26,
          height: 26,
          borderRadius: 13,
          border: `1px solid ${COLORS.inputBorder}`,
          background: COLORS.raised,
          color: COLORS.text2,
          fontSize: 10,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        JD
      </button>
    </div>
  );
}
