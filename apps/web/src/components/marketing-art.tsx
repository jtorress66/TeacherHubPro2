// Small line drawings for the public site, in the app's colours. Decorative only: every card keeps
// its text, so the drawings are hidden from screen readers.

const paths = {
  lesson_planner:
    'M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM9 8h6M9 12h6M9 16h3',
  ai_assistant:
    'M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z',
  presentations: 'M3 4h18M4 4v11h16V4M12 15v5M8 20h8M8 9l3 2-3 2z',
  gradebook: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5zM9 8h7M9 12h5',
  attendance: 'M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9',
  assignments: 'M9 5h10M9 12h10M9 19h10M4 5l1 1 2-2M4 12l1 1 2-2M4 19l1 1 2-2',
  games:
    'M6 12h4M8 10v4M15 13h.01M18 11h.01M17.3 5H6.7a4 4 0 0 0-4 3.6L2 15a3 3 0 0 0 5.2 2.1L9 15h6l1.8 2.1A3 3 0 0 0 22 15l-.7-6.4A4 4 0 0 0 17.3 5z',
  learning: 'M3 19l9-14 9 14M7 13h10M12 5v14',
  families:
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  command_center: 'M3 13h8V3H3zM13 21h8V11h-8zM3 21h8v-6H3zM13 3v6h8V3z',
  prep_agent:
    'M9 11l2 2 4-4M8 3h8v3H8zM6 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-1',
  schools: 'M3 21h18M5 21V9l7-5 7 5v12M9 21v-6h6v6M10 10h4',
  shield: 'M12 2l8 3v6c0 5-3.5 9.7-8 11-4.5-1.3-8-6-8-11V5z M9 12l2 2 4-4',
  lock: 'M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4',
  link: 'M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1',
  check: 'M20 6L9 17l-5-5',
} as const;

export type ArtName = keyof typeof paths;

/** A line drawing in a soft rounded tile. */
export function MarketingArt({ name }: { readonly name: ArtName }) {
  return (
    <span className="m-art" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="28" height="28" focusable="false">
        <path d={paths[name]} />
      </svg>
    </span>
  );
}
