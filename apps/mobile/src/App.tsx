import { COLORS } from '@forge/core';
import { GeneratingOverlay, SyncPill, Toast } from '@forge/ui';
import { useMobileSession } from './session.js';
import type { Tab } from './session.js';
import { Library } from './tabs/Library.js';
import { AssetTab } from './tabs/AssetTab.js';
import { Capture } from './tabs/Capture.js';
import { ExportTab } from './tabs/ExportTab.js';

const A = COLORS.accent;
const TABS: Tab[] = ['Library', 'Asset', 'Capture', 'Export'];

export function App() {
  const s = useMobileSession();

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        background: COLORS.canvas,
        fontSize: 13,
        paddingTop: 'env(safe-area-inset-top)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          padding: '6px 0',
          borderBottom: `1px solid ${COLORS.hairline}`,
        }}
      >
        <SyncPill label={s.sync.label} ok={s.sync.ok} />
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', position: 'relative' }}>
        {s.tab === 'Library' && <Library s={s} />}
        {s.tab === 'Asset' && <AssetTab s={s} />}
        {s.tab === 'Capture' && <Capture s={s} />}
        {s.tab === 'Export' && <ExportTab s={s} />}
      </div>

      <nav
        style={{
          display: 'flex',
          borderTop: `1px solid ${COLORS.hairline}`,
          background: COLORS.surface,
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {TABS.map((t) => {
          const on = s.tab === t;
          const off = (t === 'Asset' || t === 'Export') && !s.active;
          return (
            <button
              key={t}
              type="button"
              onClick={() => s.goTab(t)}
              style={{
                flex: 1,
                minHeight: 44,
                padding: '7px 0',
                border: 'none',
                background: 'transparent',
                color: on ? A : off ? COLORS.disabled : COLORS.muted,
                fontWeight: on ? 600 : 400,
                fontSize: 11,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <span
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 4,
                  background: on ? A : off ? COLORS.raised : COLORS.control,
                }}
              />
              {t}
            </button>
          );
        })}
      </nav>

      {s.generating && <GeneratingOverlay progress={s.progress} prompt={s.activePrompt} compact />}
      <Toast text={s.toast} />
    </div>
  );
}
