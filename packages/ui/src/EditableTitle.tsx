import { useEffect, useRef, useState } from 'react';
import { COLORS, MAX_NAME } from '@forge/core';

export interface EditableTitleProps {
  value: string;
  /** Returns the name that was actually stored, or null if it was refused. */
  onCommit: (next: string) => string | null;
  /** Extra text shown after the name when not editing, e.g. a selected bone. */
  suffix?: string;
  style?: React.CSSProperties;
  /** Bigger hit target and font for touch. */
  compact?: boolean;
}

/**
 * An asset title you can click to rename.
 *
 * Deliberately not a separate dialog: the title is already on screen in both
 * apps, and a rename is one word — making it a modal would be more ceremony
 * than the change deserves. Escape abandons the edit, Enter and clicking away
 * both keep it, which is what every other rename-in-place behaves like.
 */
export function EditableTitle({ value, onCommit, suffix, style, compact }: EditableTitleProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const input = useRef<HTMLInputElement | null>(null);
  // Guards the blur handler: without it, committing on Enter and then losing
  // focus would fire the commit twice and log two renames.
  const done = useRef(false);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (!editing) return;
    input.current?.focus();
    input.current?.select();
  }, [editing]);

  const start = () => {
    done.current = false;
    setDraft(value);
    setEditing(true);
  };

  const finish = (save: boolean) => {
    if (done.current) return;
    done.current = true;
    setEditing(false);
    if (save && draft.trim() && draft !== value) onCommit(draft);
  };

  if (editing) {
    return (
      <input
        ref={input}
        value={draft}
        maxLength={MAX_NAME + 10}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => finish(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') finish(true);
          if (e.key === 'Escape') finish(false);
          e.stopPropagation();
        }}
        aria-label="Asset name"
        style={{
          width: '100%',
          minWidth: 0,
          padding: compact ? '5px 7px' : '3px 6px',
          borderRadius: 6,
          background: COLORS.input,
          border: `1px solid ${COLORS.accentBorder}`,
          color: COLORS.text,
          fontSize: compact ? 15 : 13,
          fontWeight: 600,
          ...style,
        }}
      />
    );
  }

  return (
    <div
      onClick={start}
      onKeyDown={(e) => {
        if (e.key === 'Enter') start();
      }}
      role="button"
      tabIndex={0}
      title="Click to rename"
      style={{
        minWidth: 0,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        cursor: 'text',
        fontSize: compact ? 15 : 13,
        fontWeight: 600,
        padding: compact ? '5px 0' : 0,
        ...style,
      }}
    >
      {value}
      {suffix ? <span style={{ color: COLORS.muted, fontWeight: 400 }}> › {suffix}</span> : null}
    </div>
  );
}
