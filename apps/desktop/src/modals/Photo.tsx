import { useState } from 'react';
import { COLORS, SUBJECTS } from '@forge/core';
import { Panel, Spinner, mono } from '@forge/ui';
import { useSessionCtx } from '../session.js';
import { Backdrop, primaryBtn } from './Sprites.js';

const A = COLORS.accent;

type Step = 'empty' | 'detecting' | 'ask' | 'chosen';

/** Photo → asset: detect subjects, ask which one, then generate. */
export function PhotoModal() {
  const s = useSessionCtx();
  const [step, setStep] = useState<Step>('empty');
  const [chosen, setChosen] = useState<number | 'whole' | null>(null);
  const [note, setNote] = useState('');

  const subject =
    chosen === 'whole'
      ? { name: 'Whole scene', size: '2.1 m wide', kind: 'environment piece' }
      : chosen != null
        ? { ...SUBJECTS[chosen], kind: 'prop' }
        : null;

  const drop = () => {
    setStep('detecting');
    setTimeout(() => setStep('ask'), 1100);
  };

  const generate = () => {
    if (!subject) return;
    const name = subject.name.toLowerCase().replace(/\s+/g, '_');
    s.setModal(null);
    s.runJob(`${subject.name} from photo${note ? ' — ' + note : ''}`, () => {
      const created = s.newAsset({
        name,
        category: 'Prop',
        kind: 'prop',
        tris: '3,210',
        mats: 1,
        note: 'from photo',
        size: subject.size,
        prompt: `${subject.name} from photo`,
        anims: [{ name: 'idle', status: 'approved' }],
      });
      s.openAsset(created.id);
      s.setLastReply(
        `Built ${name} from your photo — background removed, scale estimated at ${subject.size}. Check the back; photos only show one side.`,
      );
    });
  };

  return (
    <Backdrop onClose={() => s.setModal(null)}>
      <Panel
        style={{
          width: 720,
          maxWidth: 'calc(100vw - 40px)',
          height: 460,
          display: 'flex',
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 30px 80px rgba(0,0,0,.6)',
        }}
      >
        <div style={{ flex: 1, background: COLORS.input, position: 'relative' }}>
          {step === 'empty' ? (
            <button
              type="button"
              onClick={drop}
              style={{
                position: 'absolute',
                inset: 16,
                borderRadius: 10,
                border: `1.5px dashed ${COLORS.inputBorder}`,
                background: 'transparent',
                color: COLORS.text2,
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              Drop a photo — or click to browse
              <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 6 }}>
                JPG, PNG or HEIC · one clear subject works best
              </div>
            </button>
          ) : (
            <div
              style={{
                position: 'absolute',
                inset: 16,
                borderRadius: 8,
                background:
                  'linear-gradient(160deg, #2a2c31 0%, #1c1e22 60%, #16171a 100%)',
                overflow: 'hidden',
              }}
            >
              {step === 'detecting' && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 9,
                    fontSize: 12,
                    color: COLORS.text2,
                  }}
                >
                  <Spinner /> Finding objects…
                </div>
              )}
              {step !== 'detecting' &&
                SUBJECTS.map((sub, i) => {
                  const on = chosen === i;
                  const dim = chosen != null && !on;
                  return (
                    <button
                      key={sub.name}
                      type="button"
                      onClick={() => {
                        setChosen(i);
                        setStep('chosen');
                      }}
                      style={{
                        position: 'absolute',
                        left: `${sub.x}%`,
                        top: `${sub.y}%`,
                        width: `${sub.w}%`,
                        height: `${sub.h}%`,
                        border: `1.5px solid ${on ? A : dim ? 'rgba(255,255,255,.15)' : 'rgba(245,158,59,.6)'}`,
                        background: on ? COLORS.accentTint : 'transparent',
                        borderRadius: 4,
                        cursor: 'pointer',
                      }}
                    >
                      <span
                        style={{
                          position: 'absolute',
                          top: -20,
                          left: -1,
                          padding: '2px 6px',
                          borderRadius: 4,
                          fontFamily: mono,
                          fontSize: 9,
                          whiteSpace: 'nowrap',
                          background: on ? A : 'rgba(27,28,32,.95)',
                          color: on ? COLORS.ink : dim ? COLORS.muted : A,
                        }}
                      >
                        {sub.name} · {sub.conf}
                      </span>
                    </button>
                  );
                })}
            </div>
          )}
        </div>

        <div
          style={{
            width: 280,
            padding: 16,
            borderLeft: `1px solid ${COLORS.panelBorder}`,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {step === 'ask' && (
            <>
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
                I found {SUBJECTS.length} objects. Which one should become the asset?
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                {SUBJECTS.map((sub, i) => (
                  <button
                    key={sub.name}
                    type="button"
                    onClick={() => {
                      setChosen(i);
                      setStep('chosen');
                    }}
                    style={listBtn}
                  >
                    {sub.name}
                    <span style={{ fontFamily: mono, fontSize: 10, color: COLORS.muted }}>
                      {sub.conf}
                    </span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setChosen('whole');
                    setStep('chosen');
                  }}
                  style={listBtn}
                >
                  Use the whole scene
                </button>
              </div>
            </>
          )}

          {step === 'chosen' && subject && (
            <>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{subject.name}</div>
              <div style={{ fontFamily: mono, fontSize: 11, color: COLORS.muted }}>
                {subject.size} · {subject.kind}
              </div>
              <textarea
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Anything to adjust? e.g. “make it look older, more dents”"
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
              <div style={{ flex: 1 }} />
              <button type="button" onClick={generate} style={primaryBtn}>
                Generate asset
              </button>
              <button
                type="button"
                onClick={() => {
                  setChosen(null);
                  setStep('ask');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: COLORS.muted,
                  fontSize: 11,
                  cursor: 'pointer',
                }}
              >
                Pick a different object
              </button>
            </>
          )}

          {(step === 'empty' || step === 'detecting') && (
            <div style={{ fontSize: 11, color: COLORS.muted, lineHeight: 1.55 }}>
              Forge removes the background, estimates real-world scale and builds a single closed
              mesh. Photos only show one side — check the back before you export.
            </div>
          )}
        </div>
      </Panel>
    </Backdrop>
  );
}

const listBtn = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '8px 10px',
  borderRadius: 6,
  border: `1px solid ${COLORS.inputBorder}`,
  background: 'transparent',
  color: COLORS.text2,
  fontSize: 12,
  cursor: 'pointer',
} as const;
