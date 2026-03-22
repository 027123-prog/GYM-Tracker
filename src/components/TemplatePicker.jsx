export default function TemplatePicker({ templates, onSelect }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {templates.map((template) => (
        <button
          key={template.id}
          type="button"
          onClick={() => onSelect(template.id)}
          className="panel flex min-h-[200px] flex-col justify-between p-6 text-left transition hover:-translate-y-1 hover:border-pine/30"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine/70">Workout aus Vorlage</p>
            <h3 className="mt-4 font-display text-2xl font-semibold text-ink">{template.name}</h3>
          </div>
          <p className="text-sm text-ink/70">{template.exerciseTemplates.map((exercise) => exercise.name).join(' • ')}</p>
        </button>
      ))}
    </div>
  );
}
