import * as Sentry from '@sentry/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import AppErrorBoundary from './components/AppErrorBoundary.jsx';
import { installChunkLoadRecovery } from './lib/appRecovery.js';
import './styles.css';

Sentry.init({
  dsn: 'https://b271b9a809d46e1e75b2073efbf55e6c@o4511806410129408.ingest.us.sentry.io/4511807855722496',
  environment: import.meta.env.MODE || 'production' || 'development',
  dataCollection: {
    // To disable sending user data and HTTP bodies, uncomment the lines below. For more info visit:
    // https://docs.sentry.io/platforms/javascript/guides/react/configuration/options/#dataCollection
    // userInfo: false,
    // httpBodies: []
  },
});

installChunkLoadRecovery();

createRoot(document.getElementById('root')).render(
  <AppErrorBoundary>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </AppErrorBoundary>
);

