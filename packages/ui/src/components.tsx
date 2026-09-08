import type { CSSProperties, ReactNode } from 'react';
import { COLORS } from '@forge/core';

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

/**
 * The job overlay. Label and percentage come from the provider via
 * `useForge().job` — nothing here advances on a timer.
 */
export function JobOverlay({
  label,
  percent,
  onCancel,
  compact,
}: {
  label: string;
  percent: number;
  onCancel?: () => void;
  compact?: boolean;
}) {
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
          width: compact ? 300 : 380,
          maxWidth: 'calc(100% - 32px)',
          padding: 20,
          borderRadius: 12,
          boxShadow: '0 30px 80px rgba(0,0,0,.6)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Spinner />
          <div style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>{label}</div>
          <div style={{ fontFamily: mono, fontSize: 11, color: A }}>{Math.round(percent)}%</div>
        </div>
        <div
          style={{
            height: 4,
            borderRadius: 2,
            background: COLORS.control,
            margin: '14px 0 0',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${Math.max(2, percent)}%`,
              background: A,
              transition: 'width 400ms ease',
            }}
          />
        </div>
        <p style={{ fontSize: 11, color: COLORS.muted, lineHeight: 1.55, margin: '12px 0 0' }}>
          Generation runs on your provider's servers and can take a few minutes. You can leave this
          screen — the asset lands in your library when it is done.
        </p>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            style={{
              marginTop: 12,
              width: '100%',
              padding: '8px 0',
              borderRadius: 6,
              border: `1px solid ${COLORS.inputBorder}`,
              background: 'transparent',
              color: COLORS.text2,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        )}
      </Panel>
    </div>
  );
}

/** Shown wherever there is genuinely nothing yet — never filled with samples. */
export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        padding: '40px 20px',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600 }}>{title}</div>
      <p style={{ fontSize: 12, color: COLORS.muted, lineHeight: 1.6, margin: 0, maxWidth: 380 }}>
        {body}
      </p>
      {action && <div style={{ marginTop: 6 }}>{action}</div>}
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
