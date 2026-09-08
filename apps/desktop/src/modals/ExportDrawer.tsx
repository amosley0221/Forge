import { COLORS, ENGINES, reviewCount } from '@forge/core';
import { Chip, SectionLabel, mono } from '@forge/ui';
import { useSessionCtx } from '../session.js';

const A = COLORS.accent;

/** Right drawer: engine preset, the resulting settings, and the pre-flight checks. */
export function ExportDrawer() {
  const s = useSessionCtx();
  const a = s.active;
  const v = s.curVersion;
  if (!a || !v) return null;

  const approved = (a.anims || []).filter((c) => c.status === 'approved').map((c) => c.name);
  const unreviewed = reviewCount(a);
  const tooManyMats = v.mats > 2;

  return (
    <>
      <div
        onClick={() => s.setExportOpen(false)}
        style={{ position: 'absolute', inset: 0, background: 'rgba(13,14,17,.5)', zIndex: 60 }}
      />
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: 360,
          maxWidth: '100%',
          background: COLORS.panel,
          borderLeft: `1px solid ${COLORS.panelBorder}`,
          padding: 16,
          overflowY: 'auto',
          zIndex: 61,
          animation: 'rise 300ms ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>Export {a.name}</div>
          <button
            type="button"
            onClick={() => s.setExportOpen(false)}
            style={{ background: 'none', border: 'none', color: COLORS.muted, cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        {s.defaults.guide && (
          <div
            style={{
              padding: 10,
              borderRadius: 8,
              background: COLORS.accentTint,
              border: `1px solid ${COLORS.accentBorder}`,
              fontSize: 11,
              lineHeight: 1.55,
              color: COLORS.text2,
              marginBottom: 14,
            }}
          >
            Pick the engine you are building in — Forge sets the format, axis and units so the model
            drops in at the right scale, facing the right way.
          </div>
        )}

        <SectionLabel style={{ marginBottom: 8 }}>Engine preset</SectionLabel>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
          {ENGINES.map((e, i) => (
            <Chip
              key={e.name}
              label={e.name}
              on={i === s.defaults.engineIdx}
              onClick={() => s.setDefaults({ ...s.defaults, engineIdx: i })}
            />
          ))}
        </div>

        <div style={{ marginBottom: 14 }}>
          {[
            ['Format', s.engine.format],
            ['Axis · units', s.engine.axis],
            ['Textures', s.defaults.textureSize],
            ['Animations', approved.join(' · ') || 'none'],
            ['LODs', 'LOD0–LOD3'],
            ['Collision', 'convex hull'],
          ].map(([k, val]) => (
            <div
              key={k}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                padding: '8px 0',
                fontSize: 12,
                borderTop: `1px solid ${COLORS.hairline}`,
              }}
            >
              <span style={{ color: COLORS.muted }}>{k}</span>
              <span style={{ fontFamily: mono, textAlign: 'right' }}>{val}</span>
            </div>
          ))}
        </div>

        <SectionLabel style={{ marginBottom: 8 }}>Checks</SectionLabel>
        <div style={{ display: 'grid', gap: 7, marginBottom: 18 }}>
          {[
            'Watertight mesh',
            'No overlapping UVs',
            'Scale matches real-world size',
            `Rig: ${s.kind === 'creature' ? '18' : '14'} bones, within engine limits`,
          ].map((c) => (
            <div key={c} style={{ display: 'flex', gap: 8, fontSize: 11, color: COLORS.text2 }}>
              <span style={{ color: COLORS.ok }}>✓</span>
              {c}
            </div>
          ))}

          {unreviewed > 0 && (
            <div style={{ display: 'flex', gap: 8, fontSize: 11, color: A }}>
              <span>!</span>
              <span style={{ flex: 1 }}>
                {unreviewed} clip{unreviewed > 1 ? 's' : ''} not yet approved — export without?{' '}
                <button
                  type="button"
                  onClick={() => {
                    s.setExportOpen(false);
                    s.setMode('Animate');
                    s.setTool(0);
                    const next = (a.anims || []).find((c) => c.status === 'review');
                    s.setAnim(next?.name ?? 'idle');
                    s.setReviewing(true);
                  }}
                  style={linkBtn}
                >
                  Review now
                </button>
              </span>
            </div>
          )}

          {tooManyMats && (
            <div style={{ display: 'flex', gap: 8, fontSize: 11, color: A }}>
              <span>!</span>
              <span style={{ flex: 1 }}>
                {v.mats} materials — merge?{' '}
                <button
                  type="button"
                  onClick={() => {
                    s.setExportOpen(false);
                    s.runJob('Merge materials into 2 atlases', () => {
                      s.addVersion(a, { mats: 2, note: 'materials merged' });
                      s.setLastReply(
                        'Merged into 2 material atlases. Textures re-packed at 2K; no visible change.',
                      );
                    });
                  }}
                  style={linkBtn}
                >
                  Fix with AI
                </button>
              </span>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            s.setExportOpen(false);
            s.say(`Exported ${a.name}_${v.label}.zip for ${s.engine.name}`);
          }}
          style={{
            width: '100%',
            padding: '10px 0',
            borderRadius: 6,
            border: 'none',
            background: A,
            color: COLORS.ink,
            fontWeight: 600,
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          {s.engine.name === 'Raw' ? 'Export files…' : `Export to ${s.engine.name} project…`}
        </button>
        <button
          type="button"
          onClick={() => {
            s.setExportOpen(false);
            s.say(`Downloading ${a.name}_${v.label}.zip`);
          }}
          style={{
            width: '100%',
            marginTop: 8,
            padding: '9px 0',
            borderRadius: 6,
            border: `1px solid ${COLORS.inputBorder}`,
            background: 'transparent',
            color: COLORS.text2,
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          Download .zip · 18.4 MB
        </button>
      </div>
    </>
  );
}

const linkBtn = {
  background: 'none',
  border: 'none',
  color: A,
  textDecoration: 'underline',
  fontSize: 11,
  cursor: 'pointer',
  padding: 0,
} as const;
