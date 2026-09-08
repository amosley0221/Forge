import { useCallback, useRef, useState } from 'react';
import { COLORS, HUES, SPRITE_SHEETS, randomTris } from '@forge/core';
import { Panel, mono } from '@forge/ui';
import { useSessionCtx } from '../session.js';
import type { Session } from '../session.js';

const A = COLORS.accent;

type SheetState = 'read' | 'queued' | 'building' | 'done';
interface Sheet {
  name: string;
  hue: string;
  state: SheetState;
  pct: number;
}

export type SpriteBatch = ReturnType<typeof useSpriteBatch>;

/**
 * Batch state lives above the modal so the "Batch n / m" pill in the top bar
 * keeps counting after the user closes it — as the copy promises.
 */
export function useSpriteBatch(session: Session) {
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [queue, setQueue] = useState<'idle' | 'running' | 'finished'>('idle');
  const [done, setDone] = useState(0);
  const [note, setNote] = useState('');
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const drop = useCallback(() => {
    setSheets(SPRITE_SHEETS.map((n, i) => ({ name: n, hue: HUES[i % 5], state: 'read', pct: 0 })));
    setQueue('idle');
    setDone(0);
  }, []);

  const start = useCallback(() => {
    setSheets((prev) => prev.map((s) => ({ ...s, state: 'queued', pct: 0 })));
    setQueue('running');
    setDone(0);
    clearInterval(timer.current);
    let i = 0;
    timer.current = setInterval(() => {
      setSheets((prev) => {
        if (i >= prev.length) {
          clearInterval(timer.current);
          setQueue('finished');
          session.say(`All ${prev.length} creatures built and synced to Android`);
          return prev;
        }
        const next = prev.map((s, idx) =>
          idx === i ? { ...s, state: 'building' as SheetState, pct: Math.min(100, s.pct + 25) } : s,
        );
        if (next[i].pct >= 100) {
          next[i] = { ...next[i], state: 'done' };
          session.newAsset({
            name: next[i].name,
            category: 'Creature',
            kind: 'creature',
            variant: i % 5,
            tris: randomTris(5, 3),
            mats: 1,
            note: 'from sprite sheet',
            size: (0.5 + (i % 4) * 0.2).toFixed(1) + ' m',
            prompt: `${next[i].name}_sheet.png · 8 dir × 6 frames${note ? ' — ' + note : ''}`,
            anims: [
              { name: 'idle', status: 'approved' },
              { name: 'walk', status: 'review' },
              { name: 'run', status: 'review' },
            ],
          });
          i += 1;
          setDone(i);
        }
        return next;
      });
    }, 320);
  }, [note, session]);

  const stop = useCallback(() => clearInterval(timer.current), []);

  return { sheets, queue, done, note, setNote, drop, start, stop, total: sheets.length };
}

