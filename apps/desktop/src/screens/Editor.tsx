import { COLORS, GUIDE, TOOLS } from '@forge/core';
import { ForgeViewer, Panel, SectionLabel, mono } from '@forge/ui';
import { useSessionCtx } from '../session.js';
import { Inspector } from '../panels/Inspector.js';

const A = COLORS.accent;

function HudPill({
  label,
  on,
  onClick,
}: {
  label: string;
  on?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '4px 10px',
        borderRadius: 6,
        border: `1px solid ${on ? COLORS.accentBorder2 : COLORS.hairline}`,
        background: 'rgba(27,28,32,.85)',
        backdropFilter: 'blur(8px)',
        color: on ? A : COLORS.muted,
        fontFamily: mono,
        fontSize: 10,
        cursor: onClick ? 'pointer' : 'default',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  );
}

export function Editor() {
  const s = useSessionCtx();
  const a = s.active;
  const v = s.curVersion;
  if (!a || !v) return null;

  const [guideTitle, guideBody, suggestions] = GUIDE[s.mode];
  const approved = (a.anims || []).filter((c) => c.status === 'approved').map((c) => c.name);
  const modeStatus =
    s.mode === 'Rig'
      ? s.kind === 'creature'
        ? '18 bones'
        : '14 bones'
      : s.mode === 'LOD'
        ? '4 LODs'
        : s.mode === 'Animate'
          ? `clip: ${s.anim}`
          : s.mode === 'Paint'
            ? '2K · base_color'
            : s.wire
              ? 'Shaded + wire'
              : 'Shaded';

  return (
    <>
      <ForgeViewer
        kind={s.kind}
        version={a.cur + 1}
        variant={a.variant ?? 0}
        wire={s.wire}
        selected={s.selected}
        autorotate={s.turntable && s.anim === 'idle'}
        anim={s.anim}
        speed={s.speed}
        onPick={(part) => s.setSelected(part)}
        style={{ position: 'absolute', inset: 0 }}
      />

      {/* Viewport HUD */}
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
        <HudPill
          label={s.wire ? 'Shaded + wire' : 'Shaded'}
          on={s.wire}
          onClick={() => s.setWire(!s.wire)}
        />
        <HudPill label="Turntable" on={s.turntable} onClick={() => s.setTurntable(!s.turntable)} />
        <HudPill
          label={
            s.selected
              ? `${s.selected} selected · prompts apply to it`
              : 'click a part to select · drag to orbit · wheel to zoom'
          }
        />
      </div>

      {/* Left tool rail */}
      <div
        style={{
          position: 'absolute',
          left: 16,
          top: 70,
          display: 'grid',
          gap: 4,
          zIndex: 20,
        }}
      >
        {TOOLS[s.mode].map(([abbr, name], i) => {
          const on = i === s.tool;
          return (
            <div key={abbr} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                type="button"
                onClick={() => s.setTool(i)}
                title={name}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 6,
                  border: `1px solid ${on ? A : COLORS.hairline}`,
                  background: on ? A : COLORS.control,
                  color: on ? COLORS.ink : COLORS.muted,
                  fontFamily: mono,
                  fontSize: 10,
                  fontWeight: on ? 600 : 400,
                  cursor: 'pointer',
                }}
              >
                {abbr}
              </button>
              {on && (
                <span
                  style={{
                    padding: '4px 9px',
                    borderRadius: 6,
                    background: 'rgba(27,28,32,.9)',
                    border: `1px solid ${COLORS.hairline}`,
                    fontSize: 11,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {name}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Right column: inspector + guide */}
      <div
        style={{
          position: 'absolute',
          right: 16,
          top: 70,
          bottom: 130,
          width: 260,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          overflowY: 'auto',
          zIndex: 20,
        }}
      >
        <Inspector />

        {s.defaults.guide && (
          <Panel
            style={{
              padding: 12,
              background: COLORS.accentTint,
              border: `1px solid ${COLORS.accentBorder}`,
              flexShrink: 0,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                fontWeight: 600,
                color: A,
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: 3, background: A }} />
              {guideTitle}
            </div>
            <p style={{ margin: '8px 0 10px', fontSize: 11, lineHeight: 1.55, color: COLORS.text2 }}>
              {guideBody}
            </p>
            <SectionLabel style={{ marginBottom: 6 }}>Suggestions</SectionLabel>
            <div style={{ display: 'grid', gap: 5 }}>
              {suggestions.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => s.setPrompt(t)}
                  style={{
                    padding: '5px 9px',
                    borderRadius: 20,
                    border: `1px solid ${COLORS.accentBorder}`,
                    background: 'transparent',
                    color: COLORS.text2,
                    fontSize: 11,
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </Panel>
        )}
      </div>

      {/* History strip */}
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
                title={ver.prompt}
                style={{
                  position: 'relative',
                  width: 64,
                  height: 48,
                  borderRadius: 6,
                  border: on ? `1.5px solid ${A}` : `1px solid ${COLORS.panelBorder}`,
                  background: on
                    ? 'repeating-linear-gradient(135deg, rgba(245,158,59,.12), rgba(245,158,59,.12) 6px, transparent 6px, transparent 12px)'
                    : 'repeating-linear-gradient(135deg, rgba(255,255,255,.05), rgba(255,255,255,.05) 6px, transparent 6px, transparent 12px)',
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

      {/* Status line */}
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
        {v.tris} tris · {v.mats} mats · 2K · {modeStatus} ·{' '}
        <span style={{ color: COLORS.ok }}>● {s.engine.name} ready</span>
        {approved.length > 0 && <> · clips: {approved.join(' · ')}</>}
      </div>

      {/* AI reply bar + prompt bar */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          bottom: 16,
          transform: 'translateX(-50%)',
          width: 'min(640px, calc(100% - 580px))',
          minWidth: 380,
          display: 'grid',
          gap: 8,
          zIndex: 30,
        }}
      >
        {s.lastReply && !s.generating && (
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
          </div>
        )}

        <Panel
          glass
          style={{
            padding: 10,
            borderRadius: 12,
            boxShadow: '0 20px 50px rgba(0,0,0,.5)',
          }}
        >
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
                  s.submitPrompt();
                }
              }}
              placeholder={
                s.mode === 'Animate'
                  ? s.reviewing
                    ? `What's off about the ${s.anim}? e.g. "slower, heavier steps"`
                    : 'Try "show me it walking" or "show me it running"'
                  : s.selected
                    ? `Describe a change to ${s.selected}…`
                    : 'Describe a change, or ask "show me it walking"'
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => s.setSelected(null)}
              style={{
                padding: '4px 9px',
                borderRadius: 4,
                border: `1px solid ${s.selected ? COLORS.accentBorder : COLORS.inputBorder}`,
                background: s.selected ? COLORS.accentTint2 : 'transparent',
                color: s.selected ? A : COLORS.muted,
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              {s.selected ? '@' + s.selected : '@whole model'}
            </button>
            <button type="button" onClick={() => s.setModal('photo')} style={chipBtn}>
              + photo
            </button>
            <span style={chipBtn}>style: {s.defaults.style}</span>
            <span style={chipBtn}>budget ≤ {s.defaults.triBudget.toLocaleString()}</span>
            <div style={{ flex: 1 }} />
            <span style={{ fontFamily: mono, fontSize: 10, color: COLORS.muted }}>⌘⏎</span>
            <button
              type="button"
              onClick={s.submitPrompt}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                border: 'none',
                background: s.prompt.trim() ? A : '#8a5a22',
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
    </>
  );
}

const chipBtn = {
  padding: '4px 9px',
  borderRadius: 4,
  border: `1px solid ${COLORS.inputBorder}`,
  background: 'transparent',
  color: COLORS.muted,
  fontSize: 11,
  cursor: 'pointer',
} as const;
