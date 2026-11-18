import { useState } from 'react';
import { readTheme, saveTheme } from '../utils/appearance';
import InterfaceIcon from './InterfaceIcon';
import ModalShell from './ModalShell';
import AndroidUpdateControl from './AndroidUpdateControl';

export default function AppSettings() {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState(readTheme);
  const calendar = theme === 'calendar';

  function toggleTheme() {
    const next = calendar ? 'dark' : 'calendar';
    saveTheme(next);
    setTheme(next);
  }

  return (
    <>
      <button type="button" className="icon-button" onClick={() => setOpen(true)}
        aria-label="Einstellungen" title="Einstellungen" aria-haspopup="dialog" aria-expanded={open}>
        <InterfaceIcon name="settings" />
      </button>
      <ModalShell isOpen={open} onClose={() => setOpen(false)} labelledBy="app-settings-title"
        maxWidth="max-w-sm" dismissOnBackdrop>
        <div className="flex items-start justify-between gap-3">
          <h2 id="app-settings-title" className="font-display text-2xl font-bold text-ink">Einstellungen</h2>
          <button type="button" className="icon-button" aria-label="Dialog schließen" onClick={() => setOpen(false)}>×</button>
        </div>
        <button type="button" role="switch" aria-checked={calendar} aria-label="Kalenderdesign"
          data-autofocus onClick={toggleTheme}
          className="secondary-button mt-5 w-full justify-between gap-3">
          <span>Kalenderdesign</span>
          <span aria-hidden="true" className={calendar ? 'text-amber-deep' : 'text-muted'}>
            {calendar ? 'Ein' : 'Aus'}
          </span>
        </button>
        {import.meta.env.MODE === 'android' && <AndroidUpdateControl />}
      </ModalShell>
    </>
  );
}