export function SpritesModal({ batch }: { batch: SpriteBatch }) {
  const s = useSessionCtx();
  const loaded = batch.sheets.length > 0;

  const aiNote =
    batch.queue === 'idle'
      ? `I read ${batch.total} sheets: quadruped cycles in all of them, 64×64 frames, 8 directions. Palettes are consistent, so I'll match them. Anything to add before I start?`
      : batch.queue === 'running'
        ? 'Building in order. Each creature gets a rig plus idle / walk / run clips lifted from its sheet — you approve the motion afterwards.'
        : 'Done. Walk and run clips are waiting for your review on each creature.';

  return (
    <Backdrop onClose={() => s.setModal(null)}>
      <Panel
        style={{
          width: 780,
          maxWidth: 'calc(100vw - 40px)',
          height: 520,
          maxHeight: 'calc(100vh - 60px)',
          display: 'flex',
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 30px 80px rgba(0,0,0,.6)',
        }}
      >
        {/* Left: drop zone / sheet grid */}
        <div style={{ flex: 1, background: COLORS.input, padding: 16, overflowY: 'auto' }}>
          {!loaded ? (
            <button
              type="button"
              onClick={batch.drop}
              style={{
                width: '100%',
                height: '100%',
                borderRadius: 10,
                border: `1.5px dashed ${COLORS.inputBorder}`,
                background: 'transparent',
                color: COLORS.text2,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 500 }}>
                Drop sprite sheets — one or a whole folder
              </div>
              <div style={{ fontSize: 11, color: COLORS.muted }}>
                PNG, GIF or Aseprite · up to 200 sheets · uniform frame grids read best
              </div>
              <span
                style={{
                  marginTop: 10,
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: `1px solid ${COLORS.accentBorder2}`,
                  color: A,
                  fontSize: 12,
                }}
              >
                Try with 12 sample sheets
              </span>
            </button>
          ) : (
            <>
              <div style={{ fontSize: 12, marginBottom: 12, color: COLORS.text2 }}>
                {batch.total} sheets detected · creatures/ · 64×64 frames · 8 dir × 6
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                  gap: 8,
                }}
              >
                {batch.sheets.map((sh) => (
                  <div
                    key={sh.name}
                    style={{
                      padding: 8,
                      borderRadius: 8,
                      background: COLORS.panel,
                      border: `1px solid ${sh.state === 'building' ? COLORS.accentBorder2 : COLORS.panelBorder}`,
                    }}
                  >
                    <div
                      style={{
                        height: 34,
                        borderRadius: 4,
                        background: sh.hue,
                        opacity: sh.state === 'done' ? 1 : 0.55,
                      }}
                    />
                    <div style={{ fontSize: 11, marginTop: 6 }}>{sh.name}</div>
                    <div
                      style={{
                        fontFamily: mono,
                        fontSize: 9,
                        color:
                          sh.state === 'done'
                            ? COLORS.ok
                            : sh.state === 'building'
                              ? A
                              : COLORS.muted,
                      }}
                    >
                      {sh.state === 'done'
                        ? 'done ✓'
                        : sh.state === 'building'
                          ? 'building'
                          : sh.state === 'queued'
                            ? 'queued'
                            : 'read ✓'}
                    </div>
                    <div style={{ height: 2, background: COLORS.control, marginTop: 5 }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${sh.pct}%`,
                          background: sh.state === 'done' ? COLORS.ok : A,
                          transition: 'width 300ms ease',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Right: agent + batch settings */}
        <div
          style={{
            width: 280,
            padding: 16,
            borderLeft: `1px solid ${COLORS.panelBorder}`,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            overflowY: 'auto',
          }}
        >
          <div
            style={{
              padding: 10,
              borderRadius: '8px 8px 8px 2px',
              background: COLORS.accentTint,
              border: `1px solid ${COLORS.accentBorder}`,
              fontSize: 11,
              lineHeight: 1.55,
              color: COLORS.text2,
            }}
          >
            {loaded ? aiNote : 'Drop a folder and I’ll read every sheet before building anything.'}
          </div>

          {loaded && (
            <>
              <div style={{ display: 'grid', gap: 1 }}>
                {[
                  ['Style', s.defaults.style],
                  ['Budget', `≤ 8,000 tris`],
                  ['Rig', 'auto-detect'],
                  ['Clips', 'idle · walk · run'],
                ].map(([k, val]) => (
                  <div
                    key={k}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '7px 0',
                      fontSize: 11,
                      borderTop: `1px solid ${COLORS.hairline}`,
                    }}
                  >
                    <span style={{ color: COLORS.muted }}>{k}</span>
                    <span style={{ fontFamily: mono }}>{val}</span>
                  </div>
                ))}
              </div>

              {batch.queue === 'idle' && (
                <textarea
                  rows={3}
                  value={batch.note}
                  onChange={(e) => batch.setNote(e.target.value)}
                  placeholder="Anything to steer the batch? e.g. “keep them chunky, no thin legs”"
                  style={{
                    width: '100%',
                    resize: 'none',
                    padding: 9,
                    borderRadius: 6,
                    background: COLORS.input,
                    border: `1px solid ${COLORS.inputBorder}`,
                    color: COLORS.text,
                    fontSize: 11,
                  }}
                />
              )}

              {batch.queue === 'running' && (
                <div>
                  <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 6 }}>
                    {batch.done} / {batch.total} built · ~
                    {Math.max(0, (batch.total - batch.done) * 1.3).toFixed(0)} s left
                  </div>
                  <div style={{ height: 4, borderRadius: 2, background: COLORS.control }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${batch.total ? (100 * batch.done) / batch.total : 0}%`,
                        background: A,
                        borderRadius: 2,
                        transition: 'width 300ms ease',
                      }}
                    />
                  </div>
                  <p style={{ fontSize: 11, color: COLORS.muted, lineHeight: 1.5 }}>
                    You can close this — finished creatures appear in your library and on Android as
                    they complete.
                  </p>
                </div>
              )}

              <div style={{ flex: 1 }} />

              {batch.queue === 'idle' && (
                <button type="button" onClick={batch.start} style={primaryBtn}>
                  Generate all {batch.total}
                </button>
              )}
              {batch.queue === 'finished' && (
                <button
                  type="button"
                  onClick={() => {
                    const c = s.assets.find(
                      (x) => x.kind === 'creature' && (x.anims || []).some((k) => k.status === 'review'),
                    );
                    s.setModal(null);
                    if (c) {
                      s.openAsset(c.id);
                      s.setMode('Animate');
                      s.setAnim('walk');
                      s.setReviewing(true);
                    }
                  }}
                  style={primaryBtn}
                >
                  Review animations
                </button>
              )}
            </>
          )}
        </div>
      </Panel>
    </Backdrop>
  );
}

export function Backdrop({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(13,14,17,.7)',
        backdropFilter: 'blur(6px)',
        zIndex: 70,
      }}
    >
      <div onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  );
}

export const primaryBtn = {
  width: '100%',
  padding: '9px 0',
  borderRadius: 6,
  border: 'none',
  background: A,
  color: COLORS.ink,
  fontWeight: 600,
  fontSize: 12,
  cursor: 'pointer',
} as const;
