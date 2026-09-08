import { CATEGORIES, COLORS, STARTERS, ago, approvedCount, reviewCount } from '@forge/core';
import { Chip, Panel, SectionLabel, mono } from '@forge/ui';
import { useSessionCtx } from '../session.js';

const A = COLORS.accent;

/** Decorative perspective floor grid behind the start column. */
function FloorGrid() {
  return (
    <div style={{ position: 'absolute', inset: 0, perspective: 800, overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          left: '-40%',
          right: '-40%',
          top: '56%',
          height: '120%',
          transform: 'rotateX(74deg)',
          transformOrigin: 'top',
          backgroundImage:
            'linear-gradient(rgba(255,255,255,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.06) 1px,transparent 1px)',
          backgroundSize: '56px 56px',
          maskImage: 'linear-gradient(to bottom,rgba(0,0,0,.9),transparent 75%)',
          WebkitMaskImage: 'linear-gradient(to bottom,rgba(0,0,0,.9),transparent 75%)',
        }}
      />
    </div>
  );
}

export function Start() {
  const s = useSessionCtx();
  const canGenerate = s.prompt.trim().length > 0;

  const filtered = s.assets.filter((x) =>
    s.filter === 'All'
      ? true
      : s.filter === 'Creatures'
        ? x.kind === 'creature'
        : (x.anims || []).some((c) => c.status === 'review'),
  );

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'auto' }}>
      <FloorGrid />
      <div
        style={{
          position: 'relative',
          width: 'min(720px, 100%)',
          margin: '0 auto',
          padding: '76px 20px 60px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>What do you want to make?</h1>
          <p style={{ margin: '6px 0 0', fontSize: 12, color: COLORS.muted }}>
            Describe it, drop a photo or a folder of sprite sheets — Forge builds a rigged,
            animated, game-ready asset.
          </p>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {CATEGORIES.map((c) => (
            <Chip key={c} label={c} on={c === s.category} onClick={() => s.setCategory(c)} />
          ))}
        </div>

        <Panel style={{ padding: 12, borderRadius: 12, boxShadow: '0 20px 50px rgba(0,0,0,.5)' }}>
          <textarea
            rows={3}
            value={s.prompt}
            onChange={(e) => s.setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                s.submitPrompt();
              }
            }}
            placeholder={`Describe a ${s.category.toLowerCase()}… e.g. "${STARTERS[0]}"`}
            style={{
              width: '100%',
              resize: 'none',
              border: 'none',
              background: 'transparent',
              color: COLORS.text,
              fontSize: 14,
              lineHeight: 1.5,
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
            <button
              type="button"
              onClick={() => s.setModal('sprites')}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: `1px solid ${COLORS.accentBorder2}`,
                background: COLORS.accentTint,
                color: A,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              Sprite sheets → 3D
            </button>
            <button
              type="button"
              onClick={() => s.setModal('photo')}
              style={secondaryBtn}
            >
              Photo
            </button>
            <button type="button" onClick={() => s.setModal('camera')} style={secondaryBtn}>
              Phone camera
            </button>
            <div style={{ flex: 1 }} />
            <span style={{ fontFamily: mono, fontSize: 10, color: COLORS.muted }}>
              {s.engine.name} · {s.defaults.style}
            </span>
            <button
              type="button"
              onClick={s.submitPrompt}
              style={{
                padding: '7px 16px',
                borderRadius: 6,
                border: 'none',
                background: canGenerate ? A : '#8a5a22',
                color: COLORS.ink,
                fontWeight: 600,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              Generate
            </button>
          </div>
        </Panel>

        {s.defaults.guide && (
          <Panel
            style={{
              padding: 12,
              background: COLORS.accentTint,
              border: `1px solid ${COLORS.accentBorder}`,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, color: A, marginBottom: 8 }}>
              Not sure how to describe it?
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {STARTERS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => s.setPrompt(t)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 6,
                    border: `1px solid ${COLORS.accentBorder}`,
                    background: 'transparent',
                    color: COLORS.text2,
                    fontSize: 11,
                    textAlign: 'left',
                    cursor: 'pointer',
                    maxWidth: '100%',
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </Panel>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
          <SectionLabel>
            Your assets&nbsp;&nbsp;{s.assets.length} · synced with Android
          </SectionLabel>
          <div style={{ flex: 1 }} />
          {['All', 'Creatures', 'Needs review'].map((f) => {
            const on = f === s.filter;
            return (
              <button
                key={f}
                type="button"
                onClick={() => s.setFilter(f)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 20,
                  border: `1px solid ${on ? A : COLORS.inputBorder}`,
                  background: 'transparent',
                  color: on ? A : COLORS.muted,
                  fontSize: 11,
                  cursor: 'pointer',
                }}
              >
                {f}
              </button>
            );
          })}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
            gap: 10,
          }}
        >
          {filtered.map((x) => {
            const v = x.versions[x.cur];
            const rv = reviewCount(x);
            const ap = approvedCount(x);
            const isAndroid = x.device === 'android';
            return (
              <button
                key={x.id}
                type="button"
                onClick={() => s.openAsset(x.id)}
                style={{
                  textAlign: 'left',
                  padding: 8,
                  borderRadius: 8,
                  border: `1px solid ${COLORS.hairline}`,
                  background: COLORS.panel,
                  cursor: 'pointer',
                  color: COLORS.text,
                }}
              >
                <div
                  style={{
                    position: 'relative',
                    height: 70,
                    borderRadius: 6,
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
                        left: 5,
                        bottom: 5,
                        fontSize: 9,
                        color: rv ? A : COLORS.ok,
                      }}
                    >
                      {rv ? `${rv} clip${rv > 1 ? 's' : ''} to review` : `${ap} clip${ap > 1 ? 's' : ''} ✓`}
                    </span>
                  )}
                </div>
                <div style={{ fontWeight: 500, fontSize: 12, marginTop: 7 }}>{x.name}</div>
                <div style={{ fontFamily: mono, fontSize: 10, color: COLORS.muted, marginTop: 2 }}>
                  {v.label} · {v.tris} · {ago(x.updatedAt)}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const secondaryBtn = {
  padding: '6px 12px',
  borderRadius: 6,
  border: `1px solid ${COLORS.inputBorder}`,
  background: 'transparent',
  color: COLORS.text2,
  fontSize: 12,
  cursor: 'pointer',
} as const;
