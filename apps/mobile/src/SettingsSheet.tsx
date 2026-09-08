import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { COLORS, PROVIDERS, STYLES, providerById } from '@forge/core';
import type { ProviderId } from '@forge/core';
import { ProviderJobs, Spinner, SyncSettings, mono } from '@forge/ui';
import type { MobileSession } from './session.js';
import { APP_VERSION } from './version.js';
import { RELEASES_PAGE, checkForUpdate, currentVersion, installUpdate } from './updater.js';

const A = COLORS.accent;

export function SettingsSheet({ s }: { s: MobileSession }) {
  const [provider, setProvider] = useState<ProviderId>(s.credentials.provider ?? 'meshy');
  const [key, setKey] = useState('');
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [name, setName] = useState(s.settings.projectName);
  const [installed, setInstalled] = useState<{ versionName: string; versionCode: number } | null>(null);
  const [updateNote, setUpdateNote] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    void currentVersion().then(setInstalled);
  }, []);

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
      setKey('');
      s.say(`${p.name} connected`);
    }
  };

  const disconnect = async () => {
    await s.connectProvider({ provider: null, apiKey: null });
    setResult(null);
    s.say('Provider disconnected — your key was removed from this device');
  };

  const checkUpdate = async () => {
    setUpdateNote('Checking…');
    const status = await checkForUpdate();
    if (status.error) setUpdateNote(status.error);
    else if (status.updateAvailable && status.latest)
      setUpdateNote(`Forge ${status.latest.versionName} is available`);
    else setUpdateNote('You are on the newest release');
  };

  const doUpdate = async () => {
    const status = await checkForUpdate();
    if (!status.latest || !status.updateAvailable) {
      setUpdateNote('You are on the newest release');
      return;
    }
    setUpdating(true);
    try {
      await installUpdate(status.latest, (p) => setUpdateNote(`Downloading… ${p}%`));
      setUpdateNote('Installer opened — confirm to finish');
    } catch (e) {
      setUpdateNote(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div
      onClick={() => s.setSettingsOpen(false)}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(13,14,17,.7)',
        display: 'flex',
        alignItems: 'flex-end',
        zIndex: 75,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxHeight: '92vh',
          overflowY: 'auto',
          padding: '16px 14px calc(20px + env(safe-area-inset-bottom))',
          borderRadius: '16px 16px 0 0',
          background: COLORS.panel,
          border: `1px solid ${COLORS.panelBorder}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 17, fontWeight: 600, flex: 1 }}>Settings</div>
          <button
            type="button"
            onClick={() => s.setSettingsOpen(false)}
            style={{ background: 'none', border: 'none', color: COLORS.muted, fontSize: 16, cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        <Section title="Project" />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => s.updateSettings({ projectName: name.trim() })}
          placeholder="Project name"
          style={input}
        />

        <Section title="3D provider" />
        {s.credentials.provider ? (
          <>
            <Row label="Connected" value={providerById(s.credentials.provider)?.name ?? '—'} />
            <button type="button" onClick={() => void disconnect()} style={outline}>
              Disconnect and remove the key
            </button>
          </>
        ) : (
          <>
            <p style={{ fontSize: 11, color: COLORS.muted, lineHeight: 1.6, margin: '0 0 10px' }}>
              Generation runs through your own account. Your key is stored on this device only and
              never leaves it except to call the provider.
            </p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
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
                      padding: '11px 0',
                      borderRadius: 10,
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
              placeholder={providerById(provider)?.keyPlaceholder}
              autoCapitalize="none"
              spellCheck={false}
              style={{ ...input, fontFamily: mono }}
            />
            <a
              href={providerById(provider)?.keysUrl}
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: 11, display: 'inline-block', marginTop: 8 }}
            >
              Get a {providerById(provider)?.name} key ↗
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
              disabled={!key.trim() || checking}
              style={{
                ...outline,
                background: key.trim() && !checking ? A : 'transparent',
                color: key.trim() && !checking ? COLORS.ink : COLORS.muted,
                border: key.trim() && !checking ? 'none' : `1px solid ${COLORS.inputBorder}`,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              {checking && <Spinner size={12} color={COLORS.ink} />}
              {checking ? 'Checking…' : 'Connect'}
            </button>
          </>
        )}

        <Section title="Generation defaults" />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
          {STYLES.map((st) => {
            const on = st === s.settings.style;
            return (
              <button
                key={st}
                type="button"
                onClick={() => s.updateSettings({ style: st })}
                style={{
                  padding: '7px 12px',
                  borderRadius: 20,
                  border: `1px solid ${on ? A : COLORS.inputBorder}`,
                  background: on ? A : 'transparent',
                  color: on ? COLORS.ink : COLORS.muted,
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                {st}
              </button>
            );
          })}
        </div>
        <Row label="Triangle budget" value={s.settings.triBudget.toLocaleString()} />
        <p style={{ fontSize: 10, color: COLORS.muted, lineHeight: 1.6, margin: '4px 0 0' }}>
          Passed to the provider as a target polycount. What you actually get back is whatever it
          produces — the real count is shown on each asset.
        </p>

        <Section title="Recent jobs on your provider" />
        <ProviderJobs
          enabled={s.canListJobs}
          onList={s.listProviderJobs}
          onImport={s.importProviderJob}
          onOpen={(asset) => {
            s.setSettingsOpen(false);
            s.open(asset.id);
          }}
        />

        <Section title="Sync with your other devices" />
        <SyncSettings
          compact
          config={s.syncConfig}
          connected={s.syncConnected}
          state={s.syncState}
          onConnect={s.connectSync}
          onDisconnect={s.disconnectSync}
          onSyncNow={s.syncNow}
        />

        <Section title="Storage" />
        <Row label="Assets on this device" value={String(s.assets.length)} />
        <Row
          label="Models cached"
          value={`${s.assets.reduce((n, a) => n + a.versions.filter((v) => v.fileId).length, 0)} files`}
        />

        <Section title="App" />
        <Row label="Version" value={installed ? `${installed.versionName} (${installed.versionCode})` : APP_VERSION} />
        <Row label="Platform" value={Capacitor.getPlatform()} />
        {updateNote && (
          <div style={{ fontSize: 11, color: COLORS.text2, padding: '6px 0' }}>{updateNote}</div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={() => void checkUpdate()} style={{ ...outline, flex: 1 }}>
            Check for updates
          </button>
          <button
            type="button"
            onClick={() => void doUpdate()}
            disabled={updating}
            style={{ ...outline, flex: 1 }}
          >
            {updating ? 'Updating…' : 'Update now'}
          </button>
        </div>
        <a
          href={RELEASES_PAGE}
          target="_blank"
          rel="noreferrer"
          style={{ fontSize: 11, display: 'inline-block', marginTop: 10 }}
        >
          All releases ↗
        </a>
      </div>
    </div>
  );
}

function Section({ title }: { title: string }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '.08em',
        color: COLORS.muted,
        margin: '22px 0 10px',
      }}
    >
      {title}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 12,
        padding: '10px 0',
        fontSize: 13,
        borderTop: `1px solid ${COLORS.hairline}`,
      }}
    >
      <span style={{ color: COLORS.muted }}>{label}</span>
      <span style={{ fontFamily: mono, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

const input = {
  width: '100%',
  height: 44,
  padding: '0 12px',
  borderRadius: 10,
  background: COLORS.input,
  border: `1px solid ${COLORS.inputBorder}`,
  color: COLORS.text,
  fontSize: 14,
} as const;

const outline = {
  width: '100%',
  marginTop: 10,
  padding: '12px 0',
  borderRadius: 10,
  border: `1px solid ${COLORS.inputBorder}`,
  background: 'transparent',
  color: COLORS.text2,
  fontSize: 13,
  cursor: 'pointer',
} as const;
