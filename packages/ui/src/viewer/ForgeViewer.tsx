import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import type { ClipName, Kind } from '@forge/core';
import { ViewerEngine } from './engine.js';

export interface ForgeViewerProps {
  kind: Kind;
  version?: number;
  variant?: number;
  wire?: boolean;
  selected?: string | null;
  autorotate?: boolean;
  anim?: ClipName;
  speed?: number;
  compact?: boolean;
  onPick?: (part: string | null) => void;
  style?: CSSProperties;
  className?: string;
}

/**
 * Full-bleed 3D viewport. Mount it once and let the props drive it — the
 * engine only rebuilds geometry when something structural changes, so
 * switching clips or speed never restarts the scene.
 */
export function ForgeViewer({
  kind,
  version = 1,
  variant = 0,
  wire = false,
  selected = null,
  autorotate = false,
  anim = 'idle',
  speed = 1,
  compact = false,
  onPick,
  style,
  className,
}: ForgeViewerProps) {
  const host = useRef<HTMLDivElement | null>(null);
  const engine = useRef<ViewerEngine | null>(null);
  const pick = useRef(onPick);
  pick.current = onPick;

  useEffect(() => {
    if (!host.current) return;
    const e = new ViewerEngine(host.current, (part) => pick.current?.(part));
    engine.current = e;
    return () => {
      e.dispose();
      engine.current = null;
    };
  }, []);

  useEffect(() => {
    engine.current?.update({ kind, version, variant, wire, selected, autorotate, anim, speed, compact });
  }, [kind, version, variant, wire, selected, autorotate, anim, speed, compact]);

  return (
    <div
      ref={host}
      className={className}
      style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', ...style }}
    />
  );
}
