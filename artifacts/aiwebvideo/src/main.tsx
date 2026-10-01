import { createRoot } from 'react-dom/client';

import App from './App';
import { installDragScroll } from './lib/dragScroll';

import './index.css';
import './finished-chat-compact.css';
import './creator-cta-position.css';
import './generation-canvas-overrides.css';
import './cinematic-theme.css';

installDragScroll();

createRoot(document.getElementById('root')!).render(<App />);
