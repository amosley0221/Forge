import { COLORS } from '@forge/core';
import { JobOverlay, Toast } from '@forge/ui';
import { useSession } from './session.js';
import { TopBar } from './components/TopBar.js';
import { Settings } from './components/Settings.js';
import { ExportDrawer } from './components/ExportDrawer.js';
import { Onboarding } from './screens/Onboarding.js';
import { Start } from './screens/Start.js';
import { Editor } from './screens/Editor.js';

export function App() {
  const s = useSession();

  // Nothing renders until persisted state has been read, so a real first
  // launch never flashes the wrong screen.
  if (s.onboarded === null) {
    return <div style={{ position: 'absolute', inset: 0, background: COLORS.canvas }} />;
  }
  if (!s.onboarded) return <Onboarding s={s} />;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        minWidth: 1180,
        minHeight: 620,
        background: COLORS.canvas,
        fontSize: 12,
        overflow: 'hidden',
      }}
    >
      {s.screen === 'start' ? <Start s={s} /> : <Editor s={s} />}

      <TopBar s={s} />

      {s.exportOpen && <ExportDrawer s={s} />}
      {s.settingsOpen && <Settings s={s} />}

      {s.job.running && (
        <JobOverlay label={s.job.label} percent={s.job.percent} onCancel={s.cancelJob} />
      )}

      <Toast text={s.toast} />
    </div>
  );
}
