import { useState } from 'react';
import qrcode from 'qrcode-generator';
import { pcOrigin, pcRequest } from '../utils/homeSyncTransport';

function pairingImage(link) {
  const code = qrcode(0, 'M');
  code.addData(link, 'Byte');
  code.make();
  return code.createDataURL(5);
}

export default function HomeSyncSettings({ sync }) {
  const { device, report, pairing } = sync;
  const [ticket, setTicket] = useState(null);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [disconnect, setDisconnect] = useState(false);
  const pending = pairing.pendingLink || input;
  const connected = device === 'pc' || pairing.paired;
  async function action(fn) {
    setBusy(true);
    setError('');
    try { await fn(); } catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  }
  async function generate() {
    const response = await pcRequest('pairing', 'POST', null, {});
    if (response.status !== 200 && response.status !== 201) throw new Error('Der WLAN-Dienst auf diesem PC ist nicht bereit.');
    setTicket({ ...response.data, image: pairingImage(response.data.link) });
    setCopied(false);
  }
  const localLabel = device === 'pc' ? 'Diese PC-Fassung behalten' : 'Handy-Fassung behalten';
  return <section aria-label="Heim-WLAN" className="mt-4 space-y-2 border-t border-line pt-3">
    <h3 className="font-semibold text-ink">Heim-WLAN</h3>
    {!device ? <p className="text-sm text-muted">Der Abgleich läuft in der Android-App und in der lokalen PC-App.
      {' '}<a className="text-amber-deep underline" href={pcOrigin}>Lokale PC-App öffnen</a></p> : <>
      {connected && <p role="status" className="text-sm text-muted">
        {report.status === 'conflict' ? 'Beide Geräte haben dieselben Angaben unterschiedlich geändert.'
          : report.status === 'offline' ? report.message
          : report.status === 'ok' ? 'Abgeglichen um ' + new Date(report.at).toLocaleTimeString('de-DE', { hour:'2-digit', minute:'2-digit' }) + ' Uhr'
          : device === 'pc' ? 'Dieser PC hält den gemeinsamen Trainingsstand.' : 'Mit dem PC gekoppelt.'}
      </p>}
      {report.status === 'conflict' && <div className="space-y-2">
        <ul className="max-h-48 space-y-2 overflow-y-auto text-sm">{report.conflicts.map(item => <li key={JSON.stringify(item.path)}>
          <strong>{item.label}</strong><br />Dieses Gerät · {item.localPreview}<br />Gemeinsamer Stand · {item.remotePreview}
        </li>)}</ul>
        <p className="text-xs text-muted">Die Auswahl gilt für alle {report.conflicts.length} widersprüchlichen Angaben. Die übrigen Änderungen werden zusammengeführt.</p>
        <button type="button" className="secondary-button w-full" onClick={() => sync.resolveConflict('local')}>{localLabel}</button>
        <button type="button" className="secondary-button w-full" onClick={() => sync.resolveConflict('remote')}>Gemeinsame Fassung behalten</button>
      </div>}
      {device === 'pc' ? <>
        <button type="button" className="secondary-button w-full" disabled={busy} onClick={() => action(generate)}>
          {ticket ? 'Neuen Kopplungscode anzeigen' : 'Handy koppeln'}
        </button>
        {ticket && <div className="space-y-2 text-sm">
          <img className="mx-auto w-full max-w-64 rounded-sm bg-white" src={ticket.image} alt="Kopplungscode für die Gym-App" />
          <p>Mit der Handykamera im Heim-WLAN scannen und in der Gym-App bestätigen.
            {' '}Gültig bis {new Date(ticket.expiresAt).toLocaleTimeString('de-DE', { hour:'2-digit', minute:'2-digit' })} Uhr.</p>
          <button type="button" className="secondary-button w-full" onClick={() => action(async () => { await navigator.clipboard.writeText(ticket.link); setCopied(true); })}>
            {copied ? 'Kopiert' : 'Kopplungslink kopieren'}</button>
        </div>}
      </> : <>
        {(!pairing.paired || pending) && <div className="space-y-2">
          {pairing.pendingLink ? <p className="text-sm">Mit diesem PC koppeln und die Trainingsdaten beider Geräte zusammenführen?</p>
            : <><p className="text-sm text-muted">Am PC unter Einstellungen „Handy koppeln“ wählen und den Code mit der Kamera scannen.</p>
            <label className="block text-xs text-muted">Kopplungslink vom PC
              <input className="field mt-1" autoComplete="off" spellCheck="false" value={input} onChange={e => setInput(e.target.value)} />
            </label></>}
          {!!pending && <button type="button" className="action-button w-full" disabled={busy} onClick={() => action(async () => { await sync.pair(pending); setInput(''); })}>Mit diesem PC verbinden</button>}
          {pairing.pendingLink && <button type="button" className="secondary-button w-full" onClick={sync.dismissLink}>Abbrechen</button>}
        </div>}
        {pairing.paired && <button type="button" className="secondary-button w-full" onClick={() => {
          if (disconnect) { sync.forget(); setDisconnect(false); } else setDisconnect(true);
        }}>{disconnect ? 'Trennen bestätigen' : 'Verbindung trennen'}</button>}
      </>}
      {connected && report.status !== 'conflict' && <button type="button" className="secondary-button w-full" onClick={() => sync.refresh()}>Jetzt abgleichen</button>}
      {error && <p role="alert" className="text-sm text-ember">{error}</p>}
    </>}
  </section>;
}
