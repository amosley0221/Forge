import { COLORS } from '@forge/core';
import { mono } from '@forge/ui';
import type { Session } from '../session.js';
import { closeWindow, minimizeWindow, toggleMaximizeWindow } from '../windowControls.js';

const A = COLORS.accent;

/** 44px window chrome. The window is borderless, so these buttons are the only
 *  way to close it — they call the Tauri window API. */
export function TopBar({ s }: { s: Session }) {
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
        {(
          [
            ['#ff5f57', 'Close', closeWindow],
            ['#febc2e', 'Minimize', minimizeWindow],
            ['#28c840', 'Maximize', toggleMaximizeWindow],
          ] as const
        ).map(([color, label, action]) => (
          <button
            key={label}
            type="button"
            title={label}
            aria-label={label}
            onClick={() => void action()}
            style={{
              width: 11,
              height: 11,
              padding: 0,
              borderRadius: 6,
              border: 'none',
              background: color,
              cursor: 'pointer',
            }}
          />
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
        / {s.settings.projectName || 'project'}
        {inEditor && s.active ? ` / ${s.active.name}` : ''}
      </div>

      {inEditor && s.version && (
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
          {s.version.label}
        </span>
      )}

      <div style={{ flex: 1 }} />

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
          Export
        </button>
      )}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 10px',
          borderRadius: 20,
          border: `1px solid ${COLORS.hairline}`,
          fontSize: 11,
          color: COLORS.text2,
          whiteSpace: 'nowrap',
        }}
        title={
          s.canGenerate
            ? `Generating through ${s.credentials.provider}`
            : 'No 3D provider connected'
        }
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            background: s.canGenerate ? COLORS.ok : COLORS.disabled,
          }}
        />
        {s.canGenerate ? s.credentials.provider : 'no provider'}
      </div>

      <button
        type="button"
        onClick={() => s.setSettingsOpen(true)}
        title="Settings"
        style={{
          width: 26,
          height: 26,
          borderRadius: 13,
          border: `1px solid ${COLORS.inputBorder}`,
          background: COLORS.raised,
          color: COLORS.text2,
          fontSize: 12,
          cursor: 'pointer',
        }}
      >
        ⚙
      </button>
    </div>
  );
}
