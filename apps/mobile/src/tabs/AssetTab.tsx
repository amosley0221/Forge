import { COLORS } from '@forge/core';
import { ForgeViewer, mono } from '@forge/ui';
import type { MobileSession } from '../session.js';

const A = COLORS.accent;

export function AssetTab({ s }: { s: MobileSession }) {
  const a = s.active;
  const v = s.cur;
  if (!a || !v) return null;

  const anims = a.anims || [];
  const missing = s.clips.filter((n) => n !== 'idle' && !anims.some((c) => c.name === n));
  const suggestions = [
    ...missing.slice(0, 2).map((n) => `Show me it ${n === 'drive' ? 'driving' : n + 'ing'}`),
    ...(s.kind === 'creature'
      ? ['Bigger eyes', 'Add a flame tip to the tail']
      : s.kind === 'vehicle'
        ? ['Bigger front wheels', 'Add rust']
        : ['Make it rusty', 'Chunkier silhouette']),
  ].slice(0, 4);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px' }}>
        <button
          type="button"
          onClick={() => s.setTab('Library')}
          style={{ background: 'none', border: 'none', color: COLORS.muted, fontSize: 16, cursor: 'pointer', padding: 0 }}
        >
          ‹
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{a.name}</div>
          <div style={{ fontFamily: mono, fontSize: 10, color: COLORS.muted }}>
            {v.label} · {v.tris} tris · {v.note}
          </div>
        </div>
        <button
          type="button"
          onClick={() => s.goTab('Export')}
          style={{
            padding: '7px 13px',
            borderRadius: 6,
            border: 'none',
            background: COLORS.light,
            color: COLORS.lightInk,
            fontWeight: 600,
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
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
            kind={s.kind}
            version={a.cur + 1}
            variant={a.variant ?? 0}
            selected={s.selected}
            anim={s.anim}
            autorotate={s.anim === 'idle'}
            compact
            onPick={(part) => s.setSelected(part)}
          />
          <div style={{ position: 'absolute', top: 8, left: 8, display: 'flex', gap: 5 }}>
            {s.clips
              .filter((n) => n === 'idle' || anims.some((c) => c.name === n))
              .map((n) => {
                const on = s.anim === n;
                const clip = anims.find((c) => c.name === n) ?? { status: 'approved' as const };
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => {
                      s.setAnim(n);
                      s.setReviewing(clip.status === 'review');
                    }}
                    style={{
                      padding: '4px 11px',
                      borderRadius: 20,
                      fontSize: 11,
                      textTransform: 'capitalize',
                      border: `1px solid ${on ? A : clip.status === 'review' ? COLORS.accentBorder2 : COLORS.inputBorder}`,
                      background: on ? A : 'rgba(27,28,32,.9)',
                      color: on ? COLORS.ink : clip.status === 'review' ? A : COLORS.muted,
                      cursor: 'pointer',
                    }}
                  >
                    {n}
                  </button>
                );
              })}
          </div>
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
            {s.selected ? `${s.selected} selected` : 'tap a part · drag to orbit'}
          </div>
        </div>

        {s.reviewing && s.anim !== 'idle' && (
          <div
            style={{
              marginTop: 10,
              padding: 12,
              borderRadius: 14,
              background: COLORS.accentTint,
              border: `1px solid ${COLORS.accentBorder}`,
            }}
          >
            <div style={{ fontSize: 12, marginBottom: 10 }}>
              Watch the {s.anim} loop. Does it read right?
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => {
                  s.setClipStatus(a, s.anim, 'approved', `${a.name}: ${s.anim} approved on Android`);
                  s.setReviewing(false);
                  s.setLastReply(`${s.anim} approved. Desktop has it.`);
                }}
                style={{
                  flex: 1,
                  padding: '11px 0',
                  borderRadius: 8,
                  border: 'none',
                  background: COLORS.ok,
                  color: COLORS.onOk,
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Looks good
              </button>
              <button
                type="button"
                onClick={() => {
                  s.setClipStatus(a, s.anim, 'rework', `${a.name}: ${s.anim} marked for rework on Android`);
                  s.setLastReply(`Marked ${s.anim} for rework — type what's off below.`);
                }}
                style={{
                  flex: 1,
                  padding: '11px 0',
                  borderRadius: 8,
                  border: `1px solid ${COLORS.inputBorder}`,
                  background: 'transparent',
                  color: COLORS.text2,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Needs work
              </button>
            </div>
          </div>
        )}

        {s.lastReply && !s.generating && (
          <div
            style={{
              marginTop: 10,
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

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
          {suggestions.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => s.setPrompt(t)}
              style={{
                padding: '8px 13px',
                borderRadius: 20,
                border: `1px solid ${COLORS.inputBorder}`,
                background: 'transparent',
                color: COLORS.text2,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              {t}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 7, margin: '16px 0 20px' }}>
          <span
            style={{
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: '.08em',
              color: COLORS.muted,
            }}
          >
            HISTORY
          </span>
          {a.versions.map((ver, i) => {
            const on = i === a.cur;
            return (
              <button
                key={ver.label}
                type="button"
                onClick={() => s.selectVersion(a, i)}
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
      </div>

      {/* Input row */}
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
        <button
          type="button"
          onClick={() => s.goTab('Capture')}
          style={{
            width: 44,
            height: 44,
            borderRadius: 8,
            border: `1px solid ${COLORS.inputBorder}`,
            background: 'transparent',
            color: COLORS.muted,
            fontFamily: mono,
            fontSize: 10,
            cursor: 'pointer',
          }}
        >
          CAM
        </button>
        <input
          value={s.prompt}
          onChange={(e) => s.setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') s.submitPrompt();
          }}
          placeholder={
            s.reviewing ? `What's off about the ${s.anim}?` : 'Describe a change or "show me it walking"'
          }
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
          onClick={s.submitPrompt}
          style={{
            width: 44,
            height: 44,
            borderRadius: 8,
            border: 'none',
            background: s.prompt.trim() ? A : '#8a5a22',
            color: COLORS.ink,
            fontSize: 16,
            cursor: 'pointer',
          }}
        >
          →
        </button>
      </div>
    </div>
  );
}
