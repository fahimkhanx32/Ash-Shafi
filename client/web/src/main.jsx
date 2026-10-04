import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App from './app/App.jsx';
import './lib/i18n.js';
import { AuthProvider } from './providers/AuthProvider.jsx';
import { ThemeProvider } from './providers/ThemeProvider.jsx';
import { ToastProvider } from './providers/ToastProvider.jsx';
import { ConfirmProvider } from './providers/ConfirmProvider.jsx';
import { SpeechProvider } from './providers/SpeechProvider.jsx';
import { ErrorBoundary } from './components/ui/ErrorBoundary.jsx';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <ThemeProvider>
            <SpeechProvider>
              <ToastProvider>
                <ConfirmProvider>
                  <App />
                </ConfirmProvider>
              </ToastProvider>
            </SpeechProvider>
          </ThemeProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
);
