import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAppData } from '../components/AppProvider';
import EmptyState from '../components/EmptyState';
import TemplatePicker from '../components/TemplatePicker';

export default function TemplatesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { state, createWorkoutFromTemplate, deleteTemplate, duplicateTemplate } = useAppData();

  function startTemplate(templateId) {
    const createdId = createWorkoutFromTemplate(templateId);

    if (createdId) {
      navigate(`/workouts/${createdId}/edit`);
    }
  }

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-[1fr_auto_1fr] items-center border-b border-line pb-3">
        <Link to="/workouts/start" className="icon-button justify-self-start" aria-label="Zurück zum Trainingsstart">←</Link>
        <h1 className="font-display text-[22px] font-bold text-ink">Vorlagen</h1>
        <span />
      </section>

      {location.state?.notice ? <p role="status" className="text-xs text-amber">{location.state.notice}</p> : null}

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
