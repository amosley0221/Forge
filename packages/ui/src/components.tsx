import { useState } from 'react';
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

/**
 * A failure the user needs to read. Toasts vanish in three seconds, which is
 * useless when a generation dies after the provider has charged for it — this
 * stays until dismissed and can be copied into a bug report.
 */
export function ErrorPanel({
  message,
  onDismiss,
  hint,
}: {
  message: string;
  onDismiss?: () => void;
  hint?: ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 8,
        background: 'rgba(255,95,87,.10)',
        border: '1px solid rgba(255,95,87,.35)',
        animation: 'rise 300ms ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.danger, flex: 1 }}>
          That didn't finish
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            style={{ background: 'none', border: 'none', color: COLORS.muted, cursor: 'pointer' }}
          >
            ✕
          </button>
        )}
      </div>
      <p
        style={{
          margin: '7px 0 0',
          fontSize: 11,
          lineHeight: 1.55,
          color: COLORS.text2,
          fontFamily: mono,
          wordBreak: 'break-word',
        }}
      >
        {message}
      </p>
      {hint && (
        <p style={{ margin: '9px 0 0', fontSize: 11, lineHeight: 1.55, color: COLORS.muted }}>
          {hint}
        </p>
      )}
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard?.writeText(message).then(
            () => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            },
            () => undefined,
          );
        }}
        style={{
          marginTop: 10,
          padding: '6px 11px',
          borderRadius: 6,
          border: `1px solid ${COLORS.inputBorder}`,
          background: 'transparent',
          color: COLORS.text2,
          fontSize: 11,
          cursor: 'pointer',
        }}
      >
        {copied ? 'Copied' : 'Copy the message'}
      </button>
    </div>
  );
}

/**
 * Jobs the provider accepted — and charged for — that never produced a model.
 * Finishing one costs nothing, so it is offered before the user retries and
 * pays again.
 */
export function PendingTasks({
  tasks,
  onRecover,
  onForget,
}: {
  tasks: {
    taskId: string;
    provider: string;
    prompt: string;
    createdAt: number;
    error?: string;
  }[];
  onRecover: (taskId: string) => void;
  onForget: (taskId: string) => void;
}) {
  if (!tasks.length) return null;
  return (
    <Panel
      style={{
        padding: 12,
        background: COLORS.accentTint,
        border: `1px solid ${COLORS.accentBorder}`,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 600, color: A }}>
        {tasks.length} paid job{tasks.length > 1 ? 's' : ''} didn't finish
      </div>
      <p style={{ fontSize: 11, color: COLORS.text2, lineHeight: 1.55, margin: '6px 0 10px' }}>
        Your provider already built and charged for these. Picking one back up downloads the model
        again and costs no further credits.
      </p>
      <div style={{ display: 'grid', gap: 6 }}>
        {tasks.map((t) => (
          <div
            key={t.taskId}
            style={{
              padding: 9,
              borderRadius: 6,
              background: COLORS.surface,
              border: `1px solid ${COLORS.hairline}`,
            }}
          >
            <div style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {t.prompt || 'Untitled job'}
            </div>
            <div style={{ fontFamily: mono, fontSize: 9, color: COLORS.muted, marginTop: 3 }}>
              {t.provider} · {t.taskId.slice(0, 12)}…
            </div>
            {t.error && (
              <div style={{ fontSize: 10, color: COLORS.danger, marginTop: 4, lineHeight: 1.5 }}>
                {t.error}
              </div>
            )}
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <button
                type="button"
                onClick={() => onRecover(t.taskId)}
                style={{
                  flex: 1,
                  padding: '7px 0',
                  borderRadius: 6,
                  border: 'none',
                  background: A,
                  color: COLORS.ink,
                  fontWeight: 600,
                  fontSize: 11,
                  cursor: 'pointer',
                }}
              >
                Finish this job
              </button>
              <button
                type="button"
                onClick={() => onForget(t.taskId)}
                style={{
                  padding: '7px 11px',
                  borderRadius: 6,
                  border: `1px solid ${COLORS.inputBorder}`,
                  background: 'transparent',
                  color: COLORS.muted,
                  fontSize: 11,
                  cursor: 'pointer',
                }}
              >
                Discard
              </button>
            </div>
          </div>
        ))}
      </div>
    </Panel>
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
