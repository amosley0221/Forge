import { useRef, useState } from 'react';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { COLORS, cropToDataUrl, decodeImage, prepareImage } from '@forge/core';
import { mono } from '@forge/ui';
import type { MobileSession } from '../session.js';

const A = COLORS.accent;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Photograph an object and turn it into a model. There is no fake object
 * detection: the user drags a box around the thing they want, and exactly that
 * crop of their real photo is what gets sent to the provider.
 */
export function Capture({ s }: { s: MobileSession }) {
  const [photo, setPhoto] = useState<string | null>(null);
  // Views already cropped and kept. The one on screen is added when you
  // generate, so a single photo behaves exactly as it always did.
  const [views, setViews] = useState<string[]>([]);
  const [rect, setRect] = useState<Rect>({ x: 0.15, y: 0.2, w: 0.7, h: 0.55 });
  const [note, setNote] = useState('');
  const frame = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{ ox: number; oy: number; rect: Rect } | null>(null);

  const take = async (source: CameraSource) => {
    if (!Capacitor.isNativePlatform()) {
      s.say('The camera is available in the installed Android app.');
      return;
    }
    try {
      const shot = await Camera.getPhoto({
        quality: 90,
        source,
        resultType: CameraResultType.DataUrl,
        correctOrientation: true,
      });
      if (shot.dataUrl) {
        setPhoto(shot.dataUrl);
        setRect({ x: 0.15, y: 0.2, w: 0.7, h: 0.55 });
      }
    } catch {
      // Dismissed the camera — nothing to do.
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const box = frame.current?.getBoundingClientRect();
    if (!box) return;
    drag.current = {
      ox: (e.clientX - box.left) / box.width,
      oy: (e.clientY - box.top) / box.height,
      rect,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const box = frame.current?.getBoundingClientRect();
    const d = drag.current;
    if (!box || !d) return;
    const dx = (e.clientX - box.left) / box.width - d.ox;
    const dy = (e.clientY - box.top) / box.height - d.oy;
    setRect({
      x: Math.min(Math.max(0, d.rect.x + dx), 1 - d.rect.w),
      y: Math.min(Math.max(0, d.rect.y + dy), 1 - d.rect.h),
      w: d.rect.w,
      h: d.rect.h,
    });
  };

  const resize = (delta: number) =>
    setRect((r) => {
      const w = Math.min(1, Math.max(0.15, r.w + delta));
      const h = Math.min(1, Math.max(0.15, r.h + delta));
      return {
        w,
        h,
        x: Math.min(r.x, 1 - w),
        y: Math.min(r.y, 1 - h),
      };
    });

  /** The current photo, cropped to the box and scaled for the provider. */
  const cropCurrent = async (): Promise<string | null> => {
    if (!photo) return null;
    const image = await decodeImage(await (await fetch(photo)).blob());
    const w = 'width' in image ? image.width : 0;
    const h = 'height' in image ? image.height : 0;
    const dataUrl = await cropToDataUrl(image, {
      x: rect.x * w,
      y: rect.y * h,
      w: rect.w * w,
      h: rect.h * h,
    });
    // The crop is a full-resolution PNG; scale it before it goes over the wire
    // base64-encoded, where a phone photo is megabytes for no extra detail.
    return (await prepareImage(dataUrl)).dataUrl;
  };

  /**
   * Keep this view and go back for another. Several views of one subject beat
   * a single view by a long way: from one photo the reconstruction has to
   * invent the far side, and reads flat high-contrast features as their own
   * floating shells.
   */
  const addView = async () => {
    const cropped = await cropCurrent();
    if (!cropped) return;
    setViews((prev) => [...prev, cropped].slice(0, 4));
    setPhoto(null);
    s.say(`${Math.min(4, views.length + 1)} of 4 views kept — photograph the next angle`);
  };

  const generate = async () => {
    if (!photo && !views.length) return;
    if (!s.canGenerate) {
      s.say('Connect a 3D provider in Settings to generate.');
      return;
    }
    const current = await cropCurrent();
    const all = [...views, ...(current ? [current] : [])].slice(0, 4);
    if (!all.length) return;

    const asset = await s.generate({
      prompt: note.trim() || 'object photographed with the phone camera',
      category: s.category,
      ...(all.length > 1 ? { imageUrls: all } : { imageUrl: all[0] }),
    });
    if (asset) {
      setPhoto(null);
      setViews([]);
      setNote('');
      s.open(asset.id);
    }
  };

  return (
    <div style={{ position: 'relative', height: '100%', background: '#0a0b0d' }}>
      <div
        ref={frame}
        style={{
          position: 'absolute',
          inset: 0,
          background: photo
            ? `center / contain no-repeat url(${photo})`
            : 'linear-gradient(160deg, #23262b 0%, #15171a 55%, #0e1013 100%)',
          backgroundColor: '#0a0b0d',
        }}
      >
        {photo && (
          <div
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={() => (drag.current = null)}
            style={{
              position: 'absolute',
              left: `${rect.x * 100}%`,
              top: `${rect.y * 100}%`,
              width: `${rect.w * 100}%`,
              height: `${rect.h * 100}%`,
              border: `2px solid ${A}`,
              borderRadius: 8,
              background: 'rgba(245,158,59,.08)',
              touchAction: 'none',
              cursor: 'move',
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: -22,
                left: 0,
                padding: '2px 7px',
                borderRadius: 4,
                background: A,
                color: COLORS.ink,
                fontFamily: mono,
                fontSize: 9,
                whiteSpace: 'nowrap',
              }}
            >
              drag to frame the object
            </span>
          </div>
        )}
      </div>

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
        {!photo ? (
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
                lineHeight: 1.5,
              }}
            >
              Fill the frame with one object on a plain surface. You will draw a box around it
              before anything is sent anywhere.
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
              <div style={{ width: 74 }} />
            </div>

            {/* Views already kept, so they can be seen and used without having
                to take one more photo first. */}
            {views.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginTop: 12,
                  padding: 10,
                  borderRadius: 12,
                  background: COLORS.panel,
                  border: `1px solid ${COLORS.accentBorder}`,
                }}
              >
                <div style={{ display: 'flex', gap: 5 }}>
                  {views.map((v, i) => (
                    <img
                      key={i}
                      src={v}
                      alt=""
                      style={{ width: 38, height: 38, borderRadius: 6, objectFit: 'cover' }}
                    />
                  ))}
                </div>
                <div style={{ flex: 1, minWidth: 0, fontSize: 11, color: COLORS.text2 }}>
                  {views.length} view{views.length > 1 ? 's' : ''} kept
                </div>
                <button
                  type="button"
                  onClick={() => setViews([])}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: COLORS.muted,
                    fontSize: 11,
                    cursor: 'pointer',
                  }}
                >
                  clear
                </button>
                <button
                  type="button"
                  onClick={() => void generate()}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: 'none',
                    background: A,
                    color: COLORS.ink,
                    fontWeight: 600,
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  Generate
                </button>
              </div>
            )}
          </>
        ) : (
          <div
            style={{
              padding: 14,
              borderRadius: 14,
              background: COLORS.panel,
              border: `1px solid ${COLORS.panelBorder}`,
            }}
          >
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <button type="button" onClick={() => resize(-0.08)} style={smallBtn}>
                − smaller box
              </button>
              <button type="button" onClick={() => resize(0.08)} style={smallBtn}>
                + bigger box
              </button>
            </div>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Describe it, if you like — helps the model"
              style={{
                width: '100%',
                height: 42,
                marginBottom: 10,
                padding: '0 12px',
                borderRadius: 8,
                background: COLORS.input,
                border: `1px solid ${COLORS.inputBorder}`,
                color: COLORS.text,
                fontSize: 13,
              }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => setPhoto(null)} style={{ ...smallBtn, flex: 1 }}>
                Retake
              </button>
              <button
                type="button"
                onClick={() => void addView()}
                disabled={views.length >= 3}
                title="Keep this view and photograph another angle"
                style={{
                  flex: 1,
                  padding: '12px 0',
                  borderRadius: 8,
                  border: `1px solid ${COLORS.inputBorder}`,
                  background: 'transparent',
                  color: views.length >= 3 ? COLORS.disabled : COLORS.text2,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                + another view
              </button>
              <button
                type="button"
                onClick={() => void generate()}
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
                {views.length ? `Generate from ${views.length + 1} views` : 'Generate from this crop'}
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

const smallBtn = {
  padding: '10px 12px',
  borderRadius: 8,
  border: `1px solid ${COLORS.inputBorder}`,
  background: 'transparent',
  color: COLORS.text2,
  fontSize: 12,
  cursor: 'pointer',
} as const;
