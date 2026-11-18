import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './calendar-theme.css';
import { clearAppliedUpdateToken } from './utils/appUpdates';
import { applyTheme, readTheme } from './utils/appearance';

applyTheme(readTheme());

if (import.meta.env.PROD && import.meta.env.MODE !== 'android') {
  const cleanUrl = clearAppliedUpdateToken(window.location.href, __APP_RELEASE__.buildId);
  if (cleanUrl) window.history.replaceState(window.history.state, '', cleanUrl);
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
