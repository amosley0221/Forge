import { useCallback, useState } from 'react';
import { COLORS, ago } from '@forge/core';
import type { Asset, ProviderJob } from '@forge/core';
import { Spinner, mono } from './components.js';

const A = COLORS.accent;

export interface ProviderJobsProps {
  enabled: boolean;
  onList: () => Promise<ProviderJob[]>;
  onImport: (job: ProviderJob) => Promise<Asset | null>;
  onOpen?: (asset: Asset) => void;
}

/**
 * Every model this provider key has built, whether or not Forge knows about it.
 *
 * Jobs run through the API never appear in Meshy's own workspace, so a
 * generation whose download failed is otherwise invisible and unrecoverable
 * despite having been paid for. Importing one here only downloads — it never
 * submits a new task, so it costs nothing.
 */
export function ProviderJobs({ enabled, onList, onImport, onOpen }: ProviderJobsProps) {
  const [jobs, setJobs] = useState<ProviderJob[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setJobs(await onList());
    setLoading(false);
  }, [onList]);

  if (!enabled) {
    return (
      <p style={{ fontSize: 11, color: COLORS.muted, lineHeight: 1.6, margin: 0 }}>
        Connect a Meshy key to see what it has already generated.
      </p>
    );
  }

  return (
    <>
      <p style={{ fontSize: 11, color: COLORS.muted, lineHeight: 1.6, margin: '0 0 10px' }}>
        Models generated through the API do not show up in Meshy's own workspace. Anything you
        paid for is listed here — pulling one in only downloads it, so it uses no credits.
      </p>

      <button
        type="button"
        onClick={() => void load()}
        disabled={loading}
        style={{
          width: '100%',
          padding: '10px 0',
          borderRadius: 8,
          border: `1px solid ${COLORS.inputBorder}`,
          background: 'transparent',
          color: COLORS.text2,
          fontSize: 12,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        {loading && <Spinner size={12} />}
        {loading ? 'Loading…' : jobs ? 'Refresh' : 'Show my past jobs'}
      </button>

      {jobs?.length === 0 && (
        <p style={{ fontSize: 11, color: COLORS.muted, margin: '10px 0 0' }}>
          Meshy returned no jobs for this key.
        </p>
      )}

      {jobs && jobs.length > 0 && (
        <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
          {jobs.map((job) => (
            <div
              key={job.taskId}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: 9,
                borderRadius: 8,
                background: COLORS.surface,
                border: `1px solid ${COLORS.hairline}`,
              }}
            >
              {job.thumbnailUrl ? (
                <img
                  src={job.thumbnailUrl}
                  alt=""
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 6,
                    objectFit: 'cover',
                    background: COLORS.control,
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 6,
                    background: COLORS.control,
                    display: 'grid',
                    placeItems: 'center',
                    fontFamily: mono,
                    fontSize: 8,
                    color: COLORS.disabled,
                  }}
                >
                  {job.source === 'image' ? 'IMG' : 'TXT'}
                </div>
              )}

              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 12,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {job.prompt}
                </div>
                <div style={{ fontFamily: mono, fontSize: 9, color: COLORS.muted, marginTop: 2 }}>
                  {job.status}
                  {job.createdAt ? ` · ${ago(job.createdAt)}` : ''}
                </div>
              </div>

              <button
                type="button"
                disabled={!job.succeeded || importing !== null}
                onClick={() => {
                  setImporting(job.taskId);
                  void onImport(job)
                    .then((asset) => {
                      if (asset) onOpen?.(asset);
                    })
                    .finally(() => setImporting(null));
                }}
                title={job.succeeded ? 'Download this model into your library' : `Job ${job.status}`}
                style={{
                  padding: '7px 12px',
                  borderRadius: 6,
                  border: 'none',
                  background: job.succeeded ? A : COLORS.control,
                  color: job.succeeded ? COLORS.ink : COLORS.muted,
                  fontWeight: 600,
                  fontSize: 11,
                  cursor: job.succeeded ? 'pointer' : 'not-allowed',
                  whiteSpace: 'nowrap',
                }}
              >
                {importing === job.taskId ? 'Importing…' : 'Import'}
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
