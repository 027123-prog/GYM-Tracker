export const compactIconButtonClass = 'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-sm text-muted transition hover:bg-surface-raised hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber';

export default function InterfaceIcon({ name }) {
  const paths = {
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4m10-4v4M3 10h18M7 14h3m3 3h3" /></>,
    dumbbell: <><rect x="4" y="6" width="4" height="12" rx="1" /><rect x="16" y="6" width="4" height="12" rx="1" /><path d="M8 12h8M2 10v4m20-4v4" /></>,
    filter: <path d="M3 4h18l-7 8v7l-4 2v-9Z" />,
    sort: <path d="M8 4v16m-4-4 4 4 4-4M14 4h7M14 8h5M14 12h3" />,
    reorder: <path d="M3 7h17m-4-4 4 4-4 4M21 17H4m4-4-4 4 4 4" />,
    list: <path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" />,
    body: <><circle cx="12" cy="4" r="2" /><path d="m4 8 5 2v4l-2 7M20 8l-5 2v4l2 7M9 8h6M9 14h6" /></>,
    preview: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="m6 16 4-5 4 2 4-6" /></>,
    volume: <><rect x="4" y="4" width="16" height="4" rx="1" /><rect x="4" y="10" width="16" height="4" rx="1" /><rect x="4" y="16" width="16" height="4" rx="1" /></>,
    max: <><path d="M4 20h16M5 17l5-6 4 3 4-7" /><circle cx="19" cy="5" r="2" /></>,
    chart: <path d="M4 4v16h16M8 15l4-5 3 2 5-6" />,
    pencil: <path d="m15 4 5 5M4 20l5-1L20 8a2.1 2.1 0 0 0-5-5L4 14Z" />,
    trash: <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" />,
    restore: <path d="M3 4v6h6M4 10a8 8 0 1 1 0 6" />,
    settings: <><path d="m9 3-.6 2.5-2 .9-2.2-.8L2 9.4l1.9 1.7v1.8L2 14.6l2.2 3.8 2.3-.8 1.9.9L9 21h6l.6-2.5 1.9-.9 2.3.8 2.2-3.8-1.9-1.7v-1.8L22 9.4l-2.2-3.8-2.2.8-2-.9L15 3Z" /><circle cx="12" cy="12" r="3" /></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}
