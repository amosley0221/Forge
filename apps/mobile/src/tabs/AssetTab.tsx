import { useEffect, useRef, useState } from 'react';
import { COLORS, ago, formatSize, formatTris } from '@forge/core';
import type { MeshyAction } from '@forge/core';
import { Appearance, ForgeViewer, StatusTag, mono } from '@forge/ui';
import type { ViewerEngine } from '@forge/ui';
import type { MobileSession } from '../session.js';

const A = COLORS.accent;

export function AssetTab({ s }: { s: MobileSession }) {
  const viewer = useRef<ViewerEngine | null>(null);
  const [pose, setPose] = useState(false);
  const [riggedInFile, setRiggedInFile] = useState(false);
  const [held, setHeld] = useState<string | null>(null);
  const a = s.active;
  const v = s.version;
  const [actions, setActions] = useState<MeshyAction[] | null>(null);
  const [picking, setPicking] = useState(false);

  const rigged = a ? [...a.versions].reverse().find((x) => x.riggedTaskId) : undefined;

  useEffect(() => {
    if (!picking || actions) return;
    void s.motionActions().then(setActions);
  }, [picking, actions, s]);

  if (!a || !v) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px' }}>
        <button
          type="button"
          onClick={() => s.setTab('Library')}
          aria-label="Back"
          style={{ background: 'none', border: 'none', color: COLORS.muted, fontSize: 18, cursor: 'pointer', padding: 0 }}
        >
          ‹
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{a.name}</div>
          <div style={{ fontFamily: mono, fontSize: 10, color: COLORS.muted }}>
            {v.label} · {formatTris(v.stats.triangles)} tris · {v.note}
          </div>
        </div>
        <button type="button" onClick={() => s.goTab('Export')} style={lightBtn}>
          Export
        </button>
      </div>

      <div style={{ padding: '0 14px', flex: 1, overflowY: 'auto' }}>
        <div
          style={{
            position: 'relative',
            height: 300,
            borderRadius: 14,
            overflow: 'hidden',
            border: `1px solid ${COLORS.hairline}`,
            background: COLORS.surface,
          }}
        >
          <ForgeViewer
            url={s.modelUrl}
            clip={s.clip}
            selected={s.selected}
            autorotate={!s.clip && !pose}
            compact
            pose={pose}
            engineRef={viewer}
            emptyMessage="This version’s model file is not on this device. Sync to download it."
            onPick={(part) => s.setSelected(part)}
            onSkeleton={(hasBones) => {
              setRiggedInFile(hasBones);
              if (!hasBones) setPose(false);
            }}
            onPoseBone={setHeld}
          />

          {riggedInFile && (
            <div style={{ position: 'absolute', right: 8, bottom: 8, display: 'flex', gap: 6 }}>
              {pose && (
                <button type="button" onClick={() => viewer.current?.resetPose()} style={hudBtn(false)}>
                  Reset
                </button>
              )}
              <button type="button" onClick={() => setPose(!pose)} style={hudBtn(pose)}>
                {pose ? (held ?? 'Posing') : 'Pose'}
              </button>
            </div>
          )}
          {a.clips.length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: 8,
                left: 8,
                right: 8,
                display: 'flex',
                gap: 5,
                overflowX: 'auto',
              }}
            >
              {a.clips.map((c) => {
                const on = s.clip === c.name;
                return (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => {
                      const next = on ? null : c.name;
                      s.setClip(next);
                      s.setReviewing(next != null && c.status === 'review');
                    }}
                    style={{
                      padding: '4px 11px',
                      borderRadius: 20,
                      fontSize: 11,
                      whiteSpace: 'nowrap',
                      border: `1px solid ${on ? A : c.status === 'review' ? COLORS.accentBorder2 : COLORS.inputBorder}`,
                      background: on ? A : 'rgba(27,28,32,.9)',
                      color: on ? COLORS.ink : c.status === 'review' ? A : COLORS.muted,
                      cursor: 'pointer',
                    }}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
          )}
          <div
            style={{
              position: 'absolute',
              left: 10,
              bottom: 8,
              fontFamily: mono,
              fontSize: 9,
              color: COLORS.muted,
            }}
          >
            {s.selected ? `${s.selected} selected` : 'tap a part · drag to orbit · pinch to zoom'}
          </div>
        </div>

        {/* Real numbers, read from the file */}
        <div style={{ marginTop: 12 }}>
          {[
            ['Triangles', formatTris(v.stats.triangles)],
            ['Materials', String(v.stats.materials)],
            ['Size', v.stats.sizeMeters ? formatSize(v.stats.sizeMeters) : '—'],
            ['Clips in file', v.stats.clipNames.length ? v.stats.clipNames.join(' · ') : 'none'],
            ['Created', ago(v.createdAt)],
          ].map(([k, val]) => (
            <div
              key={k}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                padding: '9px 0',
                fontSize: 12,
                borderTop: `1px solid ${COLORS.hairline}`,
              }}
            >
              <span style={{ color: COLORS.muted }}>{k}</span>
              <span style={{ fontFamily: mono, textAlign: 'right' }}>{val}</span>
            </div>
          ))}
        </div>

        {s.reviewing && s.clip && (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 14,
              background: COLORS.accentTint,
              border: `1px solid ${COLORS.accentBorder}`,
            }}
          >
            <div style={{ fontSize: 12, marginBottom: 10 }}>
              Watch the {s.clip} loop. Does it read right?
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => {
                  s.setClipStatus(a, s.clip!, 'approved', `${a.name}: ${s.clip} approved`);
                  s.setReviewing(false);
                }}
                style={{ ...bigBtn, background: COLORS.ok, color: COLORS.onOk, border: 'none' }}
              >
                Looks good
              </button>
              <button
                type="button"
                onClick={() => {
                  s.setClipStatus(a, s.clip!, 'rework', `${a.name}: ${s.clip} needs work`);
                  s.setReviewing(false);
                }}
                style={bigBtn}
              >
                Needs work
              </button>
            </div>
          </div>
        )}

        {/* Motion */}
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Motion</div>
          {!s.canRig ? (
            <p style={{ fontSize: 11, color: COLORS.muted, lineHeight: 1.6, margin: 0 }}>
              Rigging and motion clips come from Meshy. Connect a Meshy key in Settings to use them.
            </p>
          ) : !v.taskId && !rigged ? (
            <p style={{ fontSize: 11, color: COLORS.muted, lineHeight: 1.6, margin: 0 }}>
              This model was imported rather than generated here, so there is no provider task to
              rig. Generate a model in Forge to rig and animate it.
            </p>
          ) : !rigged ? (
            <button type="button" onClick={() => void s.rig(a)} style={{ ...bigBtn, width: '100%' }}>
              Rig this model
            </button>
          ) : (
            <>
              <p style={{ fontSize: 11, color: COLORS.muted, lineHeight: 1.6, margin: '0 0 8px' }}>
                Rigged. Add a motion clip and it arrives ready for you to review.
              </p>
              <button
                type="button"
                onClick={() => setPicking(true)}
                style={{ ...bigBtn, width: '100%' }}
              >
                Add a motion clip
              </button>
            </>
          )}
        </div>

        {s.lastReply && !s.job.running && (
          <div
            style={{
              marginTop: 12,
              padding: 11,
              borderRadius: '14px 14px 14px 4px',
              background: COLORS.accentTint,
              border: `1px solid ${COLORS.accentBorder}`,
              fontSize: 12,
              lineHeight: 1.5,
              color: COLORS.text2,
            }}
          >
            {s.lastReply}
          </div>
        )}

        {/* Appearance */}
        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Appearance</div>
          <Appearance
            asset={a}
            canRestyle={v.provider === 'meshy' && Boolean(v.taskId)}
            busy={s.job.running}
            onRestyle={(description) => void s.restyle(a, description)}
            compact
          />
        </div>

        {a.versions.length > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, margin: '16px 0 0', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '.08em', color: COLORS.muted }}>
              HISTORY
            </span>
            {a.versions.map((ver, i) => {
              const on = i === a.cur;
              return (
                <button
                  key={ver.label}
                  type="button"
                  onClick={() => s.selectVersion(a, i)}
                  title={ver.note}
                  style={{
                    padding: '4px 9px',
                    borderRadius: 5,
                    border: `1px solid ${on ? A : COLORS.inputBorder}`,
                    background: 'transparent',
                    color: on ? A : COLORS.muted,
                    fontFamily: mono,
                    fontSize: 10,
                    cursor: 'pointer',
                  }}
                >
                  {ver.label}
                  {ver.device === 'android' ? '·A' : ''}
                </button>
              );
            })}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, margin: '16px 0 20px' }}>
          {a.versions.length > 1 && (
            <button type="button" onClick={() => s.undoLast(a)} style={{ ...bigBtn, flex: 1 }}>
              Undo last version
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (confirm(`Delete ${a.name} and all its versions from this device?`)) {
                void s.removeAsset(a);
                s.setTab('Library');
              }
            }}
            style={{ ...bigBtn, flex: 1, color: COLORS.danger, borderColor: 'rgba(255,95,87,.4)' }}
          >
            Delete
          </button>
        </div>
      </div>

      {/* Prompt row — makes a new version of this asset */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 14px',
          borderTop: `1px solid ${COLORS.hairline}`,
          background: COLORS.surface,
        }}
      >
        <input
          value={s.prompt}
          onChange={(e) => s.setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void s.submitPrompt();
          }}
          placeholder={s.canGenerate ? 'Describe a new version…' : 'Connect a provider to generate'}
          disabled={!s.canGenerate}
          style={{
            flex: 1,
            height: 44,
            padding: '0 12px',
            borderRadius: 8,
            background: COLORS.input,
            border: `1px solid ${COLORS.inputBorder}`,
            color: COLORS.text,
            fontSize: 13,
          }}
        />
        <button
          type="button"
          onClick={() => void s.submitPrompt()}
          aria-label="Generate"
          style={{
            width: 44,
            height: 44,
            borderRadius: 8,
            border: 'none',
            background: s.prompt.trim() && s.canGenerate ? A : '#8a5a22',
            color: COLORS.ink,
            fontSize: 16,
            cursor: 'pointer',
          }}
        >
          →
        </button>
      </div>

      {picking && (
        <div
          onClick={() => setPicking(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(13,14,17,.7)',
            display: 'flex',
            alignItems: 'flex-end',
            zIndex: 70,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxHeight: '70vh',
              overflowY: 'auto',
              padding: '16px 14px calc(16px + env(safe-area-inset-bottom))',
              borderRadius: '16px 16px 0 0',
              background: COLORS.panel,
              border: `1px solid ${COLORS.panelBorder}`,
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Add a motion clip</div>
            <p style={{ fontSize: 11, color: COLORS.muted, margin: '0 0 12px' }}>
              These are the actions your provider offers for a rigged model. Each one uses credits.
            </p>
            {actions === null ? (
              <div style={{ fontSize: 12, color: COLORS.muted, padding: '12px 0' }}>
                Loading the motion list…
              </div>
            ) : actions.length === 0 ? (
              <div style={{ fontSize: 12, color: COLORS.muted, padding: '12px 0', lineHeight: 1.6 }}>
                Your provider did not return any actions. Check the key in Settings, or that your
                plan includes animation.
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
                    style={{ ...bigBtn, width: '100%', textAlign: 'left' }}
                  >
                    {action.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {a.clips.some((c) => c.status !== 'approved') && (
        <div style={{ position: 'absolute', top: 0, right: 0, padding: 6 }}>
          <StatusTag status="review" />
        </div>
      )}
    </div>
  );
}

const bigBtn = {
  flex: 1,
  padding: '11px 14px',
  borderRadius: 8,
  border: `1px solid ${COLORS.inputBorder}`,
  background: 'transparent',
  color: COLORS.text2,
  fontSize: 13,
  cursor: 'pointer',
} as const;

const lightBtn = {
  padding: '7px 13px',
  borderRadius: 6,
  border: 'none',
  background: COLORS.light,
  color: COLORS.lightInk,
  fontWeight: 600,
  fontSize: 12,
  cursor: 'pointer',
} as const;

/** Small overlay control sitting on the viewport. */
function hudBtn(on: boolean) {
  return {
    padding: '7px 12px',
    borderRadius: 999,
    border: `1px solid ${on ? A : COLORS.inputBorder}`,
    background: on ? COLORS.accentTint : 'rgba(13,14,17,.72)',
    color: on ? A : COLORS.text2,
    fontFamily: mono,
    fontSize: 10,
    cursor: 'pointer',
  } as const;
}
