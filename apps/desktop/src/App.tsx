import { COLORS } from '@forge/core';
import { GeneratingOverlay, Toast } from '@forge/ui';
import { SessionProvider, useSession } from './session.js';
import { TopBar } from './components/TopBar.js';
import { Start } from './screens/Start.js';
import { Editor } from './screens/Editor.js';
import { SpritesModal, useSpriteBatch } from './modals/Sprites.js';
import { PhotoModal } from './modals/Photo.js';
import { CameraModal } from './modals/Camera.js';
import { SettingsModal } from './modals/Settings.js';
import { ExportDrawer } from './modals/ExportDrawer.js';

export function App() {
  const session = useSession();
  const batch = useSpriteBatch(session);
  const batchRunning = batch.queue === 'running';

  return (
    <SessionProvider value={session}>
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
        {session.screen === 'start' ? <Start /> : <Editor />}

        <TopBar batch={batchRunning ? { done: batch.done, total: batch.total } : null} />

        {session.exportOpen && <ExportDrawer />}
        {session.modal === 'sprites' && <SpritesModal batch={batch} />}
        {session.modal === 'photo' && <PhotoModal />}
        {session.modal === 'camera' && <CameraModal />}
        {session.modal === 'settings' && <SettingsModal />}

        {session.generating && (
          <GeneratingOverlay progress={session.progress} prompt={session.activePrompt} />
        )}

        <Toast text={session.toast} />
      </div>
    </SessionProvider>
  );
}
