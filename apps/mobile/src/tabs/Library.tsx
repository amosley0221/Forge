import { useRef, useState } from 'react';
import { CATEGORIES, COLORS, ago, approvedCount, formatTris, reviewCount } from '@forge/core';
import type { Category } from '@forge/core';
import { EmptyState, ErrorPanel, PendingTasks, mono } from '@forge/ui';
import type { MobileSession } from '../session.js';
import { UpdateBanner } from '../components/UpdateBanner.js';

const A = COLORS.accent;

export function Library({ s }: { s: MobileSession }) {
  // The newest change across the whole project — what you want when checking
  // whether the other device has something this one does not.
  const lastChanged = s.assets.length ? Math.max(...s.assets.map((a) => a.updatedAt)) : null;
  const [composing, setComposing] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [category, setCategory] = useState<Category>('Prop');
  const fileInput = useRef<HTMLInputElement | null>(null);

  const pending = s.assets.reduce((n, x) => n + reviewCount(x), 0);
  const shown = s.filter === 'All' ? s.assets : s.assets.filter((x) => reviewCount(x) > 0);

  const create = async () => {
    const text = prompt.trim();
    if (!text) return;
    setComposing(false);
    setPrompt('');
    const asset = await s.generate({ prompt: text, category });
    if (asset) s.open(asset.id);
  };

  return (
    <div style={{ padding: '14px 14px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 600 }}>
            {s.settings.projectName || 'Your project'}
          </div>
          <div style={{ fontSize: 11, color: COLORS.muted }}>
            {s.assets.length === 0
              ? 'No assets yet'
              : `${s.assets.length} asset${s.assets.length > 1 ? 's' : ''}` +
                (lastChanged ? ` · last changed ${ago(lastChanged)}` : '')}
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          onClick={() => s.setSettingsOpen(true)}
          aria-label="Settings"
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            border: `1px solid ${COLORS.inputBorder}`,
            background: COLORS.raised,
            color: COLORS.text2,
            fontSize: 15,
            cursor: 'pointer',
          }}
        >
          ⚙
        </button>
      </div>

      <UpdateBanner say={s.say} busyWithJob={s.job.running} />

      {s.job.error && (
        <div style={{ marginBottom: 12 }}>
          <ErrorPanel message={s.job.error} onDismiss={s.dismissError} />
        </div>
      )}

      {s.pendingTasks.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <PendingTasks
            tasks={s.pendingTasks}
            onRecover={(id) => {
              const task = s.pendingTasks.find((t) => t.taskId === id);
              if (task) void s.recoverTask(task).then((a) => a && s.open(a.id));
            }}
            onForget={s.forgetTask}
          />
        </div>
      )}

      {!s.canGenerate && (
        <button
          type="button"
          onClick={() => s.setSettingsOpen(true)}
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
          <div style={{ fontSize: 13, fontWeight: 600, color: A }}>Connect a 3D provider</div>
          <div style={{ fontSize: 11, color: COLORS.text2, marginTop: 3, lineHeight: 1.5 }}>
            Add a Meshy or Tripo key to generate models. Importing and viewing work without one.
          </div>
        </button>
      )}

      {pending > 0 && (
        <button
          type="button"
          onClick={() => {
            const next = s.assets.find((x) => reviewCount(x) > 0);
            if (!next) return;
            s.open(next.id);
            const clip = next.clips.find((c) => c.status === 'review');
            if (clip) {
              s.setClip(clip.name);
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
            {pending} clip{pending > 1 ? 's' : ''} to review
          </div>
          <div style={{ fontSize: 11, color: COLORS.text2, marginTop: 3 }}>
            Watch them and mark each one approved or needing work →
          </div>
        </button>
      )}

      {s.assets.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          {(['All', 'Needs review'] as const).map((f) => {
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
      )}

      {s.assets.length === 0 ? (
        <EmptyState
          title="Nothing here yet"
          body={
            s.canGenerate
              ? 'Describe something to make it, photograph an object with the Capture tab, or import a .glb you already have.'
              : 'Import a .glb you already have to look at it and export it, or connect a provider above to generate from a description.'
          }
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {shown.map((x) => {
            const v = x.versions[x.cur];
            const rv = reviewCount(x);
            const ap = approvedCount(x);
            const fromAndroid = x.device === 'android';
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
                    background: COLORS.surface,
                    border: `1px solid ${COLORS.hairline}`,
                    display: 'grid',
                    placeItems: 'center',
                    fontFamily: mono,
                    fontSize: 9,
                    color: COLORS.disabled,
                  }}
                >
                  {v.stats.triangles ? 'GLB' : 'no mesh'}
                  <span
                    style={{
                      position: 'absolute',
                      top: 5,
                      right: 5,
                      padding: '1px 6px',
                      borderRadius: 4,
                      fontFamily: mono,
                      fontSize: 9,
                      background: fromAndroid ? COLORS.okTint : COLORS.hairline,
                      color: fromAndroid ? COLORS.ok : COLORS.muted,
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
                  {v.label} · {formatTris(v.stats.triangles)} tris · {ago(x.updatedAt)}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Create actions */}
      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button
          type="button"
          onClick={() => {
            if (!s.canGenerate) {
              s.setSettingsOpen(true);
              return;
            }
            setComposing(true);
          }}
          style={{
            flex: 2,
            padding: '13px 0',
            borderRadius: 10,
            border: 'none',
            background: s.canGenerate ? A : COLORS.control,
            color: s.canGenerate ? COLORS.ink : COLORS.muted,
            fontWeight: 600,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Describe an asset
        </button>
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          style={{
            flex: 1,
            padding: '13px 0',
            borderRadius: 10,
            border: `1px solid ${COLORS.inputBorder}`,
            background: 'transparent',
            color: COLORS.text2,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Import .glb
        </button>
      </div>

      <input
        ref={fileInput}
        type="file"
        accept=".glb,.gltf,model/gltf-binary,model/gltf+json"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          const asset = await s.importModel(file);
          if (asset) s.open(asset.id);
        }}
      />

      {composing && (
        <div
          onClick={() => setComposing(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(13,14,17,.7)',
            display: 'flex',
            alignItems: 'flex-end',
            zIndex: 70,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              padding: '16px 14px calc(16px + env(safe-area-inset-bottom))',
              borderRadius: '16px 16px 0 0',
              background: COLORS.panel,
              border: `1px solid ${COLORS.panelBorder}`,
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 10 }}>What are you making?</div>
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 10 }}>
              {CATEGORIES.map((c) => {
                const on = c === category;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategory(c)}
                    style={{
                      padding: '7px 12px',
                      borderRadius: 20,
                      whiteSpace: 'nowrap',
                      border: `1px solid ${on ? A : COLORS.inputBorder}`,
                      background: on ? A : 'transparent',
                      color: on ? COLORS.ink : COLORS.muted,
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              autoFocus
              placeholder="e.g. rusty six-wheeled desert rover, low-poly, hand-painted"
              style={{
                width: '100%',
                resize: 'none',
                padding: 12,
                borderRadius: 10,
                background: COLORS.input,
                border: `1px solid ${COLORS.inputBorder}`,
                color: COLORS.text,
                fontSize: 14,
                lineHeight: 1.5,
              }}
            />
            <button
              type="button"
              onClick={() => void create()}
              disabled={!prompt.trim()}
              style={{
                width: '100%',
                marginTop: 10,
                padding: '13px 0',
                borderRadius: 10,
                border: 'none',
                background: prompt.trim() ? A : '#8a5a22',
                color: COLORS.ink,
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              Generate
            </button>
            <div style={{ fontSize: 10, color: COLORS.muted, textAlign: 'center', marginTop: 8 }}>
              Uses credits on your {s.credentials.provider ?? 'provider'} account
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
