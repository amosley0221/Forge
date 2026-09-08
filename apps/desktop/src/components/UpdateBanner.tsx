import { useCallback, useEffect, useState } from 'react';
import { COLORS } from '@forge/core';
import { Panel, Spinner, mono } from '@forge/ui';
import { RELEASES_PAGE, checkForUpdate, installUpdate } from '../updater.js';
import type { UpdateStatus } from '../updater.js';

const A = COLORS.accent;

/**
 * Offers a newer build and installs it over this one. Tauri verifies the
 * release signature before installing, and the app restarts into the new
 * version — nothing is uninstalled, so the project and the provider key stay
 * where they are.
 */
export function UpdateBanner({
  say,
  busyWithJob,
}: {
  say: (t: string) => void;
  /** A generation in flight; restarting would interrupt it. */
  busyWithJob?: boolean;
}) {
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [percent, setPercent] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  /**
   * Checking only at launch means a release published while Forge is open goes
   * unnoticed until the next restart. Re-check when the window regains focus
   * and every half hour, so a running app finds out on its own.
   */
  useEffect(() => {
    let alive = true;
    const run = () => {
      void checkForUpdate().then((s) => {
        if (alive) setStatus(s);
      });
    };

    run();
    const timer = setInterval(run, 30 * 60 * 1000);
    const onFocus = () => run();
    if (typeof window !== 'undefined') window.addEventListener('focus', onFocus);

    return () => {
      alive = false;
      clearInterval(timer);
      if (typeof window !== 'undefined') window.removeEventListener('focus', onFocus);
    };
  }, []);

  const install = useCallback(async () => {
    if (!status?.update) return;
    setBusy(true);
    setPercent(0);
    try {
      await installUpdate(status.update, (p) => setPercent(p));
    } catch (e) {
      say(e instanceof Error ? e.message : 'Update failed');
      setBusy(false);
    }
  }, [status, say]);

  if (!status?.available || dismissed) return null;

  return (
    <Panel
      style={{
        padding: 12,
        background: COLORS.accentTint,
        border: `1px solid ${COLORS.accentBorder}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: A, flex: 1 }}>
          Forge {status.version} is available
        </div>
        <a href={RELEASES_PAGE} target="_blank" rel="noreferrer" style={{ fontSize: 10 }}>
          Release notes ↗
        </a>
      </div>

      {status.notes && (
        <p style={{ fontSize: 11, color: COLORS.text2, lineHeight: 1.55, margin: '6px 0 0' }}>
          {status.notes}
        </p>
      )}

      {busy ? (
        <div style={{ marginTop: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: COLORS.text2 }}>
            <Spinner size={12} />
            {percent ? `Downloading… ${percent}%` : 'Downloading…'}
          </div>
          <div style={{ height: 3, borderRadius: 2, background: COLORS.control, marginTop: 6 }}>
            <div
              style={{
                height: '100%',
                width: `${percent}%`,
                background: A,
                borderRadius: 2,
                transition: 'width 300ms ease',
              }}
            />
          </div>
          <p style={{ fontSize: 10, color: COLORS.muted, margin: '7px 0 0' }}>
            Forge will restart itself once the update is in place.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, marginTop: 11 }}>
          <button
            type="button"
            onClick={() => void install()}
            disabled={busyWithJob}
            title={busyWithJob ? 'A job is running — let it finish first' : undefined}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: busyWithJob ? `1px solid ${COLORS.inputBorder}` : 'none',
              background: busyWithJob ? 'transparent' : A,
              color: busyWithJob ? COLORS.muted : COLORS.ink,
              fontWeight: 600,
              fontSize: 12,
              cursor: busyWithJob ? 'not-allowed' : 'pointer',
            }}
          >
            Update and restart
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            style={{
              padding: '8px 14px',
              borderRadius: 6,
              border: `1px solid ${COLORS.inputBorder}`,
              background: 'transparent',
              color: COLORS.text2,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Later
          </button>
          <div style={{ flex: 1 }} />
          <span style={{ fontFamily: mono, fontSize: 10, color: COLORS.muted, alignSelf: 'center' }}>
            {busyWithJob ? 'waiting for the current job' : 'installs over this copy'}
          </span>
        </div>
      )}
    </Panel>
  );
}
