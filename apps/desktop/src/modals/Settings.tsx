import { useState } from 'react';
import { COLORS, ENGINES, STYLES, ago } from '@forge/core';
import { Chip, Panel, SectionLabel, mono } from '@forge/ui';
import { useSessionCtx } from '../session.js';
import { Backdrop } from './Sprites.js';
import { APP_VERSION } from '../version.js';

const A = COLORS.accent;
const TABS = ['Account', 'Devices', 'Compute & AI', 'Defaults', 'Sync'] as const;
type Tab = (typeof TABS)[number];

const osName = () =>
  /Mac/.test(navigator.platform) ? 'macOS' : /Win/.test(navigator.platform) ? 'Windows' : 'desktop';

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
      <span style={{ textAlign: 'right' }}>{children}</span>
    </div>
  );
}

export function SettingsModal() {
  const s = useSessionCtx();
  const [tab, setTab] = useState<Tab>('Account');
  const [compute, setCompute] = useState<'cloud' | 'local'>('cloud');
  const [byok, setByok] = useState(false);
  const [llmKey, setLlmKey] = useState('');
  const [meshKey, setMeshKey] = useState('');
  const [meshProvider, setMeshProvider] = useState('Meshy');
  const [devices, setDevices] = useState([
    { id: 'd1', name: 'This computer', icon: 'DSK', meta: `Forge ${APP_VERSION} · desktop`, status: 'this device', current: true },
    { id: 'd2', name: 'Pixel 9', icon: 'AND', meta: `Forge Android ${APP_VERSION} · captured oil_barrel`, status: 'online', current: false },
    { id: 'd3', name: 'Studio PC', icon: 'DSK', meta: 'Windows 11 · RTX 4080 · local GPU', status: 'last seen 2d ago', current: false },
  ]);

  const keyStatus = (k: string) => (k.length > 12 ? 'valid ✓' : k ? 'checking…' : 'not set');
  const keyColor = (k: string) => (k.length > 12 ? COLORS.ok : COLORS.muted);

  return (
    <Backdrop onClose={() => s.setModal(null)}>
      <Panel
        style={{
          width: 820,
          maxWidth: 'calc(100vw - 40px)',
          height: 560,
          maxHeight: 'calc(100vh - 60px)',
          display: 'flex',
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 30px 80px rgba(0,0,0,.6)',
        }}
      >
        <div
          style={{
            width: 200,
            padding: 16,
            borderRight: `1px solid ${COLORS.panelBorder}`,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 }}>
            <span
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                background: COLORS.raised,
                border: `1px solid ${COLORS.inputBorder}`,
                display: 'grid',
                placeItems: 'center',
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              JD
            </span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500 }}>Jordan Diaz</div>
              <div style={{ fontSize: 10, color: COLORS.muted }}>Studio plan</div>
            </div>
          </div>

          {TABS.map((t) => {
            const on = t === tab;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                style={{
                  textAlign: 'left',
                  padding: '7px 10px',
                  borderRadius: 6,
                  border: 'none',
                  background: on ? COLORS.raised : 'transparent',
                  color: on ? COLORS.text : COLORS.muted,
                  fontWeight: on ? 600 : 400,
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                {t}
              </button>
            );
          })}

          <div style={{ flex: 1 }} />
          <button
            type="button"
            onClick={() => {
              s.setModal(null);
              s.say('Signed out');
            }}
            style={{
              textAlign: 'left',
              padding: '7px 10px',
              border: 'none',
              background: 'transparent',
              color: COLORS.muted,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Sign out
          </button>
          <div style={{ fontFamily: mono, fontSize: 9, color: COLORS.disabled }}>
            Forge {APP_VERSION} · {osName()}
          </div>
        </div>

        <div style={{ flex: 1, padding: 20, overflowY: 'auto' }}>
          {tab === 'Account' && (
            <>
              <SectionLabel style={{ marginBottom: 10 }}>Account</SectionLabel>
              <Row label="Signed in as">jordan@dustline.games</Row>
              <Row label="Plan">
                Studio · 400 generations/mo{' '}
                <button type="button" style={link} onClick={() => s.say('Opening billing…')}>
                  Change
                </button>
              </Row>
              <Row label="This month">
                <span style={{ fontFamily: mono }}>128 / 400</span>
              </Row>
              <Row label="Storage">
                <span style={{ fontFamily: mono }}>3.2 / 50 GB</span>
              </Row>
              <div style={{ height: 4, borderRadius: 2, background: COLORS.control, marginTop: 4 }}>
                <div style={{ width: '6.4%', height: '100%', borderRadius: 2, background: A }} />
              </div>

              <SectionLabel style={{ margin: '20px 0 10px' }}>Projects</SectionLabel>
              <div style={{ display: 'grid', gap: 6 }}>
                {['Dustline', 'Ashfall prototype'].map((p, i) => (
                  <div
                    key={p}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '9px 11px',
                      borderRadius: 8,
                      border: `1px solid ${i === 0 ? COLORS.accentBorder2 : COLORS.hairline}`,
                      fontSize: 12,
                    }}
                  >
                    <span style={{ flex: 1 }}>{p}</span>
                    {i === 0 && (
                      <span style={{ fontSize: 11, color: COLORS.ok }}>● synced</span>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => s.say('New project created')}
                  style={{
                    padding: '9px 11px',
                    borderRadius: 8,
                    border: `1px dashed ${COLORS.inputBorder}`,
                    background: 'transparent',
                    color: COLORS.muted,
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  + New project
                </button>
              </div>
            </>
          )}

          {tab === 'Devices' && (
            <>
              <SectionLabel style={{ marginBottom: 10 }}>Devices</SectionLabel>
              <p style={{ fontSize: 11, color: COLORS.muted, lineHeight: 1.6, marginTop: 0 }}>
                Every linked device sees the same project in real time. Edits made offline queue up
                and replay in order when the device reconnects.
              </p>
              <div style={{ display: 'grid', gap: 6 }}>
                {devices.map((d) => (
                  <div
                    key={d.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 11,
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: `1px solid ${d.current ? COLORS.accentBorder2 : COLORS.hairline}`,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: mono,
                        fontSize: 9,
                        padding: '3px 6px',
                        borderRadius: 4,
                        background: COLORS.control,
                        color: COLORS.muted,
                      }}
                    >
                      {d.icon}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12 }}>
                        {d.name}
                        {d.current ? ' (this device)' : ''}
                      </div>
                      <div style={{ fontSize: 10, color: COLORS.muted }}>{d.meta}</div>
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        color: d.status === 'online' || d.current ? COLORS.ok : COLORS.muted,
                      }}
                    >
                      {d.status}
                    </span>
                    {!d.current && (
                      <button
                        type="button"
                        onClick={() => {
                          setDevices((prev) => prev.filter((x) => x.id !== d.id));
                          s.say(`${d.name} unlinked`);
                        }}
                        style={link}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div
                style={{
                  marginTop: 14,
                  padding: 14,
                  borderRadius: 8,
                  border: `1px solid ${COLORS.hairline}`,
                  display: 'flex',
                  gap: 14,
                  alignItems: 'center',
                }}
              >
                <div
                  style={{
                    width: 84,
                    height: 84,
                    borderRadius: 6,
                    background:
                      'repeating-conic-gradient(#e6e4df 0% 25%, #16171a 0% 50%) 50% / 12px 12px',
                  }}
                />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500 }}>Link a phone</div>
                  <p style={{ fontSize: 11, color: COLORS.muted, margin: '5px 0' }}>
                    Scan in the Forge Android app, or type the code.
                  </p>
                  <span style={{ fontFamily: mono, fontSize: 14, color: A }}>K7M-2QX</span>
                  <div style={{ fontSize: 10, color: COLORS.muted }}>expires in 5 min</div>
                </div>
              </div>
            </>
          )}

          {tab === 'Compute & AI' && (
            <>
              <SectionLabel style={{ marginBottom: 10 }}>Where generation runs</SectionLabel>
              <div style={{ display: 'grid', gap: 6 }}>
                {(
                  [
                    ['cloud', 'Cloud (default)', '~40 s / asset · works everywhere · syncs instantly'],
                    [
                      'local',
                      'Local GPU',
                      `${/Mac/.test(navigator.platform) ? 'Apple M-series · Metal' : 'NVIDIA · CUDA'} · ~2 min · free`,
                    ],
                  ] as const
                ).map(([id, name, meta]) => {
                  const on = compute === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setCompute(id)}
                      style={{
                        textAlign: 'left',
                        padding: '10px 12px',
                        borderRadius: 8,
                        border: `1px solid ${on ? A : 'rgba(255,255,255,.12)'}`,
                        background: on ? COLORS.accentTint : 'transparent',
                        color: COLORS.text,
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 500 }}>{name}</div>
                      <div style={{ fontSize: 11, color: COLORS.muted }}>{meta}</div>
                    </button>
                  );
                })}
              </div>
              {compute === 'local' && (
                <div style={{ marginTop: 10, fontSize: 11, color: COLORS.muted, lineHeight: 1.6 }}>
                  Detected: {/Mac/.test(navigator.platform) ? 'Apple M3 Max · 36 GB' : 'NVIDIA RTX 4080 · 16 GB'}.
                  Local model TRELLIS 4.1 GB —{' '}
                  <button type="button" style={link} onClick={() => s.say('Downloading TRELLIS…')}>
                    download
                  </button>
                  . Results upload so Android sees them.
                </div>
              )}

              <SectionLabel style={{ margin: '20px 0 10px' }}>AI providers</SectionLabel>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  onClick={() => setByok(false)}
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    borderRadius: 8,
                    textAlign: 'left',
                    border: `1px solid ${!byok ? A : 'rgba(255,255,255,.12)'}`,
                    background: !byok ? COLORS.accentTint : 'transparent',
                    color: COLORS.text,
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  Forge managed
                </button>
                <button
                  type="button"
                  onClick={() => setByok(true)}
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    borderRadius: 8,
                    textAlign: 'left',
                    border: `1px solid ${byok ? A : 'rgba(255,255,255,.12)'}`,
                    background: byok ? COLORS.accentTint : 'transparent',
                    color: COLORS.text,
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  Bring your own keys
                </button>
              </div>

              {byok && (
                <div style={{ marginTop: 12, display: 'grid', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 5 }}>
                      Agent · Anthropic · claude-sonnet-4-5
                    </div>
                    <input
                      value={llmKey}
                      onChange={(e) => setLlmKey(e.target.value)}
                      placeholder="sk-ant-…"
                      type="password"
                      style={input}
                    />
                    <div style={{ fontSize: 10, color: keyColor(llmKey), marginTop: 4 }}>
                      {keyStatus(llmKey)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 5 }}>
                      3D generation provider
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 7 }}>
                      {['Meshy', 'Tripo', 'Hunyuan3D'].map((p) => (
                        <Chip
                          key={p}
                          label={p}
                          on={p === meshProvider}
                          onClick={() => {
                            setMeshProvider(p);
                            setMeshKey('');
                          }}
                        />
                      ))}
                    </div>
                    <input
                      value={meshKey}
                      onChange={(e) => setMeshKey(e.target.value)}
                      type="password"
                      placeholder={
                        meshProvider === 'Meshy' ? 'msy_…' : meshProvider === 'Tripo' ? 'tsk_…' : 'hf_…'
                      }
                      style={input}
                    />
                    <div style={{ fontSize: 10, color: keyColor(meshKey), marginTop: 4 }}>
                      {keyStatus(meshKey)}
                    </div>
                  </div>
                  <p style={{ fontSize: 10, color: COLORS.muted, lineHeight: 1.6, margin: 0 }}>
                    Keys are stored in the OS keychain on this device only — they are never synced.
                    Android keeps using managed providers.
                  </p>
                </div>
              )}
            </>
          )}

          {tab === 'Defaults' && (
            <>
              <SectionLabel style={{ marginBottom: 10 }}>Export defaults</SectionLabel>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                {ENGINES.map((e, i) => (
                  <Chip
                    key={e.name}
                    label={e.name}
                    on={i === s.defaults.engineIdx}
                    onClick={() => s.setDefaults({ ...s.defaults, engineIdx: i })}
                  />
                ))}
              </div>
              <Row label="Axis · units">{s.engine.axis}</Row>

              <SectionLabel style={{ margin: '20px 0 10px' }}>Generation defaults</SectionLabel>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                {STYLES.map((st) => (
                  <Chip
                    key={st}
                    label={st}
                    on={st === s.defaults.style}
                    onClick={() => s.setDefaults({ ...s.defaults, style: st })}
                  />
                ))}
              </div>
              <Row label="Triangle budget">
                <input
                  type="number"
                  min={1000}
                  max={200000}
                  step={1000}
                  value={s.defaults.triBudget}
                  onChange={(e) => s.setDefaults({ ...s.defaults, triBudget: +e.target.value })}
                  style={{ ...input, width: 110, textAlign: 'right' }}
                />
              </Row>
              <Row label="Creature budget">≤ 8,000</Row>
              <Row label="Textures">{s.defaults.textureSize}</Row>
              <Row label="Auto-generate clips">idle · walk · run (review required)</Row>
              <Row label="LOD chain">4 levels</Row>
              <Row label="Guide panel">
                <button
                  type="button"
                  onClick={() => s.setDefaults({ ...s.defaults, guide: !s.defaults.guide })}
                  style={link}
                >
                  {s.defaults.guide ? 'on' : 'off'}
                </button>
              </Row>
            </>
          )}

          {tab === 'Sync' && (
            <>
              <SectionLabel style={{ marginBottom: 10 }}>Sync</SectionLabel>
              <Row label="Status">
                <span style={{ color: s.sync.ok ? COLORS.ok : A }}>● {s.sync.label}</span>
              </Row>
              <Row label="Last change received">
                {s.assets.length
                  ? `${s.assets[0].name} · ${ago(s.assets[0].updatedAt)} · ${s.assets[0].device}`
                  : '—'}
              </Row>
              <Row label="Offline queue">
                {s.pendingSync === 0 ? 'empty' : `${s.pendingSync} change(s) waiting`}
              </Row>
              <Row label="Local cache">
                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem('forge.assets.v1');
                    s.say('Local cache cleared — reopen Forge to re-sync');
                  }}
                  style={link}
                >
                  Clear
                </button>
              </Row>
              <p style={{ fontSize: 11, color: COLORS.muted, lineHeight: 1.6, marginTop: 16 }}>
                Conflict rule: never overwrite. Concurrent edits to the same asset become sibling
                versions, so nothing you or the phone made is ever lost.
              </p>
            </>
          )}
        </div>
      </Panel>
    </Backdrop>
  );
}

const link = {
  background: 'none',
  border: 'none',
  color: A,
  fontSize: 11,
  cursor: 'pointer',
  padding: 0,
} as const;

const input = {
  width: '100%',
  padding: '7px 9px',
  borderRadius: 6,
  background: COLORS.input,
  border: `1px solid ${COLORS.inputBorder}`,
  color: COLORS.text,
  fontSize: 12,
  fontFamily: mono,
} as const;
