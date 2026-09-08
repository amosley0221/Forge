import { useState } from 'react';
import { COLORS } from '@forge/core';
import type { SyncConfig } from '@forge/core';
import { Spinner, mono } from './components.js';

const A = COLORS.accent;

export interface SyncSettingsProps {
  config: SyncConfig | null;
  connected: boolean;
  state: { status: 'off' | 'idle' | 'syncing' | 'error'; lastSyncedAt: number | null; message: string | null };
  onConnect: (cfg: SyncConfig, token: string) => Promise<{ ok: boolean; message: string }>;
  onDisconnect: () => Promise<void>;
  onSyncNow: () => Promise<boolean>;
  /** Rendered as a plain row; each app styles its own. */
  compact?: boolean;
}

/**
 * Connects the library to a GitHub repository, which is what makes the desktop
 * and the phone show the same assets. Both devices point at the same repo and
 * pull on launch.
 *
 * The token is stored beside the provider key — OS keychain on desktop,
 * app-private preferences on Android — and never enters project data.
 */
export function SyncSettings({
  config,
  connected,
  state,
  onConnect,
  onDisconnect,
  onSyncNow,
  compact,
}: SyncSettingsProps) {
  const [owner, setOwner] = useState(config?.owner ?? '');
  const [repo, setRepo] = useState(config?.repo ?? 'forge-library');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const connect = async () => {
    if (!owner.trim() || !repo.trim() || !token.trim()) return;
    setBusy(true);
    setResult(null);
    const r = await onConnect(
      { owner: owner.trim(), repo: repo.trim(), branch: config?.branch || 'main', enabled: true },
      token.trim(),
    );
    setResult(r);
    setBusy(false);
    if (r.ok) setToken('');
  };

  const input = {
    width: '100%',
    height: compact ? 44 : 38,
    marginBottom: 8,
    padding: '0 12px',
    borderRadius: 8,
    background: COLORS.input,
    border: `1px solid ${COLORS.inputBorder}`,
    color: COLORS.text,
    fontSize: 13,
  } as const;

  const button = {
    width: '100%',
    marginTop: 8,
    padding: compact ? '12px 0' : '10px 0',
    borderRadius: 8,
    border: `1px solid ${COLORS.inputBorder}`,
    background: 'transparent',
    color: COLORS.text2,
    fontSize: 12,
    cursor: 'pointer',
  } as const;

  if (connected) {
    return (
      <>
        <Row label="Repository">
          {config?.owner}/{config?.repo}
        </Row>
        <Row label="Status">
          {state.status === 'syncing'
            ? 'syncing…'
            : state.status === 'error'
              ? 'error'
              : state.lastSyncedAt
                ? `synced ${new Date(state.lastSyncedAt).toLocaleTimeString()}`
                : 'connected'}
        </Row>
        {state.message && (
          <div style={{ fontSize: 11, color: COLORS.danger, padding: '6px 0', lineHeight: 1.5 }}>
            {state.message}
          </div>
        )}
        <p style={{ fontSize: 10, color: COLORS.muted, lineHeight: 1.6, margin: '6px 0 0' }}>
          Forge syncs when it opens and whenever you come back to it. Models are plain{' '}
          <code>.glb</code> files under <code>models/</code> in that repo, so you can also just
          download them from github.com.
        </p>
        <button
          type="button"
          onClick={() => void onSyncNow()}
          disabled={state.status === 'syncing'}
          style={button}
        >
          {state.status === 'syncing' ? 'Syncing…' : 'Sync now'}
        </button>
        <button type="button" onClick={() => void onDisconnect()} style={button}>
          Disconnect and remove the token
        </button>
      </>
    );
  }

  return (
    <>
      <p style={{ fontSize: 11, color: COLORS.muted, lineHeight: 1.6, margin: '0 0 10px' }}>
        Point both devices at one GitHub repository and they share a library — generate on the
        desktop, open the phone, and it is there. Create an empty repository first (private is
        fine), then paste a token with <strong>Contents: read and write</strong> on it.
      </p>
      <input
        value={owner}
        onChange={(e) => setOwner(e.target.value)}
        placeholder="GitHub username"
        autoCapitalize="none"
        spellCheck={false}
        style={input}
      />
      <input
        value={repo}
        onChange={(e) => setRepo(e.target.value)}
        placeholder="Repository name"
        autoCapitalize="none"
        spellCheck={false}
        style={input}
      />
      <input
        value={token}
        onChange={(e) => {
          setToken(e.target.value);
          setResult(null);
        }}
        type="password"
        placeholder="github_pat_…"
        autoCapitalize="none"
        spellCheck={false}
        style={{ ...input, fontFamily: mono }}
      />
      <a
        href="https://github.com/settings/personal-access-tokens/new"
        target="_blank"
        rel="noreferrer"
        style={{ fontSize: 11 }}
      >
        Create a fine-grained token ↗
      </a>

      {result && (
        <div
          style={{
            marginTop: 10,
            padding: 10,
            borderRadius: 8,
            fontSize: 11,
            lineHeight: 1.5,
            background: result.ok ? COLORS.okTint : 'rgba(255,95,87,.12)',
            color: result.ok ? COLORS.ok : COLORS.danger,
          }}
        >
          {result.message}
        </div>
      )}

      <button
        type="button"
        onClick={() => void connect()}
        disabled={busy || !owner.trim() || !repo.trim() || !token.trim()}
        style={{
          ...button,
          background: owner.trim() && repo.trim() && token.trim() && !busy ? A : 'transparent',
          color: owner.trim() && repo.trim() && token.trim() && !busy ? COLORS.ink : COLORS.muted,
          border:
            owner.trim() && repo.trim() && token.trim() && !busy
              ? 'none'
              : `1px solid ${COLORS.inputBorder}`,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        {busy && <Spinner size={12} color={COLORS.ink} />}
        {busy ? 'Checking…' : 'Connect'}
      </button>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 12,
        padding: '10px 0',
        fontSize: 12,
        borderTop: `1px solid ${COLORS.hairline}`,
      }}
    >
      <span style={{ color: COLORS.muted }}>{label}</span>
      <span style={{ fontFamily: mono, textAlign: 'right' }}>{children}</span>
    </div>
  );
}
