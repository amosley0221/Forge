import { useEffect, useState } from 'react';
import { COLORS, PROVIDERS, STYLES, formatBytes, httpClientName, providerById } from '@forge/core';
import type { ProviderId } from '@forge/core';
import { Chip, Panel, ProviderJobs, SectionLabel, Spinner, SyncSettings, mono } from '@forge/ui';
import type { Session } from '../session.js';
import { secretsAreSecure } from '../storage.js';
import { APP_VERSION } from '../version.js';
import { RELEASES_PAGE, checkForUpdate, installUpdate } from '../updater.js';
import type { Update } from '@tauri-apps/plugin-updater';

const A = COLORS.accent;

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 14,
        padding: '10px 0',
        fontSize: 12,
        borderTop: `1px solid ${COLORS.hairline}`,
      }}
    >
      <span style={{ color: COLORS.muted }}>{label}</span>
      <span style={{ textAlign: 'right', fontFamily: mono }}>{children}</span>
    </div>
  );
}

export function Settings({ s }: { s: Session }) {
  const [provider, setProvider] = useState<ProviderId>(s.credentials.provider ?? 'meshy');
  const [key, setKey] = useState('');
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [name, setName] = useState(s.settings.projectName);
  const [updateNote, setUpdateNote] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [pendingUpdate, setPendingUpdate] = useState<Update | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [loadingCredits, setLoadingCredits] = useState(false);

  // Read the balance whenever Settings opens, and again after any job, so the
  // cost of a generation can be seen rather than guessed at.
  useEffect(() => {
    if (!s.credentials.provider) return;
    setLoadingCredits(true);
    void s.providerBalance().then((n) => {
      setCredits(n);
      setLoadingCredits(false);
    });
  }, [s.credentials.provider, s.job.running]);

  const cachedFiles = s.assets.reduce((n, a) => n + a.versions.filter((v) => v.fileId).length, 0);
  const cachedBytes = s.assets.reduce(
    (n, a) => n + a.versions.reduce((m, v) => m + (v.stats.bytes || 0), 0),
    0,
  );

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

  return (
    <div
      onClick={() => s.setSettingsOpen(false)}
      style={{
        position: 'absolute',
        inset: 0,
        display: 'grid',
        placeItems: 'center',
        background: 'rgba(13,14,17,.7)',
        backdropFilter: 'blur(6px)',
        zIndex: 70,
      }}
    >
      <div onClick={(e) => e.stopPropagation()}>
        <Panel
          style={{
            width: 640,
            maxWidth: 'calc(100vw - 40px)',
            maxHeight: 'calc(100vh - 60px)',
            overflowY: 'auto',
            padding: 24,
            borderRadius: 12,
            boxShadow: '0 30px 80px rgba(0,0,0,.6)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
            <div style={{ fontSize: 16, fontWeight: 600, flex: 1 }}>Settings</div>
            <button
              type="button"
              onClick={() => s.setSettingsOpen(false)}
              style={{ background: 'none', border: 'none', color: COLORS.muted, cursor: 'pointer' }}
            >
              ✕
            </button>
          </div>

          <SectionLabel style={{ margin: '18px 0 10px' }}>Project</SectionLabel>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => s.updateSettings({ projectName: name.trim() })}
            placeholder="Project name"
            style={input}
          />

          <SectionLabel style={{ margin: '22px 0 10px' }}>3D provider</SectionLabel>
          {s.credentials.provider ? (
            <>
              <Row label="Connected">{providerById(s.credentials.provider)?.name}</Row>
              <Row label="Key storage">
                {secretsAreSecure() ? 'OS keychain' : 'browser storage (dev)'}
              </Row>
              <Row label="Credits left">
                {loadingCredits ? (
                  <Spinner size={11} />
                ) : credits === null ? (
                  '—'
                ) : (
                  <>
                    {credits.toLocaleString()}{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setLoadingCredits(true);
                        void s.providerBalance().then((n) => {
                          setCredits(n);
                          setLoadingCredits(false);
                        });
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: A,
                        fontSize: 11,
                        cursor: 'pointer',
                        padding: 0,
                        marginLeft: 6,
                      }}
                    >
                      refresh
                    </button>
                  </>
                )}
              </Row>
              <p style={{ fontSize: 10, color: COLORS.muted, lineHeight: 1.6, margin: '6px 0 0' }}>
                A model is charged as two tasks — the mesh, then the texture stage. Repainting,
                rigging and each motion clip are charged separately again. Refresh before and after
                a job to see exactly what it cost.
              </p>
              <button
                type="button"
                onClick={async () => {
                  await s.connectProvider({ provider: null, apiKey: null });
                  s.say('Provider disconnected — the key was removed from this computer');
                }}
                style={outline}
              >
                Disconnect and remove the key
              </button>
            </>
          ) : (
            <>
              <p style={{ fontSize: 11, color: COLORS.muted, lineHeight: 1.6, margin: '0 0 10px' }}>
                Generation runs through your own account. The key is stored on this computer only.
              </p>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                {PROVIDERS.map((p) => (
                  <Chip
                    key={p.id}
                    label={p.name}
                    on={p.id === provider}
                    onClick={() => {
                      setProvider(p.id);
                      setKey('');
                      setResult(null);
                    }}
                  />
                ))}
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
              <a
                href={providerById(provider)?.keysUrl}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: 11 }}
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

          <SectionLabel style={{ margin: '22px 0 10px' }}>Generation defaults</SectionLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
            {STYLES.map((st) => (
              <Chip
                key={st}
                label={st}
                on={st === s.settings.style}
                onClick={() => s.updateSettings({ style: st })}
              />
            ))}
          </div>
          <Row label="Triangle budget">
            <input
              type="number"
              min={1000}
              max={200000}
              step={1000}
              value={s.settings.triBudget}
              onChange={(e) => s.updateSettings({ triBudget: +e.target.value })}
              style={{ ...input, width: 120, height: 30, marginBottom: 0, textAlign: 'right' }}
            />
          </Row>
          <p style={{ fontSize: 10, color: COLORS.muted, lineHeight: 1.6, margin: '6px 0 0' }}>
            Sent to the provider as a target polycount. What comes back is whatever it produces —
            the real count is shown on every asset.
          </p>
          <Row label="Texture size">
            <div style={{ display: 'inline-flex', gap: 6 }}>
              {([2048, 4096] as const).map((px) => (
                <Chip
                  key={px}
                  label={px === 2048 ? '2K' : '4K'}
                  on={s.settings.textureSize === px}
                  onClick={() => s.updateSettings({ textureSize: px })}
                />
              ))}
            </div>
          </Row>
          <p style={{ fontSize: 10, color: COLORS.muted, lineHeight: 1.6, margin: '6px 0 0' }}>
            Asked of the provider when it paints the model. 4K is sharper up close and costs the
            same credits, just more time. Models made before this setting existed were built at the
            provider's default.
          </p>
          <Row label="Texture new models">
            <button
              type="button"
              onClick={() => s.updateSettings({ textured: !s.settings.textured })}
              style={{ background: 'none', border: 'none', color: A, fontSize: 11, cursor: 'pointer' }}
            >
              {s.settings.textured ? 'on' : 'off'}
            </button>
          </Row>
          <p style={{ fontSize: 10, color: COLORS.muted, lineHeight: 1.6, margin: '6px 0 0' }}>
            Meshy builds the shape and the texture as two separately-charged jobs. With this off you
            get bare grey geometry — no face, no clothing colour — for half the credits.
          </p>
          <Row label="Guide panel">
            <button
              type="button"
              onClick={() => s.updateSettings({ guide: !s.settings.guide })}
              style={{ background: 'none', border: 'none', color: A, fontSize: 11, cursor: 'pointer' }}
            >
              {s.settings.guide ? 'on' : 'off'}
            </button>
          </Row>

          <SectionLabel style={{ margin: '22px 0 10px' }}>Recent jobs on your provider</SectionLabel>
          <ProviderJobs
            enabled={s.canListJobs}
            onList={s.listProviderJobs}
            onImport={s.importProviderJob}
            onOpen={(asset) => {
              s.setSettingsOpen(false);
              s.openAsset(asset.id);
            }}
          />

          <SectionLabel style={{ margin: '22px 0 10px' }}>Sync with your other devices</SectionLabel>
          <SyncSettings
            config={s.syncConfig}
            connected={s.syncConnected}
            state={s.syncState}
            onConnect={s.connectSync}
            onDisconnect={s.disconnectSync}
            onSyncNow={s.syncNow}
          />

          <SectionLabel style={{ margin: '22px 0 10px' }}>Storage</SectionLabel>
          <Row label="Assets">{String(s.assets.length)}</Row>
          <Row label="Model files cached">{`${cachedFiles} · ${formatBytes(cachedBytes)}`}</Row>

          <SectionLabel style={{ margin: '22px 0 10px' }}>About</SectionLabel>
          <Row label="Version">{APP_VERSION}</Row>
          <Row label="Shell">{secretsAreSecure() ? 'Tauri desktop' : 'browser (dev)'}</Row>
          <Row label="Network">{httpClientName()}</Row>
          {updateNote && (
            <div style={{ fontSize: 11, color: COLORS.text2, padding: '8px 0', lineHeight: 1.5 }}>
              {updateNote}
            </div>
          )}
          <button
            type="button"
            disabled={updating}
            onClick={async () => {
              setUpdateNote('Checking…');
              setPendingUpdate(null);
              const status = await checkForUpdate();
              if (!status.supported) {
                setUpdateNote('Updates are available in the installed desktop app.');
                return;
              }
              if (status.error) {
                setUpdateNote(status.error);
                return;
              }
              if (!status.available || !status.update) {
                setUpdateNote('You are on the newest release.');
                return;
              }
              // Checking must never install on its own: restarting would throw
              // away whatever the user is in the middle of.
              setPendingUpdate(status.update);
              setUpdateNote(`Forge ${status.version} is available.`);
            }}
            style={outline}
          >
            Check for updates
          </button>

          {pendingUpdate && (
            <>
              <button
                type="button"
                disabled={updating || s.job.running}
                onClick={async () => {
                  setUpdating(true);
                  try {
                    await installUpdate(pendingUpdate, (p) =>
                      setUpdateNote(`Downloading… ${p}%`),
                    );
                  } catch (e) {
                    setUpdateNote(e instanceof Error ? e.message : 'Update failed');
                    setUpdating(false);
                  }
                }}
                style={{
                  ...outline,
                  background: s.job.running ? 'transparent' : A,
                  color: s.job.running ? COLORS.muted : COLORS.ink,
                  border: s.job.running ? `1px solid ${COLORS.inputBorder}` : 'none',
                  fontWeight: 600,
                }}
              >
                {updating ? 'Installing…' : 'Install and restart'}
              </button>
              <p style={{ fontSize: 10, color: COLORS.muted, lineHeight: 1.6, margin: '8px 0 0' }}>
                {s.job.running
                  ? 'A job is running — let it finish first, or the model you are paying for is interrupted.'
                  : 'Forge closes and reopens on the new version. Your library, settings and provider key are saved as you go, so nothing is lost.'}
              </p>
            </>
          )}
          <a
            href={RELEASES_PAGE}
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: 11, display: 'inline-block', marginTop: 10 }}
          >
            All releases ↗
          </a>
        </Panel>
      </div>
    </div>
  );
}

const input = {
  width: '100%',
  height: 38,
  marginBottom: 10,
  padding: '0 12px',
  borderRadius: 8,
  background: COLORS.input,
  border: `1px solid ${COLORS.inputBorder}`,
  color: COLORS.text,
  fontSize: 13,
} as const;

const outline = {
  width: '100%',
  marginTop: 10,
  padding: '10px 0',
  borderRadius: 8,
  border: `1px solid ${COLORS.inputBorder}`,
  background: 'transparent',
  color: COLORS.text2,
  fontSize: 12,
  cursor: 'pointer',
} as const;
