import { useState } from 'react';
import { Link } from 'react-router-dom';
import InterfaceIcon, { compactIconButtonClass } from './InterfaceIcon';
import { splitExerciseName } from '../utils/workoutPresentation';

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
          template.exerciseTemplates.map((exercise) => splitExerciseName(exercise.name).mainName).join(' · ') || 'Noch keine Übungen';

        return (
          <article key={template.id} className="panel p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-start gap-1">
                <h3 className="min-w-0 flex-1 break-words font-display text-xl font-bold text-ink sm:text-2xl">
                  {template.name}
                </h3>
                <Link to={`/templates/${template.id}/edit`} className={compactIconButtonClass} aria-label={`${template.name} bearbeiten`} title="Vorlage bearbeiten"><InterfaceIcon name="pencil" /></Link>
              </div>
              <span className="shrink-0 rounded-sm border border-line bg-paper px-2 py-1 text-xs font-bold text-muted">
                {template.exerciseTemplates.length} Übungen
              </span>
            </div>

            <button
              type="button"
              onClick={() => toggleTemplate(template.id)}
              className="mt-3 flex min-h-11 w-full items-center justify-between gap-2 rounded-sm text-left text-sm leading-6 text-muted transition hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber"
              aria-label={`Übungen von ${template.name} ${isExpanded ? 'ausblenden' : 'anzeigen'}`}
              aria-expanded={isExpanded}
              aria-controls={detailsId}
            >
              <span className="line-clamp-2 min-w-0">{exercisePreview}</span>
              <svg
                viewBox="0 0 20 20"
                fill="none"
                aria-hidden="true"
                className={`h-4 w-4 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              >
                <path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>

            <div className="mt-3 border-t border-line pt-3">
              <button
                type="button"
                onClick={() => onSelect(template.id)}
                className="action-button w-full"
                aria-label={`Training mit ${template.name} starten`}
              >
                Starten
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
                <p className="text-sm text-muted">Keine Übungen</p>
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
