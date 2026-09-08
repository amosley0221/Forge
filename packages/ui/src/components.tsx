import type { CSSProperties, ReactNode } from 'react';
import { COLORS, STAGES } from '@forge/core';

const A = COLORS.accent;

export const mono = "'IBM Plex Mono', ui-monospace, Menlo, monospace";

export function Chip({
  label,
  on,
  onClick,
  style,
  title,
}: {
  label: ReactNode;
  on?: boolean;
  onClick?: () => void;
  style?: CSSProperties;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      style={{
        padding: '6px 12px',
        borderRadius: 20,
        border: `1px solid ${on ? A : COLORS.inputBorder}`,
        background: on ? A : 'transparent',
        color: on ? COLORS.ink : COLORS.text2,
        fontWeight: on ? 600 : 400,
        fontSize: 12,
        fontFamily: 'inherit',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {label}
    </button>
  );
}

export function Panel({
  children,
  style,
  glass,
}: {
  children: ReactNode;
  style?: CSSProperties;
  glass?: boolean;
}) {
  return (
    <div
      style={{
        background: glass ? 'rgba(27,28,32,.92)' : COLORS.panel,
        backdropFilter: glass ? 'blur(10px)' : undefined,
        border: `1px solid ${COLORS.panelBorder}`,
        borderRadius: 8,
        animation: 'rise 300ms ease',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function SectionLabel({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '.08em',
        color: COLORS.muted,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function SyncPill({ label, ok }: { label: string; ok: boolean }) {
  return (
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
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: 3,
          background: ok ? COLORS.ok : A,
          animation: ok ? undefined : 'pulse 1s infinite',
        }}
      />
      {label}
    </div>
  );
}

export function Toast({ text }: { text: string }) {
  if (!text) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        bottom: 20,
        transform: 'translateX(-50%)',
        padding: '9px 16px',
        borderRadius: 8,
        background: COLORS.raised,
        border: `1px solid ${COLORS.panelBorder}`,
        color: COLORS.text,
        fontSize: 12,
        boxShadow: '0 20px 50px rgba(0,0,0,.5)',
        animation: 'rise 300ms ease',
        zIndex: 90,
        maxWidth: 'calc(100% - 32px)',
      }}
    >
      {text}
    </div>
  );
}

export function Spinner({ size = 16, color = A }: { size?: number; color?: string }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        border: `2px solid ${color}`,
        borderTopColor: 'transparent',
        animation: 'spin 900ms linear infinite',
      }}
    />
  );
}

/** The five-stage job overlay, shared by both apps. */
export function GeneratingOverlay({
  progress,
  prompt,
  compact,
}: {
  progress: number;
  prompt: string;
  compact?: boolean;
}) {
  const idx = Math.min(4, Math.floor(progress / 20));
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(13,14,17,.72)',
        backdropFilter: 'blur(8px)',
        zIndex: 80,
      }}
    >
      <Panel
        style={{
          width: compact ? 280 : 380,
          maxWidth: 'calc(100% - 32px)',
          padding: 20,
          borderRadius: 12,
          boxShadow: '0 30px 80px rgba(0,0,0,.6)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Spinner />
          <div style={{ fontSize: 13, fontWeight: 500 }}>{STAGES[idx]}…</div>
          <div style={{ marginLeft: 'auto', fontFamily: mono, fontSize: 11, color: A }}>
            {Math.round(progress)}%
          </div>
        </div>
        <div
          style={{
            height: 4,
            borderRadius: 2,
            background: COLORS.control,
            margin: '14px 0',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${progress}%`,
              background: A,
              transition: 'width 300ms ease',
            }}
          />
        </div>
        {!compact && (
          <div style={{ display: 'grid', gap: 6 }}>
            {STAGES.map((name, i) => (
              <div
                key={name}
                style={{
                  display: 'flex',
                  gap: 8,
                  fontSize: 11,
                  color: i < idx ? COLORS.ok : i === idx ? A : COLORS.muted,
                }}
              >
                <span style={{ fontFamily: mono }}>{i < idx ? '✓' : i === idx ? '●' : '○'}</span>
                {name}
              </div>
            ))}
          </div>
        )}
        <div
          style={{
            marginTop: 14,
            fontSize: 11,
            fontStyle: 'italic',
            color: COLORS.muted,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {prompt}
        </div>
      </Panel>
    </div>
  );
}

export function StatusTag({ status }: { status: 'approved' | 'review' | 'rework' }) {
  const bg =
    status === 'approved'
      ? COLORS.okTint
      : status === 'rework'
        ? 'rgba(255,95,87,.15)'
        : COLORS.accentTint2;
  const color = status === 'approved' ? COLORS.ok : status === 'rework' ? COLORS.danger : A;
  return (
    <span
      style={{
        padding: '2px 7px',
        borderRadius: 4,
        background: bg,
        color,
        fontFamily: mono,
        fontSize: 10,
      }}
    >
      {status}
    </span>
  );
}
