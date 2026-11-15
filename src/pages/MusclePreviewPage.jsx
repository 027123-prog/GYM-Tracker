import { useEffect, useState } from 'react';
import MuscleFigure from '../components/muscle/MuscleFigure';
import { muscleLoadColor } from '../utils/muscleLoad';
import './musclePreview.css';

const DEMO = { chest_upper: 0.88, chest_middle: 0.55, chest_lower: 0.22, front_delts: 0.50, lateral_delts: 0.12, rear_delts: 0.30, lats: 0.16, upper_back: 0.35, glutes: 0.70, quads: 0.36, hamstrings: 0.55, abs: 0.20, obliques: 0.12, triceps: 0.42, elbow_flexors: 0.1 };
const TEST = { chest_upper: '#ea4955', chest_middle:'#e9ba45', chest_lower:'#48bdaf', front_delts: '#ef9f47', lateral_delts: '#edc34e', rear_delts: '#e06cbc', upper_back: '#5dbbdb', upper_traps:'#eda85e', lats: '#677de0', external_rotators:'#ad72d9', glutes: '#cd79d9', hip_abductors:'#e79ad0', quads: '#49b6a6', hamstrings: '#87b665', adductors:'#d1b46a', calves:'#8bace6', tibialis:'#62cfbf', abs: '#d9c2a0', obliques: '#a98bdf', elbow_flexors:'#e695c6', triceps:'#75bfd5', forearm_flexors:'#87bd69', forearm_extensors:'#d69b62', brachioradialis:'#d9d571' };

export default function MusclePreviewPage() {
  const [mode, setMode] = useState(() => {
    const query = new URLSearchParams(window.location.search);
    return query.has('neutral') ? 'neutral' : 'training';
  });
  const [days, setDays] = useState(0);
  const [result, setResult] = useState(null);
  const [unavailable, setUnavailable] = useState(false);
  const [info, setInfo] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    fetch(`/__muscle-preview-data?days=${days}`, { signal: abort.signal })
      .then(response => { if (!response.ok) throw new Error('Unavailable'); return response.json(); })
      .then(data => { setResult(data); setUnavailable(!data.available); })
      .catch(error => { if (error.name !== 'AbortError') setUnavailable(true); });
    return () => abort.abort();
  }, [days]);
  const demo = Object.fromEntries(Object.entries(DEMO).map(([id, value]) => {
    const intensity = value * 2 ** (-days / 2);
    return [id, { intensity, color: muscleLoadColor(intensity) }];
  }));
  const test = Object.fromEntries(Object.entries(TEST).map(([id, color]) => [id, { intensity: 0.65, debugColor: color }]));
  const muscles = mode === 'neutral' ? {} : mode === 'test' ? test : mode === 'demo' || unavailable ? demo : result?.muscles || {};
  const date = result?.evaluatedAt ? new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long' }).format(new Date(result.evaluatedAt)) : '15. November';
  return (
    <div className="muscle-preview">
      <header className="muscle-preview-header">
        <a href="/" aria-label="Zur HardGainWAF-Startseite">HARDGAIN<span>WAF</span></a>
        <span>Muskelkarte <span className="muscle-preview-tag">Entwurf</span></span>
      </header>
      <main className="muscle-preview-main">
        <div className="muscle-preview-heading"><p>DEIN TRAINING. IM BLICK.</p><h1>Was du bewegt hast.</h1></div>
        <div className="muscle-preview-layout">
          <section className="muscle-preview-body" aria-label="Muskelkarte"><MuscleFigure muscles={muscles} /></section>
          <aside className="muscle-preview-controls">
            <div className="muscle-preview-control-title"><h2>Trainingsbelastung</h2><button type="button" aria-label="Hinweise zur Vorschau" aria-expanded={info} onClick={() => setInfo(value => !value)}>i</button></div>
            <div className="muscle-preview-source" aria-label="Farbquelle">
              <button type="button" aria-pressed={mode === 'training'} onClick={() => setMode('training')}>Dein Training</button>
              <button type="button" aria-pressed={mode === 'demo'} onClick={() => setMode('demo')}>Beispiel</button>
              <button type="button" aria-pressed={mode === 'test'} onClick={() => setMode('test')}>Testfarben</button>
            </div>
            {mode !== 'test' ? <div className="muscle-preview-time">
              <label htmlFor="muscle-preview-days"><span>{days === 0 ? 'Stand des Exports' : `${days} Tage später`}</span><strong>{date}</strong></label>
              <input id="muscle-preview-days" aria-label="Tage nach dem Export" type="range" min="0" max="14" step="1" value={days} onChange={event => setDays(Number(event.target.value))} />
              <div className="muscle-preview-range-ends"><span>Jetzt</span><span>+14 Tage</span></div>
            </div> : null}
            {info ? <div className="muscle-preview-info"><p>Rot zeigt eine Schätzung aus Trainingsumfang, relativer Last und Zeitabstand. Testfarben helfen, die Muskelbereiche aus allen Richtungen zu prüfen.</p><p style={{ marginTop: 12 }}>3D-Figur: <a href="https://sketchfab.com/3d-models/male-full-body-ecorche-ab11ebff89224f03bd75efede1164cf6">Diego Luján García</a>, <a href="/anatomy/LICENSE.txt">CC BY 4.0</a>. Kopf: <a href="/anatomy/HEAD-ATTRIBUTION.md">MakeHuman, CC0</a>. <a href="/anatomy/DIEGO-ATTRIBUTION.md">Quellen und Änderungen</a>.</p></div> : null}
            {unavailable ? <p role="status" className="muscle-preview-info">Trainingsvorschau nicht verfügbar. Es werden Beispieldaten gezeigt.</p> : null}
            <p className="muscle-preview-hint">Mit Ziehen oder Wischen drehen.</p>
          </aside>
        </div>
      </main>
    </div>
  );
}


