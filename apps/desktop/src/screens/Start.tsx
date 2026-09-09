import { useRef, useState } from 'react';
import {
  CATEGORIES,
  COLORS,
  STARTERS,
  ago,
  approvedCount,
  exactTime,
  prepareImage,
  formatTris,
  reviewCount,
} from '@forge/core';
import {
  ActivityLog,
  Chip,
  EmptyState,
  ErrorPanel,
  Panel,
  PendingTasks,
  SectionLabel,
  mono,
} from '@forge/ui';
import type { Session } from '../session.js';
import { UpdateBanner } from '../components/UpdateBanner.js';

const A = COLORS.accent;

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

export function Start({ s }: { s: Session }) {
  const lastChanged = s.assets.length
    ? Math.max(...s.assets.map((a) => a.updatedAt))
    : null;
  const fileInput = useRef<HTMLInputElement | null>(null);
  const imageInput = useRef<HTMLInputElement | null>(null);
  // Up to four views of one subject. More than that stops helping and only
  // makes the request bigger.
  const [images, setImages] = useState<{ dataUrl: string; width: number; height: number }[]>([]);
  const canGenerate = (s.prompt.trim().length > 0 || images.length > 0) && s.canGenerate;

  const addImages = async (files: FileList | null) => {
    if (!files?.length) return;
    try {
      const prepared = await Promise.all([...files].map((f) => prepareImage(f)));
      setImages((prev) => [...prev, ...prepared].slice(0, 4));
    } catch (e) {
      s.say(e instanceof Error ? e.message : 'That image could not be read');
    }
  };

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
            Describe it, or drop in a photo or reference image and Forge builds the model from
            that. You can also import a <code>.glb</code> you already have.
          </p>
        </div>

        <UpdateBanner say={s.say} busyWithJob={s.job.running} />

        {s.job.error && (
          <ErrorPanel
            message={s.job.error}
            onDismiss={s.dismissError}
            hint={
              s.pendingTasks.length
                ? 'The job below was already paid for — finish it rather than generating again.'
                : undefined
            }
          />
        )}

        <PendingTasks
          tasks={s.pendingTasks}
          onRecover={(id) => {
            const task = s.pendingTasks.find((t) => t.taskId === id);
            if (task) void s.recoverTask(task).then((a) => a && s.openAsset(a.id));
          }}
          onForget={s.forgetTask}
        />

        {!s.canGenerate && (
          <Panel
            style={{
              padding: 12,
              background: COLORS.accentTint,
              border: `1px solid ${COLORS.accentBorder}`,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, color: A }}>No 3D provider connected</div>
            <p style={{ fontSize: 11, color: COLORS.text2, lineHeight: 1.6, margin: '6px 0 10px' }}>
              Forge generates models through your own Meshy or Tripo account. Add a key to start
              generating — importing and viewing work without one.
            </p>
            <button
              type="button"
              onClick={() => s.setSettingsOpen(true)}
              style={{
                padding: '7px 14px',
                borderRadius: 6,
                border: 'none',
                background: A,
                color: COLORS.ink,
                fontWeight: 600,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              Connect a provider
            </button>
          </Panel>
        )}

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
                void s.submitPrompt();
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
          {/* A chosen image replaces the description as the subject; the prompt
              box stays live as an optional note the provider also reads. */}
          {images.length > 0 && (
            <div
              style={{
                margin: '4px 0 2px',
                padding: 8,
                borderRadius: 8,
                background: COLORS.surface,
                border: `1px solid ${COLORS.accentBorder}`,
              }}
            >
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {images.map((img, i) => (
                  <div key={img.dataUrl.slice(-24) + i} style={{ position: 'relative' }}>
                    <img
                      src={img.dataUrl}
                      alt=""
                      style={{ width: 52, height: 52, borderRadius: 6, objectFit: 'cover' }}
                    />
                    <button
                      type="button"
                      onClick={() => setImages((prev) => prev.filter((_, n) => n !== i))}
                      aria-label="Remove"
                      style={{
                        position: 'absolute',
                        top: -6,
                        right: -6,
                        width: 18,
                        height: 18,
                        borderRadius: 9,
                        border: 'none',
                        background: COLORS.raised,
                        color: COLORS.text2,
                        fontSize: 10,
                        cursor: 'pointer',
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <div style={{ fontFamily: mono, fontSize: 10, color: COLORS.muted, marginTop: 7 }}>
                {images.length === 1
                  ? 'one view · add a side or back view for a much better result'
                  : `${images.length} views of one subject · more angles, fewer invented details`}
                {' · the prompt box is an optional note'}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
            <button type="button" onClick={() => fileInput.current?.click()} style={secondaryBtn}>
              Import .glb
            </button>
            <button
              type="button"
              onClick={() => imageInput.current?.click()}
              disabled={images.length >= 4}
              style={secondaryBtn}
            >
              {images.length ? 'Add another view' : 'From an image'}
            </button>
            <div style={{ flex: 1 }} />
            <span style={{ fontFamily: mono, fontSize: 10, color: COLORS.muted }}>
              {s.credentials.provider ?? 'no provider'} · {s.settings.style}
            </span>
            <button
              type="button"
              onClick={() => {
                if (images.length) {
                  void s.generateFromImage(images.map((i) => i.dataUrl)).then(() => setImages([]));
                } else void s.submitPrompt();
              }}
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

        {s.settings.guide && s.canGenerate && (
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
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </Panel>
        )}

        {s.activity.length > 0 && (
          <Panel style={{ padding: 12, marginTop: 14 }}>
            <SectionLabel style={{ marginBottom: 9 }}>Recent changes</SectionLabel>
            <ActivityLog
              entries={s.activity}
              onOpen={(id) => {
                const asset = s.assets.find((a) => a.id === id);
                if (asset) s.openAsset(asset.id);
              }}
            />
          </Panel>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
          <SectionLabel>
            {s.settings.projectName || 'Your project'} · {s.assets.length}{' '}
            {s.assets.length === 1 ? 'asset' : 'assets'}
          </SectionLabel>
          {/* The newest change across the whole project — what you want when
              checking whether the other device has something you do not. */}
          {lastChanged !== null && (
            <span
              title={exactTime(lastChanged)}
              style={{ fontFamily: mono, fontSize: 10, color: COLORS.muted }}
            >
              last changed {ago(lastChanged)}
            </span>
          )}
        </div>

        {s.assets.length === 0 ? (
          <EmptyState
            title="Your library is empty"
            body="Everything you generate or import lands here, with every version kept."
          />
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
              gap: 10,
            }}
          >
            {s.assets.map((x) => {
              const v = x.versions[x.cur];
              const rv = reviewCount(x);
              const ap = approvedCount(x);
              const fromAndroid = x.device === 'android';
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
                          left: 5,
                          bottom: 5,
                          fontSize: 9,
                          color: rv ? A : COLORS.ok,
                        }}
                      >
                        {rv ? `${rv} to review` : `${ap} clip${ap > 1 ? 's' : ''} ✓`}
                      </span>
                    )}
                  </div>
                  <div style={{ fontWeight: 500, fontSize: 12, marginTop: 7 }}>{x.name}</div>
                  <div style={{ fontFamily: mono, fontSize: 10, color: COLORS.muted, marginTop: 2 }}>
                    {v.label} · {formatTris(v.stats.triangles)} · {ago(x.updatedAt)}
                  </div>
                </button>
              );
            })}
          </div>
        )}
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
          const asset = await s.importModel(file, s.category);
          if (asset) s.openAsset(asset.id);
        }}
      />

      <input
        ref={imageInput}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={async (e) => {
          const files = e.target.files;
          await addImages(files);
          e.target.value = '';
        }}
      />
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
