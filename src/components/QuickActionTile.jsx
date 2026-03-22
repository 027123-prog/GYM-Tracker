import { Link } from 'react-router-dom';

export default function QuickActionTile({ title, description, to, variant }) {
  const styles =
    variant === 'solid'
      ? 'bg-ink text-paper hover:bg-pine'
      : 'bg-[linear-gradient(135deg,rgba(242,170,107,0.18),rgba(255,255,255,0.92))] text-ink hover:border-pine';

  return (
    <Link
      to={to}
      className={`panel flex min-h-[190px] flex-col justify-between p-6 transition hover:-translate-y-1 ${styles}`}
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] opacity-70">Schnellstart</p>
        <h3 className="mt-4 font-display text-2xl font-semibold">{title}</h3>
      </div>
      <p className="max-w-sm text-sm opacity-80">{description}</p>
    </Link>
  );
}
