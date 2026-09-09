import { COLORS, ago, exactTime } from '@forge/core';
import type { ActivityEntry } from '@forge/core';
import { mono } from './components.js';

export interface ActivityLogProps {
  entries: ActivityEntry[];
  /** How many to show before the "and N more" line. */
  limit?: number;
  /** Open the asset an entry refers to, when it still exists. */
  onOpen?: (assetId: string) => void;
  compact?: boolean;
}

/**
 * What has happened to this library, newest first.
 *
 * The timestamp on an asset says when it last changed; this says what the
 * change was and which device made it — the half that matters once a project
 * is open on a desktop and a phone at the same time.
 */
export function ActivityLog({ entries, limit = 8, onOpen, compact }: ActivityLogProps) {
  if (entries.length === 0) {
    return (
      <p style={{ fontSize: 11, color: COLORS.muted, lineHeight: 1.6, margin: 0 }}>
        Nothing yet. Generating, rigging, repainting and importing all show up here.
      </p>
    );
  }

  const shown = entries.slice(0, limit);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: compact ? 8 : 6 }}>
      {shown.map((entry) => {
        const clickable = Boolean(entry.assetId && onOpen);
        return (
          <div
            key={entry.id}
            onClick={() => entry.assetId && onOpen?.(entry.assetId)}
            title={exactTime(entry.at)}
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 10,
              minWidth: 0,
              padding: compact ? '2px 0' : 0,
              cursor: clickable ? 'pointer' : 'default',
            }}
          >
            <span
              style={{
                fontSize: compact ? 12 : 11,
                color: COLORS.text2,
                flex: 1,
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {entry.message}
            </span>
            <span
              style={{
                fontFamily: mono,
                fontSize: 9,
                color: COLORS.disabled,
                whiteSpace: 'nowrap',
              }}
            >
              {entry.device === 'android' ? 'PHONE' : 'DESK'} · {ago(entry.at)}
            </span>
          </div>
        );
      })}

      {entries.length > shown.length && (
        <div style={{ fontFamily: mono, fontSize: 9, color: COLORS.disabled }}>
          and {entries.length - shown.length} earlier
        </div>
      )}
    </div>
  );
}
