import { useCallback, useEffect, useState } from 'react';
import { COLORS } from '@forge/core';
import { Spinner, mono } from '@forge/ui';
import { RELEASES_PAGE, checkForUpdate, installUpdate } from '../updater.js';
import type { UpdateStatus } from '../updater.js';

const A = COLORS.accent;

/**
 * Offers the newer APK from the GitHub releases page and installs it in place.
 * Because every release is signed with the same key and keeps the same
 * applicationId, Android treats it as an update — no uninstall, and the
 * project data in app storage survives.
 */
export function UpdateBanner({ say }: { say: (t: string) => void }) {
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [percent, setPercent] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  /**
   * Also re-check when the app comes back to the foreground, so a release
   * published while it sat in the background is noticed on return rather than
   * only after a cold start.
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
    const onVisible = () => {
      if (document.visibilityState === 'visible') run();
    };
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisible);

    return () => {
      alive = false;
      clearInterval(timer);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisible);
      }
    };
  }, []);

  const install = useCallback(async () => {
    if (!status?.latest) return;
    setBusy(true);
    setPercent(0);
    try {
      await installUpdate(status.latest, setPercent);
      say('Installer opened — confirm the update to finish');
    } catch (e) {
      say(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  }, [status, say]);

  if (!status?.updateAvailable || !status.latest || dismissed) return null;

  return (
    <div
      style={{
        padding: 12,
        borderRadius: 14,
        marginBottom: 12,
        background: COLORS.accentTint,
        border: `1px solid ${COLORS.accentBorder}`,
        animation: 'rise 300ms ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: A, flex: 1 }}>
          Forge {status.latest.versionName} is available
        </div>
        <span style={{ fontFamily: mono, fontSize: 10, color: COLORS.muted }}>
          you have {status.current.versionName}
        </span>
      </div>

      {status.latest.notes && (
        <p style={{ fontSize: 11, color: COLORS.text2, lineHeight: 1.5, margin: '6px 0 0' }}>
          {status.latest.notes}
        </p>
      )}

      {busy && (
        <div style={{ margin: '10px 0 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: COLORS.text2 }}>
            <Spinner size={12} /> Downloading… {percent}%
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
        </div>
      )}

      {!busy && (
        <div style={{ display: 'flex', gap: 8, marginTop: 11 }}>
          <button
            type="button"
            onClick={() => void install()}
            style={{
              flex: 1,
              padding: '10px 0',
              borderRadius: 8,
              border: 'none',
              background: A,
              color: COLORS.ink,
              fontWeight: 600,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Update
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              border: `1px solid ${COLORS.inputBorder}`,
              background: 'transparent',
              color: COLORS.text2,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Later
          </button>
        </div>
      )}

      <a
        href={RELEASES_PAGE}
        target="_blank"
        rel="noreferrer"
        style={{ display: 'inline-block', marginTop: 9, fontSize: 10, color: COLORS.muted }}
      >
        View release notes ↗
      </a>
    </div>
  );
}
