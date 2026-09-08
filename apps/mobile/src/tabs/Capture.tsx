import { useState } from 'react';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { COLORS, SUBJECTS } from '@forge/core';
import { Spinner, mono } from '@forge/ui';
import type { MobileSession } from '../session.js';

const A = COLORS.accent;

type Step = 'idle' | 'detecting' | 'ask' | 'chosen';

/**
 * Camera capture. The shot is taken with the real camera on device (falling
 * back to a framed placeholder in a browser); subject detection is still
 * scripted until `detect_subjects` is wired to the server.
 */
export function Capture({ s }: { s: MobileSession }) {
  const [step, setStep] = useState<Step>('idle');
  const [chosen, setChosen] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [shot, setShot] = useState<string | null>(null);

  const subject = chosen != null ? SUBJECTS[chosen] : null;

  const detect = () => {
    setStep('detecting');
    setTimeout(() => setStep('ask'), 1100);
  };

  const take = async (source: CameraSource) => {
    if (Capacitor.getPlatform() === 'web') {
      detect();
      return;
    }
    try {
      const photo = await Camera.getPhoto({
        quality: 85,
        source,
        resultType: CameraResultType.DataUrl,
        correctOrientation: true,
      });
      setShot(photo.dataUrl ?? null);
      detect();
    } catch {
      // The user dismissed the camera — stay where we are.
    }
  };

  const reset = () => {
    setStep('idle');
    setChosen(null);
    setNote('');
    setShot(null);
  };

  return (
    <div style={{ position: 'relative', height: '100%', background: '#0a0b0d' }}>
      {/* Viewfinder */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: shot
            ? `center / cover no-repeat url(${shot})`
            : 'linear-gradient(160deg, #23262b 0%, #15171a 55%, #0e1013 100%)',
        }}
      />
      {step === 'idle' && (
        <div
          style={{
            position: 'absolute',
            left: '12%',
            right: '12%',
            top: '22%',
            bottom: '34%',
            border: `2px solid ${A}`,
            borderRadius: 10,
          }}
        />
      )}

      {step !== 'idle' && step !== 'detecting' && (
        <div style={{ position: 'absolute', inset: 0 }}>
          {SUBJECTS.map((sub, i) => {
            const on = chosen === i;
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
                  border: `1.5px solid ${on ? A : 'rgba(245,158,59,.6)'}`,
                  background: on ? COLORS.accentTint : 'transparent',
                  borderRadius: 6,
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
                    color: on ? COLORS.ink : A,
                  }}
                >
                  {sub.name} · {sub.conf}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {step === 'detecting' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 9,
            fontSize: 13,
            color: COLORS.text,
            background: 'rgba(13,14,17,.55)',
          }}
        >
          <Spinner /> Finding the subject…
        </div>
      )}

      {/* Bottom sheet */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          padding: 14,
          background: 'linear-gradient(to top, rgba(13,14,17,.98) 60%, transparent)',
        }}
      >
        {step === 'idle' && (
          <>
            <div
              style={{
                padding: 11,
                borderRadius: 14,
                background: 'rgba(27,28,32,.9)',
                border: `1px solid ${COLORS.hairline}`,
                fontSize: 12,
                color: COLORS.text2,
                marginBottom: 14,
              }}
            >
              Fill the frame with one object, on a plain surface if you can. Forge estimates its
              real-world size from what is around it.
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <button type="button" onClick={() => void take(CameraSource.Photos)} style={sideBtn}>
                Gallery
              </button>
              <button
                type="button"
                onClick={() => void take(CameraSource.Camera)}
                aria-label="Take photo"
                style={{
                  width: 68,
                  height: 68,
                  borderRadius: 34,
                  border: '3px solid #fff',
                  background: 'transparent',
                  display: 'grid',
                  placeItems: 'center',
                  cursor: 'pointer',
                }}
              >
                <span style={{ width: 50, height: 50, borderRadius: 25, background: A }} />
              </button>
              <button type="button" onClick={() => s.say('Sprite sheets import from desktop')} style={sideBtn}>
                Sprites
              </button>
            </div>
          </>
        )}

        {step === 'ask' && (
          <div
            style={{
              padding: 14,
              borderRadius: 14,
              background: COLORS.panel,
              border: `1px solid ${COLORS.panelBorder}`,
            }}
          >
            <div style={{ fontSize: 13, marginBottom: 10 }}>
              I see {SUBJECTS.length} things. Tap the one to turn into an asset.
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
                  style={rowBtn}
                >
                  <span>{sub.name}</span>
                  <span style={{ fontFamily: mono, fontSize: 10, color: COLORS.muted }}>
                    {sub.conf}
                  </span>
                </button>
              ))}
            </div>
            <button type="button" onClick={reset} style={{ ...linkBtn, marginTop: 10 }}>
              Retake
            </button>
          </div>
        )}

        {step === 'chosen' && subject && (
          <div
            style={{
              padding: 14,
              borderRadius: 14,
              background: COLORS.panel,
              border: `1px solid ${COLORS.panelBorder}`,
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 600 }}>{subject.name}</div>
            <div style={{ fontFamily: mono, fontSize: 11, color: COLORS.muted, marginTop: 2 }}>
              {subject.size}
            </div>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Anything to adjust?"
              style={{
                width: '100%',
                height: 42,
                margin: '11px 0',
                padding: '0 12px',
                borderRadius: 8,
                background: COLORS.input,
                border: `1px solid ${COLORS.inputBorder}`,
                color: COLORS.text,
                fontSize: 13,
              }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={reset} style={{ ...rowBtn, justifyContent: 'center', flex: 1 }}>
                Retake
              </button>
              <button
                type="button"
                onClick={() => {
                  s.createFromCapture(subject, note);
                  reset();
                }}
                style={{
                  flex: 2,
                  padding: '12px 0',
                  borderRadius: 8,
                  border: 'none',
                  background: A,
                  color: COLORS.ink,
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Generate asset
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const sideBtn = {
  padding: '10px 14px',
  borderRadius: 8,
  border: `1px solid ${COLORS.inputBorder}`,
  background: 'rgba(27,28,32,.8)',
  color: COLORS.text2,
  fontSize: 12,
  cursor: 'pointer',
} as const;

const rowBtn = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '11px 12px',
  borderRadius: 8,
  border: `1px solid ${COLORS.inputBorder}`,
  background: 'transparent',
  color: COLORS.text2,
  fontSize: 13,
  cursor: 'pointer',
} as const;

const linkBtn = {
  background: 'none',
  border: 'none',
  color: COLORS.muted,
  fontSize: 12,
  cursor: 'pointer',
  padding: 0,
} as const;
