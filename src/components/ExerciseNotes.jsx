import { formatSetTime } from '../utils/date';
import InterfaceIcon from './InterfaceIcon';

export default function ExerciseNotes({ notes, onEdit, onDelete }) {
  if (!notes?.length) return null;

  return (
    <ul className="divide-y divide-line">
      {notes.map((note) => {
        const time = formatSetTime(note.savedAt);
        return (
          <li key={note.id} className="flex items-start justify-between gap-2 px-4 py-2">
            <div className="min-w-0">
              <p className="flex flex-wrap items-baseline gap-x-2 text-xs text-muted">
                <span className="font-bold">Notiz</span>
                {time ? <time dateTime={note.savedAt} className="tabular-nums">{time}</time> : null}
              </p>
              {note.comment ? <p className="mt-1 whitespace-pre-wrap break-words text-sm text-ink">{note.comment}</p> : null}
            </div>
            {onEdit && onDelete ? (
              <div className="flex shrink-0 gap-1">
                <button type="button" className="icon-button" aria-label="Notiz ändern" onClick={() => onEdit(note)}>
                  <InterfaceIcon name="pencil" />
                </button>
                <button type="button" className="icon-button" aria-label="Notiz löschen" onClick={() => onDelete(note.id)}>
                  <InterfaceIcon name="trash" />
                </button>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
