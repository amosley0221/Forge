import { COLORS } from '@forge/core';
import { Panel, mono } from '@forge/ui';
import { useSessionCtx } from '../session.js';
import { Backdrop } from './Sprites.js';

const A = COLORS.accent;

/** Hands the capture over to the linked phone; the asset syncs back. */
export function CameraModal() {
  const s = useSessionCtx();
  return (
    <Backdrop onClose={() => s.setModal(null)}>
      <Panel
        style={{
          width: 380,
          maxWidth: 'calc(100vw - 40px)',
          padding: 20,
          borderRadius: 12,
          textAlign: 'center',
          boxShadow: '0 30px 80px rgba(0,0,0,.6)',
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 600 }}>Continue on your phone</div>
        <p style={{ fontSize: 11, color: COLORS.muted, lineHeight: 1.55, margin: '8px 0 16px' }}>
          Scan this with the Forge Android app to shoot the object. The asset appears here as soon
          as it is built.
        </p>
        <div
          style={{
            width: 160,
            height: 160,
            margin: '0 auto',
            borderRadius: 8,
            background:
              'repeating-conic-gradient(#e6e4df 0% 25%, #16171a 0% 50%) 50% / 16px 16px',
            border: `1px solid ${COLORS.panelBorder}`,
          }}
        />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 7,
            margin: '16px 0 4px',
            fontSize: 11,
            color: A,
            animation: 'pulse 1.4s infinite',
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: 3, background: A }} />
          Listening for the Android app…
        </div>
        <div style={{ fontFamily: mono, fontSize: 10, color: COLORS.muted }}>code K7M-2QX · 5 min</div>
        <button
          type="button"
          onClick={() => s.say('Open Forge on your phone and tap Capture')}
          style={{
            marginTop: 14,
            background: 'none',
            border: 'none',
            color: A,
            fontSize: 11,
            cursor: 'pointer',
          }}
        >
          Open the Android app ↗
        </button>
      </Panel>
    </Backdrop>
  );
}
