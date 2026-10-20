import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App';
import { DataProvider } from './app/DataContext';
import { PlayerProvider } from './features/music/PlayerContext';
import { ToastProvider } from './components/ui/Toast';
import './styles/index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <DataProvider>
        <PlayerProvider>
          <App />
        </PlayerProvider>
      </DataProvider>
    </ToastProvider>
  </StrictMode>,
);
