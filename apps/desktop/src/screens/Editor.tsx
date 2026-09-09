import { useEffect, useRef, useState } from 'react';
import { COLORS, ago, exactTime, formatBytes, formatSize, formatTris } from '@forge/core';
import type { MeshyAction } from '@forge/core';
import { Appearance, ErrorPanel, ForgeViewer, Panel, SectionLabel, StatusTag, mono } from '@forge/ui';
import type { ViewerEngine } from '@forge/ui';
import type { Session } from '../session.js';

const A = COLORS.accent;

function HudPill({
  label,
  on,
  onClick,
  /** Visible but not usable yet — the tooltip says what would enable it. */
  disabled,
  title,
}: {
  label: string;
  on?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      title={title}
      style={{
        padding: '4px 10px',
        borderRadius: 6,
        border: `1px solid ${on ? COLORS.accentBorder2 : COLORS.hairline}`,
        background: 'rgba(27,28,32,.85)',
        backdropFilter: 'blur(8px)',
        color: disabled ? COLORS.disabled : on ? A : COLORS.muted,
        fontFamily: mono,
        fontSize: 10,
        cursor: disabled ? 'not-allowed' : onClick ? 'pointer' : 'default',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  );
}

function Field({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div
      title={title}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 10,
        padding: '7px 0',
        fontSize: 12,
        borderTop: `1px solid ${COLORS.hairline}`,
      }}
    >
      <span style={{ color: COLORS.muted }}>{label}</span>
      <span style={{ fontFamily: mono, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

export function Editor({ s }: { s: Session }) {
  const a = s.active;
  const v = s.version;
  const [actions, setActions] = useState<MeshyAction[] | null>(null);
  const [picking, setPicking] = useState(false);

  const rigged = a ? [...a.versions].reverse().find((x) => x.riggedTaskId) : undefined;
  const viewer = useRef<ViewerEngine | null>(null);
  const [pose, setPose] = useState(false);
  const [riggedInFile, setRiggedInFile] = useState(false);
  const [held, setHeld] = useState<string | null>(null);

  useEffect(() => {
    if (!picking || actions) return;
    void s.motionActions().then(setActions);
  }, [picking, actions, s]);

  if (!a || !v) return null;

  return (
    <>
      <ForgeViewer
        url={s.modelUrl}
        wire={s.wire}
        selected={s.selected}
        autorotate={s.turntable && !s.clip && !pose}
        clip={s.clip}
        speed={s.speed}
        pose={pose}
        engineRef={viewer}
        emptyMessage="This version’s model file is not on this computer. Sync to download it."
        onPick={(part) => s.setSelected(part)}
        onSkeleton={(hasBones) => {
          setRiggedInFile(hasBones);
          if (!hasBones) setPose(false);
        }}
        onPoseBone={setHeld}
        style={{ position: 'absolute', inset: 0 }}
      />

      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: 56,
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: 4,
          zIndex: 20,
        }}
      >
        <HudPill label={s.wire ? 'Shaded + wire' : 'Shaded'} on={s.wire} onClick={() => s.setWire(!s.wire)} />
        <HudPill label="Turntable" on={s.turntable} onClick={() => s.setTurntable(!s.turntable)} />
        {/* Always shown, so the mode is discoverable before the model is rigged
            — hiding it just made it look like the feature was not there. */}
        <HudPill
          label="Pose"
          on={pose}
          disabled={!riggedInFile}
          title={
            riggedInFile
              ? 'Drag a limb to bend it'
              : 'Posing needs a skeleton — use “Rig this model” first'
          }
          onClick={() => setPose(!pose)}
        />
        {pose && <HudPill label="Reset pose" onClick={() => viewer.current?.resetPose()} />}
        <HudPill
          label={
            pose
              ? held
                ? `holding ${held}`
                : 'drag a limb to bend it · drag the background to orbit'
              : s.selected
                ? `${s.selected} selected`
                : riggedInFile
                  ? 'click a part to select · drag to orbit · wheel to zoom'
                  : 'click a part to select · drag to orbit · rig the model to pose it'
          }
        />
      </div>

      {/* Right column */}
      <div
        style={{
          position: 'absolute',
          right: 16,
          top: 70,
          bottom: 130,
          width: 280,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          overflowY: 'auto',
          zIndex: 20,
        }}
      >
        {/* Rigging, repainting and clips all run from this screen, so a failure
            has to be readable here. Without this the message existed in state,
            flashed as a toast and was gone. */}
        {s.job.error && <ErrorPanel message={s.job.error} onDismiss={s.dismissError} />}

        <Panel style={{ padding: 12 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {s.selected ? `${a.name} › ${s.selected}` : a.name}
            </div>
            <div style={{ fontSize: 11, color: COLORS.muted }}>{v.label}</div>
          </div>

          <Field label="Triangles" value={formatTris(v.stats.triangles)} />
          <Field label="Materials" value={String(v.stats.materials)} />
          <Field label="Real-world size" value={v.stats.sizeMeters ? formatSize(v.stats.sizeMeters) : '—'} />
          <Field label="File" value={v.stats.bytes ? formatBytes(v.stats.bytes) : '—'} />
          <Field label="Source" value={v.note} />
          <Field
            label={`${v.label} made`}
            value={ago(v.createdAt)}
            title={exactTime(v.createdAt)}
          />
          <Field
            label="Last changed"
            value={ago(a.updatedAt)}
            title={exactTime(a.updatedAt)}
          />
          {v.provider && <Field label="Provider" value={v.provider} />}
        </Panel>

        <Panel style={{ padding: 12 }}>
          <SectionLabel style={{ marginBottom: 8 }}>Motion</SectionLabel>

          {a.clips.length === 0 ? (
            <p style={{ fontSize: 11, color: COLORS.muted, lineHeight: 1.6, margin: '0 0 10px' }}>
              {rigged
                ? 'Rigged — it has a skeleton but no clips yet. Add one below, or use Pose to move it by hand.'
                : 'This file contains no animation tracks.'}
            </p>
          ) : (
            <div style={{ display: 'grid', gap: 5, marginBottom: 10 }}>
              {a.clips.map((c) => {
                const playing = s.clip === c.name;
                return (
                  <div
                    key={c.name}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 8px',
                      borderRadius: 6,
                      background: playing ? COLORS.accentTint : COLORS.surface,
                      border: `1px solid ${playing ? COLORS.accentBorder2 : COLORS.hairline}`,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        const next = playing ? null : c.name;
                        s.setClip(next);
                        s.setReviewing(next != null && c.status === 'review');
                      }}
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 4,
                        border: 'none',
                        background: playing ? A : COLORS.control,
                        color: playing ? COLORS.ink : COLORS.muted,
                        fontSize: 9,
                        cursor: 'pointer',
                      }}
                    >
                      {playing ? '❚❚' : '▶'}
                    </button>
                    <span style={{ flex: 1, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {c.name}
                    </span>
                    <StatusTag status={c.status} />
                  </div>
                );
              })}
            </div>
          )}

          {s.clip && (
            <>
              <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 5 }}>
                Speed · {s.speed.toFixed(2)}×
              </div>
              <input
                type="range"
                min={0.25}
                max={2}
                step={0.05}
                value={s.speed}
                onChange={(e) => s.setSpeed(+e.target.value)}
                style={{ width: '100%', accentColor: A, marginBottom: 10 }}
              />
            </>
          )}

          {s.reviewing && s.clip && (
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              <button
                type="button"
                onClick={() => {
                  s.setClipStatus(a, s.clip!, 'approved', `${a.name}: ${s.clip} approved`);
                  s.setReviewing(false);
                }}
                style={{
                  flex: 1,
                  padding: '7px 0',
                  borderRadius: 6,
                  border: 'none',
                  background: COLORS.ok,
                  color: COLORS.onOk,
                  fontWeight: 600,
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                Looks good
              </button>
              <button
                type="button"
                onClick={() => {
                  s.setClipStatus(a, s.clip!, 'rework', `${a.name}: ${s.clip} needs work`);
                  s.setReviewing(false);
                }}
                style={outlineBtn}
              >
                Needs work
              </button>
            </div>
          )}

          {!s.canRig ? (
            <p style={{ fontSize: 11, color: COLORS.muted, lineHeight: 1.6, margin: 0 }}>
              Rigging and motion clips come from Meshy. Connect a Meshy key in Settings.
            </p>
          ) : !v.taskId && !rigged ? (
            <p style={{ fontSize: 11, color: COLORS.muted, lineHeight: 1.6, margin: 0 }}>
              Imported files have no provider task behind them, so they cannot be rigged here.
            </p>
          ) : !rigged ? (
            <button type="button" onClick={() => void s.rig(a)} style={{ ...outlineBtn, width: '100%' }}>
              Rig this model
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setPicking(true)}
              style={{ ...outlineBtn, width: '100%' }}
            >
              Add a motion clip
            </button>
          )}
        </Panel>

        <Panel style={{ padding: 12 }}>
          <SectionLabel style={{ marginBottom: 8 }}>Appearance</SectionLabel>
          <Appearance
            asset={a}
            canRestyle={v.provider === 'meshy' && Boolean(v.taskId)}
            busy={s.job.running}
            onRestyle={(description) => void s.restyle(a, description)}
          />
        </Panel>
      </div>

      {/* History */}
      {a.versions.length > 1 && (
        <div style={{ position: 'absolute', left: 16, bottom: 46, zIndex: 20 }}>
          <SectionLabel style={{ marginBottom: 6 }}>History</SectionLabel>
          <div style={{ display: 'flex', gap: 6 }}>
            {a.versions.map((ver, i) => {
              const on = i === a.cur;
              return (
                <button
                  key={ver.label}
                  type="button"
                  onClick={() => s.selectVersion(a, i)}
                  title={`${ver.note}${ver.prompt ? ` — ${ver.prompt}` : ''}`}
                  style={{
                    position: 'relative',
                    width: 64,
                    height: 48,
                    borderRadius: 6,
                    border: on ? `1.5px solid ${A}` : `1px solid ${COLORS.panelBorder}`,
                    background: on ? COLORS.accentTint : COLORS.surface,
                    color: on ? A : COLORS.muted,
                    fontFamily: mono,
                    fontSize: 10,
                    cursor: 'pointer',
                    padding: 4,
                    textAlign: 'left',
                  }}
                >
                  <span style={{ position: 'absolute', top: 3, right: 4, fontSize: 8 }}>
                    {ver.device === 'android' ? 'AND' : 'DSK'}
                  </span>
                  <span style={{ position: 'absolute', left: 5, bottom: 4 }}>{ver.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div
        style={{
          position: 'absolute',
          left: 16,
          bottom: 16,
          fontFamily: mono,
          fontSize: 10,
          color: COLORS.muted,
          zIndex: 20,
        }}
      >
        {formatTris(v.stats.triangles)} tris · {v.stats.materials} mats ·{' '}
        {v.stats.clipNames.length} clip{v.stats.clipNames.length === 1 ? '' : 's'} ·{' '}
        {v.stats.bytes ? formatBytes(v.stats.bytes) : '—'}
      </div>

      {/* Reply + prompt bar */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          bottom: 16,
          transform: 'translateX(-50%)',
          width: 'min(640px, calc(100% - 620px))',
          minWidth: 360,
          display: 'grid',
          gap: 8,
          zIndex: 30,
        }}
      >
        {s.lastReply && !s.job.running && (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              padding: '9px 12px',
              borderRadius: 8,
              background: COLORS.accentTint,
              border: `1px solid ${COLORS.accentBorder}`,
              fontSize: 12,
              lineHeight: 1.5,
              animation: 'rise 300ms ease',
            }}
          >
            <span style={{ flex: 1, color: COLORS.text2 }}>{s.lastReply}</span>
            {a.versions.length > 1 && (
              <button
                type="button"
                onClick={() => {
                  s.undoLast(a);
                  s.setLastReply('');
                }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: A,
                  fontSize: 11,
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                Undo
              </button>
            )}
          </div>
        )}

        <Panel glass style={{ padding: 10, borderRadius: 12, boxShadow: '0 20px 50px rgba(0,0,0,.5)' }}>
          <div style={{ display: 'flex', gap: 9 }}>
            <span
              style={{ width: 10, height: 10, borderRadius: 5, background: A, marginTop: 4, flexShrink: 0 }}
            />
            <textarea
              rows={1}
              value={s.prompt}
              onChange={(e) => s.setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void s.submitPrompt();
                }
              }}
              placeholder={
                s.canGenerate
                  ? 'Describe the next version of this asset…'
                  : 'Connect a 3D provider in Settings to generate'
              }
              style={{
                flex: 1,
                resize: 'none',
                border: 'none',
                background: 'transparent',
                color: COLORS.text,
                fontSize: 13,
                lineHeight: 1.5,
              }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
            <span style={{ ...chipBtn, color: COLORS.muted }}>
              style: {s.settings.style}
            </span>
            <span style={chipBtn}>budget ≤ {s.settings.triBudget.toLocaleString()}</span>
            <div style={{ flex: 1 }} />
            <span style={{ fontFamily: mono, fontSize: 10, color: COLORS.muted }}>⌘⏎</span>
            <button
              type="button"
              onClick={() => void s.submitPrompt()}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                border: 'none',
                background: s.prompt.trim() && s.canGenerate ? A : '#8a5a22',
                color: COLORS.ink,
                fontWeight: 600,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              Apply
            </button>
          </div>
        </Panel>
      </div>

      {picking && (
        <div
          onClick={() => setPicking(false)}
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(13,14,17,.7)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 70,
          }}
        >
          <div onClick={(e) => e.stopPropagation()}>
          <Panel
            style={{
              width: 420,
              maxHeight: '70vh',
              overflowY: 'auto',
              padding: 16,
              borderRadius: 12,
              boxShadow: '0 30px 80px rgba(0,0,0,.6)',
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 600 }}>Add a motion clip</div>
            <p style={{ fontSize: 11, color: COLORS.muted, margin: '6px 0 12px', lineHeight: 1.6 }}>
              These are the actions your provider offers for a rigged model. Each one uses credits
              on your account.
            </p>
            {actions === null ? (
              <div style={{ fontSize: 12, color: COLORS.muted }}>Loading the motion list…</div>
            ) : actions.length === 0 ? (
              <div style={{ fontSize: 12, color: COLORS.muted, lineHeight: 1.6 }}>
                Your provider returned no actions. Check the key in Settings, or that your plan
                includes animation.
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 6 }}>
                {actions.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    onClick={() => {
                      setPicking(false);
                      void s.addClip(a, action).then((updated) => {
                        const fresh = updated?.clips.find((c) => c.status === 'review');
                        if (fresh) {
                          s.setClip(fresh.name);
                          s.setReviewing(true);
                        }
                      });
                    }}
                    style={{ ...outlineBtn, width: '100%', textAlign: 'left' }}
                  >
                    {action.name}
                  </button>
                ))}
              </div>
            )}
          </Panel>
          </div>
        </div>
      )}
    </>
  );
}

const outlineBtn = {
  flex: 1,
  padding: '8px 12px',
  borderRadius: 6,
  border: `1px solid ${COLORS.inputBorder}`,
  background: 'transparent',
  color: COLORS.text2,
  fontSize: 12,
  cursor: 'pointer',
} as const;

const chipBtn = {
  padding: '4px 9px',
  borderRadius: 4,
  border: `1px solid ${COLORS.inputBorder}`,
  background: 'transparent',
  color: COLORS.muted,
  fontSize: 11,
} as const;
