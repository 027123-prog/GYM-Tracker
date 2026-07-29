export default function TemplatePicker({ templates, onSelect, onDelete, onDuplicate }) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {templates.map((template) => (
        <article key={template.id} className="panel flex min-h-[190px] flex-col p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="eyebrow">Vorlage</p>
              <h3 className="mt-2 font-display text-2xl font-bold text-ink">{template.name}</h3>
            </div>
            <span className="rounded-sm border border-line bg-paper px-2 py-1 text-xs font-bold text-muted">
              {template.exerciseTemplates.length} Übungen
            </span>
          </div>

          <ol className="mt-4 grid flex-1 gap-1 text-sm text-muted sm:grid-cols-2">
            {template.exerciseTemplates.map((exercise, index) => (
              <li key={`${exercise.exerciseId}-${index}`} className="truncate">
                <span className="mr-2 text-amber">{String(index + 1).padStart(2, '0')}</span>
                {exercise.name}
                {exercise.repScheme ? <span className="ml-1 text-muted/70">· {exercise.repScheme}</span> : null}
              </li>
            ))}
          </ol>

          <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
            <button type="button" onClick={() => onSelect(template.id)} className="action-button">
              Training starten
            </button>
            {onDuplicate ? (
              <button type="button" onClick={() => onDuplicate(template.id)} className="secondary-button">
                Duplizieren
              </button>
            ) : null}
            {onDelete ? (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Vorlage „${template.name}“ wirklich löschen?`)) {
                    onDelete(template.id);
                  }
                }}
                className="danger-button sm:ml-auto"
              >
                Löschen
              </button>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}
