import { useNavigate } from 'react-router-dom';
import { useAppData } from '../components/AppProvider';
import EmptyState from '../components/EmptyState';
import TemplatePicker from '../components/TemplatePicker';

export default function TemplatesPage() {
  const navigate = useNavigate();
  const { state, createWorkoutFromTemplate, deleteTemplate, duplicateTemplate } = useAppData();

  function startTemplate(templateId) {
    const createdId = createWorkoutFromTemplate(templateId);

    if (createdId) {
      navigate(`/workouts/${createdId}/edit`);
    }
  }

  return (
    <div className="space-y-5">
      <section className="border-b border-line pb-5">
        <p className="eyebrow">Training planen</p>
        <h1 className="mt-2 font-display text-3xl font-bold uppercase text-ink sm:text-4xl">Vorlagen</h1>
        <p className="mt-2 text-sm text-muted">Wiederkehrende Abläufe starten, kopieren oder aufräumen.</p>
      </section>

      {state.templates.length ? (
        <TemplatePicker
          templates={state.templates}
          onSelect={startTemplate}
          onDelete={deleteTemplate}
          onDuplicate={duplicateTemplate}
        />
      ) : (
        <EmptyState
          title="Keine Vorlagen gespeichert"
          description="Speichere ein offenes Workout als Vorlage, um es hier erneut zu starten."
        />
      )}
    </div>
  );
}
