import { COLORS, HUES } from '@forge/core';
import type { ClipName } from '@forge/core';
import { Panel, StatusTag, mono } from '@forge/ui';
import { useSessionCtx } from '../session.js';

const A = COLORS.accent;

const row = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '7px 0',
  fontSize: 12,
  borderTop: `1px solid ${COLORS.hairline}`,
} as const;

function Field({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={row}>
      <span style={{ color: COLORS.muted }}>{label}</span>
      <span style={{ fontFamily: mono }}>{value}</span>
    </div>
  );
}

function NumGrid({ label, values }: { label: string; values: string[] }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
      <span style={{ width: 34, fontSize: 11, color: COLORS.muted }}>{label}</span>
      {values.map((v, i) => (
        <span
          key={i}
          style={{
            flex: 1,
            padding: '4px 7px',
            borderRadius: 4,
            background: COLORS.input,
            border: `1px solid ${COLORS.inputBorder}`,
            fontFamily: mono,
            fontSize: 11,
          }}
        >
          {v}
        </span>
      ))}
    </div>
  );
}

/** Mode-specific inspector. Title is `asset › part` when a part is selected. */
export function Inspector() {
  const s = useSessionCtx();
  const a = s.active;
  const v = s.curVersion;
  if (!a || !v) return null;

  const anims = a.anims || [];
  const missing = s.clips.filter((n) => n !== 'idle' && !anims.some((c) => c.name === n));

  const bones =
    s.kind === 'creature'
      ? ([['root', 0], ['spine', 12], ['head', 24], ['ear_L', 36], ['ear_R', 36], ['leg_FL', 24], ['leg_FR', 24], ['leg_BL', 24], ['leg_BR', 24], ['tail_01', 24], ['tail_02', 36]] as [string, number][])
      : s.kind === 'character'
        ? ([['hips', 0], ['spine', 12], ['head', 24], ['arm_L', 24], ['arm_R', 24], ['leg_L', 12], ['leg_R', 12]] as [string, number][])
        : ([['root', 0], ['body', 12], ['wheel_0', 24], ['wheel_1', 24], ['wheel_2', 24], ['antenna', 12]] as [string, number][]);

  return (
    <Panel style={{ padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {s.selected ? `${a.name} › ${s.selected}` : a.name}
        </div>
        <div style={{ fontSize: 11, color: COLORS.muted }}>{s.mode}</div>
      </div>

      {s.mode === 'Model' && (
        <>
          <NumGrid label="Pos" values={['0.00', '0.00', '0.00']} />
          <NumGrid label="Rot" values={['0°', '0°', '0°']} />
          <NumGrid label="Scale" values={['1.00', '1.00', '1.00']} />
          <div style={{ marginTop: 8 }}>
            <Field label="Triangles" value={v.tris} />
            <Field label="Materials" value={v.mats} />
            <Field label="Real-world size" value={v.size} />
            <Field label="Source" value={v.note} />
          </div>
        </>
      )}

      {s.mode === 'Sculpt' && (
        <>
          <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 6 }}>Brush size</div>
          <input
            type="range"
            min={1}
            max={100}
            value={s.brush}
            onChange={(e) => s.setBrush(+e.target.value)}
            style={{ width: '100%', accentColor: A }}
          />
          <div style={{ fontSize: 11, color: COLORS.muted, margin: '10px 0 6px' }}>Strength</div>
          <div style={{ height: 4, borderRadius: 2, background: COLORS.control }}>
            <div style={{ width: '62%', height: '100%', borderRadius: 2, background: A }} />
          </div>
          <div style={{ marginTop: 10 }}>
            <Field label="Symmetry X" value="on" />
            <Field label="Remesh" value="adaptive" />
          </div>
        </>
      )}

      {s.mode === 'Paint' && (
        <>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            {[...HUES, '#e6e4df'].map((c, i) => (
              <span
                key={c}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 5,
                  background: c,
                  outline: i === 0 ? `2px solid ${A}` : 'none',
                  outlineOffset: 2,
                }}
              />
            ))}
          </div>
          <Field label="Layer" value="base_color" />
          <Field label="Texture" value="2048×2048" />
          <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 8 }}>
            Palette pulled {s.kind === 'creature' ? 'from your sprite pixels' : `from the ${s.defaults.style} style`}.
          </div>
        </>
      )}

      {s.mode === 'Rig' && (
        <>
          <div style={{ display: 'grid', gap: 3, fontFamily: mono, fontSize: 11 }}>
            {bones.map(([name, indent]) => (
              <div key={name} style={{ paddingLeft: indent, color: COLORS.text2 }}>
                {name}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10, fontSize: 11, color: COLORS.ok }}>
            ● {s.kind === 'character' ? 'Mixamo-compatible' : 'engine-ready'}
          </div>
        </>
      )}

      {s.mode === 'Animate' && (
        <>
          <div style={{ display: 'grid', gap: 5 }}>
            {s.clips
              .filter((n) => n === 'idle' || anims.some((c) => c.name === n))
              .map((n) => {
                const clip = anims.find((c) => c.name === n) ?? { name: n, status: 'approved' as const };
                const playing = s.anim === n;
                return (
                  <div
                    key={n}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 8px',
                      borderRadius: 6,
                      background: playing ? COLORS.accentTint : COLORS.surface,
                      border: `1px solid ${playing ? COLORS.accentBorder2 : COLORS.hairline}`,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        s.setAnim(n);
                        s.setReviewing(clip.status === 'review');
                      }}
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 4,
                        border: 'none',
                        background: playing ? A : COLORS.control,
                        color: playing ? COLORS.ink : COLORS.muted,
                        fontSize: 9,
                        cursor: 'pointer',
                      }}
                    >
                      {playing ? '❚❚' : '▶'}
                    </button>
                    <span style={{ flex: 1, fontSize: 12 }}>{n}</span>
                    <StatusTag status={clip.status} />
                  </div>
                );
              })}
          </div>

          {missing.length > 0 && (
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              {missing.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => s.generateClip(n as ClipName)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 20,
                    border: `1px dashed ${COLORS.inputBorder}`,
                    background: 'transparent',
                    color: COLORS.muted,
                    fontSize: 11,
                    cursor: 'pointer',
                  }}
                >
                  + {n}
                </button>
              ))}
            </div>
          )}

          <div style={{ fontSize: 11, color: COLORS.muted, margin: '12px 0 5px' }}>
            Playback speed · {s.speed.toFixed(2)}×
          </div>
          <input
            type="range"
            min={0.25}
            max={2}
            step={0.05}
            value={s.speed}
            onChange={(e) => s.setSpeed(+e.target.value)}
            style={{ width: '100%', accentColor: A }}
          />

          {s.reviewing && s.anim !== 'idle' && (
            <div
              style={{
                marginTop: 12,
                padding: 10,
                borderRadius: 8,
                background: COLORS.accentTint,
                border: `1px solid ${COLORS.accentBorder}`,
              }}
            >
              <div style={{ fontSize: 12, marginBottom: 9 }}>
                Watch the {s.anim} loop from a few angles. Does it read right?
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  onClick={() => {
                    s.setClipStatus(a, s.anim, 'approved', `${a.name}: ${s.anim} approved on desktop`);
                    s.setReviewing(false);
                    s.setLastReply(`${s.anim} approved — it will ship with the export.`);
                    s.say(`${s.anim} approved`);
                  }}
                  style={{
                    flex: 1,
                    padding: '7px 0',
                    borderRadius: 6,
                    border: 'none',
                    background: COLORS.ok,
                    color: COLORS.onOk,
                    fontWeight: 600,
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  Looks good
                </button>
                <button
                  type="button"
                  onClick={() => {
                    s.setClipStatus(a, s.anim, 'rework', `${a.name}: ${s.anim} marked for rework`);
                    s.setPrompt('');
                    s.setLastReply(
                      `Marked ${s.anim} for rework. Tell me what's off in the bar below — e.g. "slower, heavier steps" or "the tail should swing more".`,
                    );
                  }}
                  style={{
                    flex: 1,
                    padding: '7px 0',
                    borderRadius: 6,
                    border: `1px solid ${COLORS.inputBorder}`,
                    background: 'transparent',
                    color: COLORS.text2,
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  Needs work
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {s.mode === 'LOD' && (
        <>
          {[['LOD0', v.tris], ['LOD1', '3,240'], ['LOD2', '1,610'], ['LOD3', '780']].map(
            ([name, tris]) => (
              <Field key={name} label={name} value={`${tris} tris`} />
            ),
          )}
          <button
            type="button"
            style={{
              width: '100%',
              marginTop: 10,
              padding: '7px 0',
              borderRadius: 6,
              border: `1px dashed ${COLORS.inputBorder}`,
              background: 'transparent',
              color: COLORS.muted,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            + Add level
          </button>
        </>
      )}
    </Panel>
  );
}
