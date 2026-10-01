import { createRoot } from 'react-dom/client';

import App from './App';
import { installDragScroll } from './lib/dragScroll';
import { installStaleAssetRecovery } from './lib/staleAssets';

import './index.css';
import './finished-chat-compact.css';
import './creator-cta-position.css';
import './generation-canvas-overrides.css';
import './cinematic-theme.css';

installDragScroll();
// After a new deploy an old tab cannot find its renamed files: load the new version once instead of failing.
installStaleAssetRecovery();

createRoot(document.getElementById('root')!).render(<App />);
