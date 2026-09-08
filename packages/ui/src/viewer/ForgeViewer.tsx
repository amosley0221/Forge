import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, MutableRefObject } from 'react';
import { COLORS } from '@forge/core';
import type { MeshStats } from '@forge/core';
import { ViewerEngine } from './engine.js';
import { Spinner } from '../components.js';

export interface ForgeViewerProps {
  /** URL of the GLB to show. Null renders the empty-viewport message. */
  url: string | null;
  wire?: boolean;
  selected?: string | null;
  autorotate?: boolean;
  clip?: string | null;
  speed?: number;
  compact?: boolean;
  /** Drag a limb to bend it instead of orbiting. Needs a rigged model. */
  pose?: boolean;
  emptyMessage?: string;
  onPick?: (part: string | null) => void;
  onLoaded?: (stats: MeshStats) => void;
  /** Fires on load with whether this file has a skeleton to pose. */
  onSkeleton?: (rigged: boolean) => void;
  /** The limb currently being dragged, or null when nothing is held. */
  onPoseBone?: (name: string | null) => void;
  /** Handed the engine so the caller can drive it directly, e.g. resetPose(). */
  engineRef?: MutableRefObject<ViewerEngine | null>;
  style?: CSSProperties;
  className?: string;
}

/**
 * Renders the real model file. Loading and failure are surfaced here rather
 * than swallowed — if a GLB will not open, the user is told why.
 */
export function ForgeViewer({
  url,
  wire = false,
  selected = null,
  autorotate = false,
  clip = null,
  speed = 1,
  compact = false,
  pose = false,
  emptyMessage = 'No model loaded',
  onPick,
  onLoaded,
  onSkeleton,
  onPoseBone,
  engineRef,
  style,
  className,
}: ForgeViewerProps) {
  const host = useRef<HTMLDivElement | null>(null);
  const engine = useRef<ViewerEngine | null>(null);
  const callbacks = useRef({ onPick, onLoaded, onSkeleton, onPoseBone });
  callbacks.current = { onPick, onLoaded, onSkeleton, onPoseBone };

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!host.current) return;
    const e = new ViewerEngine(host.current, {
      onPick: (part) => callbacks.current.onPick?.(part),
      onLoaded: (stats) => {
        setError(null);
        callbacks.current.onLoaded?.(stats);
      },
      onError: (message) => setError(message),
      onLoadingChange: setLoading,
      onSkeleton: (rigged) => callbacks.current.onSkeleton?.(rigged),
      onPoseBone: (name) => callbacks.current.onPoseBone?.(name),
    });
    engine.current = e;
    if (engineRef) engineRef.current = e;
    return () => {
      e.dispose();
      engine.current = null;
      if (engineRef) engineRef.current = null;
    };
  }, [engineRef]);

  useEffect(() => {
    setError(null);
    engine.current?.update({ url, wire, selected, autorotate, clip, speed, compact, pose });
  }, [url, wire, selected, autorotate, clip, speed, compact, pose]);

  return (
    <div
      className={className}
      style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', ...style }}
    >
      <div ref={host} style={{ position: 'absolute', inset: 0 }} />

      {!url && !loading && (
        <div style={overlay}>
          <span style={{ fontSize: 12, color: COLORS.muted }}>{emptyMessage}</span>
        </div>
      )}

      {loading && (
        <div style={overlay}>
          <Spinner size={14} />
          <span style={{ fontSize: 12, color: COLORS.text2 }}>Opening the model…</span>
        </div>
      )}

      {error && (
        <div style={{ ...overlay, padding: 20, textAlign: 'center' }}>
          <span style={{ fontSize: 12, color: COLORS.danger, lineHeight: 1.5 }}>{error}</span>
        </div>
      )}
    </div>
  );
}

const overlay: CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 9,
  pointerEvents: 'none',
};
