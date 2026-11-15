import type { ReactNode } from 'react';

/**
 * The app's icons, drawn in the style of SF Symbols (round caps, one weight). The SF Symbols
 * themselves cannot be used on the web (docs/UI.md). The tab icons also have a filled version,
 * used when the tab is selected.
 */
type Drawing = { readonly stroke: ReactNode; readonly filled?: ReactNode };

const SHIELD = 'M12 3l7 3v5.5c0 4.5-3 7.8-7 9.5-4-1.7-7-5-7-9.5V6z';
const HOUSE = 'M4 11l8-7 8 7v8a1 1 0 01-1 1h-4v-6h-6v6H5a1 1 0 01-1-1z';
const DUMBBELL = 'M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11';

const DRAWINGS = {
  plus: { stroke: <path d="M12 5v14M5 12h14" /> },
  minus: { stroke: <path d="M5 12h14" /> },
  xmark: { stroke: <path d="M6 6l12 12M18 6L6 18" /> },
  checkmark: { stroke: <path d="M5 12.5l4.5 4.5L19 7" /> },
  'chevron-right': { stroke: <path d="M9 5l7 7-7 7" /> },
  'chevron-left': { stroke: <path d="M15 5l-7 7 7 7" /> },
  'chevron-down': { stroke: <path d="M5 9l7 7 7-7" /> },
  search: {
    stroke: (
      <>
        <circle cx="10.5" cy="10.5" r="6" />
        <path d="M15 15l5 5" />
      </>
    ),
  },
  settings: {
    stroke: (
      <>
        <path d="M4 8h8M18 8h2M4 16h2M12 16h8" />
        <circle cx="15" cy="8" r="2.5" />
        <circle cx="9" cy="16" r="2.5" />
      </>
    ),
  },
  ellipsis: {
    stroke: (
      <>
        <circle cx="6" cy="12" r="1.2" />
        <circle cx="12" cy="12" r="1.2" />
        <circle cx="18" cy="12" r="1.2" />
      </>
    ),
  },
  sidebar: {
    stroke: (
      <>
        <rect x="3" y="4.5" width="18" height="15" rx="3.5" />
        <path d="M9.5 4.5v15M5.5 8.5h1.5M5.5 11.5h1.5" />
      </>
    ),
  },
  trash: { stroke: <path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13" /> },
  shield: { stroke: <path d={SHIELD} />, filled: <path d={SHIELD} fill="currentColor" /> },
  today: { stroke: <path d={HOUSE} />, filled: <path d={HOUSE} fill="currentColor" /> },
  calendar: {
    stroke: (
      <>
        <rect x="4" y="5" width="16" height="15" rx="3" />
        <path d="M4 10h16M8 3v4M16 3v4" />
      </>
    ),
    filled: (
      <>
        <rect x="4" y="5" width="16" height="15" rx="3" fill="currentColor" />
        <path d="M8 3v4M16 3v4" />
      </>
    ),
  },
  students: {
    stroke: (
      <>
        <circle cx="9" cy="8" r="3.5" />
        <path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6" />
        <circle cx="17" cy="9" r="2.5" />
        <path d="M16 14.2c3 .3 5 2.4 5 5.3" />
      </>
    ),
    filled: (
      <>
        <circle cx="9" cy="8" r="3.5" fill="currentColor" />
        <path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6z" fill="currentColor" />
        <circle cx="17" cy="9" r="2.5" fill="currentColor" />
        <path d="M16 14.2c3 .3 5 2.4 5 5.3" />
      </>
    ),
  },
  exercises: { stroke: <path d={DUMBBELL} />, filled: <path d={DUMBBELL} strokeWidth="3.5" /> },
} satisfies Record<string, Drawing>;

export type IconName = keyof typeof DRAWINGS;

type IconProps = {
  name: IconName;
  /** The filled version, for a selected tab. Icons without one stay in outline. */
  filled?: boolean;
  /** Set it when the icon stands alone. With text beside it, leave it out: the icon is hidden from screen readers. */
  label?: string;
};

export function Icon({ name, filled = false, label }: IconProps) {
  const drawing: Drawing = DRAWINGS[name];
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {filled && drawing.filled ? drawing.filled : drawing.stroke}
    </svg>
  );
}
