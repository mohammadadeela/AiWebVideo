import { createRoot } from 'react-dom/client';

import App from './App';

import './index.css';
import './finished-chat-compact.css';
import './creator-cta-position.css';
import './generation-canvas-overrides.css';

createRoot(document.getElementById('root')!).render(<App />);
