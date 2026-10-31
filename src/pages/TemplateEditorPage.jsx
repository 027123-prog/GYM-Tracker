import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAppData } from '../components/AppProvider';
import EmptyState from '../components/EmptyState';
import InterfaceIcon, { compactIconButtonClass as iconButtonClass } from '../components/InterfaceIcon';
import ModalShell from '../components/ModalShell';

function MoveIcon({ down = false }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={`h-4 w-4 ${down ? 'rotate-180' : ''}`}><path d="M12 19V5m-6 6 6-6 6 6" /></svg>;
}

function normalizeSearch(value) {
  return value.toLocaleLowerCase('de-DE').normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

function TemplateEditor({ template }) {
  const { state, updateTemplate } = useAppData();
  const navigate = useNavigate();
  const [name, setName] = useState(template.name);
  const [rows, setRows] = useState(() => template.exerciseTemplates.map((entry, index) => ({ key: `existing-${index}`, entry: { ...entry } })));
  const [addingExercise, setAddingExercise] = useState(false);
  const [query, setQuery] = useState('');
  const [error, setError] = useState(null);
  const nextRowKey = useRef(0);
  const saved = useRef(false);
  const initialValues = useRef(JSON.stringify({ name: template.name, exerciseTemplates: template.exerciseTemplates }));
  const exerciseTemplates = rows.map(row => row.entry);
  const dirty = JSON.stringify({ name, exerciseTemplates }) !== initialValues.current;

  useEffect(() => {
    if (!dirty) return undefined;
    function beforeUnload(event) {
      if (saved.current) return;
      event.preventDefault();
      event.returnValue = '';
    }
    function confirmLinkNavigation(event) {
      if (saved.current || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target?.closest?.('a[href]');
      if (!anchor || anchor.hasAttribute('download') || (anchor.target && anchor.target !== '_self')) return;
      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin || destination.href === window.location.href) return;
      const isRouteChange = destination.pathname !== window.location.pathname || destination.search !== window.location.search
        || (destination.hash.startsWith('#/') && destination.hash !== window.location.hash);
      if (isRouteChange && !window.confirm('Änderungen verwerfen?')) {
        event.preventDefault();
        event.stopPropagation();
      }
    }
    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('click', confirmLinkNavigation, true);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      document.removeEventListener('click', confirmLinkNavigation, true);
    };
  }, [dirty]);

  const availableExercises = useMemo(() => {
    const selectedIds = new Set(rows.map(row => row.entry.exerciseId));
    const term = normalizeSearch(query.trim());
    return state.exercises
      .filter(exercise => !exercise.archivedAt && !selectedIds.has(exercise.id) && (!term || normalizeSearch(exercise.name).includes(term)))
      .sort((a, b) => a.name.localeCompare(b.name, 'de-DE', { sensitivity: 'base' }));
  }, [state.exercises, rows, query]);

  function cancel() {
    if (dirty && !window.confirm('Änderungen verwerfen?')) return;
    navigate('/templates');
  }

  function moveRow(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= rows.length) return;
    setRows(current => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setError(null);
  }

  function addExercise(exercise) {
    setRows(current => current.some(row => row.entry.exerciseId === exercise.id) ? current : [...current, {
      key: `added-${nextRowKey.current++}`,
      entry: { exerciseId: exercise.id, name: exercise.name, repScheme: '' },
    }]);
    setAddingExercise(false);
    setQuery('');
    setError(null);
  }

  function save(event) {
    event.preventDefault();
    const message = updateTemplate(template.id, { name, exerciseTemplates });
    if (message) {
      setError(message);
      return;
    }
    saved.current = true;
    navigate('/templates', { state: { notice: 'Gespeichert' } });
  }

  return (
    <form onSubmit={save} className="mx-auto w-full max-w-2xl space-y-4">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center border-b border-line pb-3">
        <button type="button" className={`${iconButtonClass} justify-self-start`} aria-label="Zurück zu Vorlagen" onClick={cancel}>←</button>
        <h1 className="font-display text-[22px] font-bold text-ink">Vorlage</h1>
        <span />
      </div>

      <label className="block">
        <span className="sr-only">Vorlagenname</span>
        <input className="field font-semibold" aria-label="Vorlagenname" value={name} onChange={event => { setName(event.target.value); setError(null); }} placeholder="Name" autoComplete="off" />
      </label>

      <ol className="space-y-2" aria-label="Übungen der Vorlage">
        {rows.map((row, index) => (
          <li key={row.key} className="panel p-3" aria-label={`${index + 1}. ${row.entry.name}`}>
            <div className="flex min-w-0 items-start gap-2">
              <span className="pt-2.5 text-xs font-bold tabular-nums text-amber">{String(index + 1).padStart(2, '0')}</span>
              <h2 className="min-w-0 flex-1 break-words pt-2 text-sm font-bold leading-5 text-ink">{row.entry.name}</h2>
              <button type="button" className={`${iconButtonClass} hover:text-ember`} aria-label={`${row.entry.name} aus Vorlage entfernen`} title="Entfernen" onClick={() => { setRows(current => current.filter(item => item.key !== row.key)); setError(null); }}><InterfaceIcon name="trash" /></button>
            </div>
            <div className="mt-1 flex min-w-0 items-center gap-1">
              <label className="min-w-0 flex-1">
                <span className="sr-only">Vorgabe für {row.entry.name}</span>
                <input className="field h-10 px-2 py-2 text-xs" value={row.entry.repScheme ?? ''} onChange={event => {
                  const repScheme = event.target.value;
                  setRows(current => current.map(item => item.key === row.key ? { ...item, entry: { ...item.entry, repScheme } } : item));
                  setError(null);
                }} placeholder="z. B. 2 × 8–12 · Pause 2 Min." />
              </label>
              <button type="button" className={`${iconButtonClass} disabled:opacity-30`} disabled={index === 0} aria-label={`${row.entry.name} nach oben`} title="Nach oben" onClick={() => moveRow(index, -1)}><MoveIcon /></button>
              <button type="button" className={`${iconButtonClass} disabled:opacity-30`} disabled={index === rows.length - 1} aria-label={`${row.entry.name} nach unten`} title="Nach unten" onClick={() => moveRow(index, 1)}><MoveIcon down /></button>
            </div>
          </li>
        ))}
      </ol>

      {!rows.length ? <EmptyState title="Keine Übungen" /> : null}
      <button type="button" className="secondary-button w-full" onClick={() => { setQuery(''); setAddingExercise(true); }}>+ Übung</button>
      {error ? <p role="alert" className="text-sm text-ember">{error}</p> : null}
      <div className="sticky bottom-0 z-10 grid grid-cols-2 gap-2 border-t border-line bg-paper/95 py-3 backdrop-blur-sm">
        <button type="button" className="secondary-button" onClick={cancel}>Abbrechen</button>
        <button type="submit" className="action-button">Speichern</button>
      </div>

      <ModalShell isOpen={addingExercise} onClose={() => setAddingExercise(false)} labelledBy="template-add-exercise-title" maxWidth="max-w-md" mobilePosition="top">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 id="template-add-exercise-title" className="text-lg font-bold text-ink">Übung hinzufügen</h2>
          <button type="button" className="icon-button" aria-label="Schließen" onClick={() => setAddingExercise(false)}>×</button>
        </div>
        <input type="search" className="field" aria-label="Übung suchen" value={query} onChange={event => setQuery(event.target.value)} placeholder="Suchen …" data-autofocus />
        <div className="mt-3 max-h-[50dvh] divide-y divide-line overflow-y-auto" aria-label="Verfügbare Übungen">
          {availableExercises.map(exercise => <button key={exercise.id} type="button" className="flex min-h-11 w-full items-center justify-between gap-3 py-2 text-left text-sm font-semibold text-ink transition hover:text-amber" onClick={() => addExercise(exercise)} aria-label={`${exercise.name} hinzufügen`}>
            <span className="min-w-0 break-words">{exercise.name}</span><span aria-hidden="true" className="shrink-0 text-lg font-normal text-amber">+</span>
          </button>)}
          {!availableExercises.length ? <p className="py-4 text-center text-sm text-muted">Keine passende Übung.</p> : null}
        </div>
      </ModalShell>
    </form>
  );
}

export default function TemplateEditorPage() {
  const { templateId } = useParams();
  const { state } = useAppData();
  const template = state.templates.find(item => item.id === templateId);
  if (!template) return <div className="space-y-4"><Link to="/templates" className="secondary-button">← Vorlagen</Link><EmptyState title="Vorlage nicht gefunden" /></div>;
  return <TemplateEditor key={template.id} template={template} />;
}
