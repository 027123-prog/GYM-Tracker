import { useState } from 'react';

export default function TemplatePicker({ templates, onSelect, onDelete, onDuplicate }) {
  const [expandedTemplateIds, setExpandedTemplateIds] = useState(() => new Set());

  function toggleTemplate(templateId) {
    setExpandedTemplateIds((current) => {
      const next = new Set(current);

      if (next.has(templateId)) {
        next.delete(templateId);
      } else {
        next.add(templateId);
      }

      return next;
    });
  }

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {templates.map((template, templateIndex) => {
        const isExpanded = expandedTemplateIds.has(template.id);
        const detailsId = `template-details-${templateIndex}`;
        const exercisePreview =
          template.exerciseTemplates.map((exercise) => exercise.name).join(' · ') || 'Noch keine Übungen';

        return (
          <article key={template.id} className="panel p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="eyebrow">Vorlage</p>
                <h3 className="mt-2 break-words font-display text-xl font-bold text-ink sm:text-2xl">
                  {template.name}
                </h3>
              </div>
              <span className="shrink-0 rounded-sm border border-line bg-paper px-2 py-1 text-xs font-bold text-muted">
                {template.exerciseTemplates.length} Übungen
              </span>
            </div>

            {!isExpanded ? (
              <p className="mt-3 min-h-[3rem] line-clamp-2 text-sm leading-6 text-muted">{exercisePreview}</p>
            ) : null}

            <div className="mt-4 grid gap-2 border-t border-line pt-4 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => onSelect(template.id)}
                className="action-button w-full"
                aria-label={`Training mit ${template.name} starten`}
              >
                Training starten
              </button>
              <button
                type="button"
                onClick={() => toggleTemplate(template.id)}
                className="secondary-button w-full gap-2"
                aria-expanded={isExpanded}
                aria-controls={detailsId}
              >
                {isExpanded ? 'Übungen einklappen' : 'Übungen anzeigen'}
                <svg
                  viewBox="0 0 20 20"
                  fill="none"
                  aria-hidden="true"
                  className={`h-4 w-4 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                >
                  <path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div id={detailsId} hidden={!isExpanded} className="mt-4 border-t border-line pt-4">
              {template.exerciseTemplates.length ? (
                <ol className="grid gap-2 text-sm text-muted sm:grid-cols-2">
                  {template.exerciseTemplates.map((exercise, index) => (
                    <li key={`${exercise.exerciseId}-${index}`} className="flex min-w-0 items-start gap-2">
                      <span className="shrink-0 font-bold tabular-nums text-amber">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span className="min-w-0 break-words">
                        <span className="font-semibold text-ink">{exercise.name}</span>
                        {exercise.repScheme ? <span className="ml-1 text-muted">· {exercise.repScheme}</span> : null}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-muted">Diese Vorlage enthält noch keine Übungen.</p>
              )}

              {onDuplicate || onDelete ? (
                <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
                  {onDuplicate ? (
                    <button
                      type="button"
                      onClick={() => onDuplicate(template.id)}
                      className="secondary-button flex-1 sm:flex-none"
                      aria-label={`${template.name} duplizieren`}
                    >
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
                      className="danger-button flex-1 sm:ml-auto sm:flex-none"
                      aria-label={`${template.name} löschen`}
                    >
                      Löschen
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}
