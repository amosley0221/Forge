import { COLORS, ago, approvedCount, reviewCount } from '@forge/core';
import { mono } from '@forge/ui';
import type { MobileSession } from '../session.js';
import { UpdateBanner } from '../components/UpdateBanner.js';

const A = COLORS.accent;

export function Library({ s }: { s: MobileSession }) {
  const needsReview = s.assets.filter((x) => reviewCount(x) > 0);
  const pending = needsReview.reduce((n, x) => n + reviewCount(x), 0);

  const filtered = s.assets.filter((x) =>
    s.filter === 'All'
      ? true
      : s.filter === 'Creatures'
        ? x.kind === 'creature'
        : reviewCount(x) > 0,
  );

  return (
    <div style={{ padding: '14px 14px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>Dustline</div>
          <div style={{ fontSize: 11, color: COLORS.muted }}>{s.assets.length} assets</div>
        </div>
        <div style={{ flex: 1 }} />
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
      </div>

      <UpdateBanner say={s.say} />

      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {['All', 'Creatures', 'Needs review'].map((f) => {
          const on = f === s.filter;
          return (
            <button
              key={f}
              type="button"
              onClick={() => s.setFilter(f)}
              style={{
                padding: '7px 13px',
                borderRadius: 20,
                border: `1px solid ${on ? A : COLORS.inputBorder}`,
                background: on ? A : 'transparent',
                color: on ? COLORS.ink : COLORS.muted,
                fontSize: 12,
                fontWeight: on ? 600 : 400,
                cursor: 'pointer',
              }}
            >
              {f}
            </button>
          );
        })}
      </div>

      {pending > 0 && (
        <button
          type="button"
          onClick={() => {
            const x = needsReview[0];
            s.open(x.id);
            const clip = (x.anims || []).find((c) => c.status === 'review');
            if (clip) {
              s.setAnim(clip.name);
              s.setReviewing(true);
            }
          }}
          style={{
            width: '100%',
            textAlign: 'left',
            padding: 12,
            borderRadius: 14,
            marginBottom: 12,
            border: `1px solid ${COLORS.accentBorder}`,
            background: COLORS.accentTint,
            color: COLORS.text,
            cursor: 'pointer',
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: A }}>
            {pending} animation{pending > 1 ? 's' : ''} to review
          </div>
          <div style={{ fontSize: 11, color: COLORS.text2, marginTop: 3 }}>
            Generated on desktop — check them here →
          </div>
        </button>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, paddingBottom: 20 }}>
        {filtered.map((x) => {
          const v = x.versions[x.cur];
          const rv = reviewCount(x);
          const ap = approvedCount(x);
          const isAndroid = x.device === 'android';
          return (
            <button
              key={x.id}
              type="button"
              onClick={() => s.open(x.id)}
              style={{
                textAlign: 'left',
                padding: 9,
                borderRadius: 14,
                border: `1px solid ${COLORS.hairline}`,
                background: COLORS.panel,
                color: COLORS.text,
                cursor: 'pointer',
              }}
            >
              <div
                style={{
                  position: 'relative',
                  height: 84,
                  borderRadius: 10,
                  background:
                    'repeating-linear-gradient(135deg, #22242a, #22242a 8px, #1e2025 8px, #1e2025 16px)',
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    top: 5,
                    right: 5,
                    padding: '1px 6px',
                    borderRadius: 4,
                    fontFamily: mono,
                    fontSize: 9,
                    background: isAndroid ? COLORS.okTint : COLORS.hairline,
                    color: isAndroid ? COLORS.ok : COLORS.muted,
                  }}
                >
                  {x.device}
                </span>
                {(rv > 0 || ap > 0) && (
                  <span
                    style={{
                      position: 'absolute',
                      left: 6,
                      bottom: 5,
                      fontSize: 9,
                      color: rv ? A : COLORS.ok,
                    }}
                  >
                    {rv ? `${rv} to review` : `${ap} clip${ap > 1 ? 's' : ''} ✓`}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 13, fontWeight: 500, marginTop: 8 }}>{x.name}</div>
              <div style={{ fontFamily: mono, fontSize: 10, color: COLORS.muted, marginTop: 2 }}>
                {v.label} · {v.tris} · {ago(x.updatedAt)}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
