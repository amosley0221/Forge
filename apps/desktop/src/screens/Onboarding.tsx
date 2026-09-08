import { useState } from 'react';
import { COLORS, PROVIDERS, providerById } from '@forge/core';
import type { ProviderId } from '@forge/core';
import { Panel, Spinner, mono } from '@forge/ui';
import type { Session } from '../session.js';
import { secretsAreSecure } from '../storage.js';
import { APP_VERSION } from '../version.js';

const A = COLORS.accent;

/** First launch. Optionally name the project, then connect a provider — or
 *  don't, and the app says plainly what still works without one. */
export function Onboarding({ s }: { s: Session }) {
  const [step, setStep] = useState<'project' | 'provider'>('project');
  const [name, setName] = useState('');
  const [provider, setProvider] = useState<ProviderId>('meshy');
  const [key, setKey] = useState('');
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  /**
   * Naming the project is a convenience, not a requirement — everywhere it is
   * shown falls back to "Your project", and Settings can set it later. Making
   * it mandatory just put a form between the user and the app.
   */
  const continuePastName = () => {
    const trimmed = name.trim();
    if (trimmed) s.updateSettings({ projectName: trimmed });
    setStep('provider');
  };

  const connect = async () => {
    const p = providerById(provider);
    if (!p || !key.trim()) return;
    setChecking(true);
    setResult(null);
    const check = await p.validateKey(key.trim());
    setResult(check);
    setChecking(false);
    if (check.ok) {
      await s.connectProvider({ provider, apiKey: key.trim() });
      await s.finishOnboarding();
    }
  };

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'grid',
        placeItems: 'center',
        background: COLORS.canvas,
      }}
    >
      <Panel
        style={{
          width: 520,
          maxWidth: 'calc(100vw - 40px)',
          padding: 28,
          borderRadius: 12,
          boxShadow: '0 30px 80px rgba(0,0,0,.6)',
        }}
      >
        {step === 'project' ? (
          <>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: COLORS.surface,
                border: `1px solid ${COLORS.panelBorder}`,
                display: 'grid',
                placeItems: 'center',
                fontSize: 22,
                fontWeight: 600,
                color: A,
                marginBottom: 18,
              }}
            >
              F
            </div>
            <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Welcome to Forge</h1>
            <p style={{ fontSize: 13, color: COLORS.text2, lineHeight: 1.6, margin: '10px 0 20px' }}>
              Describe an object and Forge generates a 3D model for it, then keeps every version
              you make. Name your project if you like — you can also do it later in Settings.
            </p>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Project name (optional)"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') continuePastName();
              }}
              style={input}
            />
            <button type="button" onClick={continuePastName} style={primary}>
              {name.trim() ? 'Continue' : 'Skip for now'}
            </button>
            <div
              style={{
                textAlign: 'center',
                fontFamily: mono,
                fontSize: 10,
                color: COLORS.disabled,
                marginTop: 14,
              }}
            >
              Forge {APP_VERSION}
            </div>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Connect a 3D provider</h1>
            <p style={{ fontSize: 13, color: COLORS.text2, lineHeight: 1.6, margin: '10px 0 18px' }}>
              Models are generated through your own account with one of these services. Both are
              paid and charge credits per model.
            </p>

            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              {PROVIDERS.map((p) => {
                const on = p.id === provider;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setProvider(p.id);
                      setKey('');
                      setResult(null);
                    }}
                    style={{
                      flex: 1,
                      padding: '12px 0',
                      borderRadius: 8,
                      border: `1px solid ${on ? A : COLORS.inputBorder}`,
                      background: on ? COLORS.accentTint : 'transparent',
                      color: on ? A : COLORS.text2,
                      fontWeight: on ? 600 : 400,
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>

            <input
              value={key}
              onChange={(e) => {
                setKey(e.target.value);
                setResult(null);
              }}
              type="password"
              placeholder={providerById(provider)?.keyPlaceholder}
              style={{ ...input, fontFamily: mono }}
            />

            <div style={{ fontSize: 11, color: COLORS.muted, marginTop: -6, marginBottom: 12 }}>
              <a href={providerById(provider)?.keysUrl} target="_blank" rel="noreferrer">
                Get a {providerById(provider)?.name} key ↗
              </a>
              {' · '}
              {secretsAreSecure()
                ? 'stored in your OS keychain'
                : 'stored in browser storage — the packaged app uses the OS keychain'}
            </div>

            {result && (
              <div
                style={{
                  marginBottom: 12,
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
              disabled={!key.trim() || checking}
              style={{
                ...primary,
                background: key.trim() && !checking ? A : '#8a5a22',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 9,
              }}
            >
              {checking && <Spinner size={13} color={COLORS.ink} />}
              {checking ? 'Checking your key…' : 'Connect'}
            </button>

            <button type="button" onClick={() => void s.finishOnboarding()} style={secondary}>
              Skip — I'll import my own files
            </button>
            <p style={{ fontSize: 11, color: COLORS.muted, lineHeight: 1.6, margin: '10px 0 0' }}>
              Without a key you can import <code>.glb</code> files, view and inspect them, and
              export them. Generating, rigging and motion clips need a provider.
            </p>
          </>
        )}
      </Panel>
    </div>
  );
}

const input = {
  width: '100%',
  height: 44,
  marginBottom: 12,
  padding: '0 14px',
  borderRadius: 8,
  background: COLORS.input,
  border: `1px solid ${COLORS.inputBorder}`,
  color: COLORS.text,
  fontSize: 14,
} as const;

const primary = {
  width: '100%',
  padding: '12px 0',
  borderRadius: 8,
  border: 'none',
  background: A,
  color: COLORS.ink,
  fontWeight: 600,
  fontSize: 13,
  cursor: 'pointer',
} as const;

const secondary = {
  width: '100%',
  marginTop: 8,
  padding: '11px 0',
  borderRadius: 8,
  border: `1px solid ${COLORS.inputBorder}`,
  background: 'transparent',
  color: COLORS.text2,
  fontSize: 12,
  cursor: 'pointer',
} as const;
