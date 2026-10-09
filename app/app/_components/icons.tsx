// Lijn-iconen (24×24, lijndikte 1.75), zodat er geen icon-pakket bij hoeft.

type Props = { className?: string };
const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};
const icon = (paths: React.ReactNode, extra?: object) =>
  function Icon(p: Props) {
    return (
      <svg {...base} {...extra} {...p}>
        {paths}
      </svg>
    );
  };

export const SunIcon = icon(
  <>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </>
);
export const ListIcon = icon(
  <>
    <path d="M9 6h11M9 12h11M9 18h11" />
    <circle cx="4.5" cy="6" r="1" />
    <circle cx="4.5" cy="12" r="1" />
    <circle cx="4.5" cy="18" r="1" />
  </>
);
export const CalendarIcon = icon(
  <>
    <rect x="3" y="4.5" width="18" height="16.5" rx="2.5" />
    <path d="M3 9.5h18M8 3v3M16 3v3" />
  </>
);
export const NoteIcon = icon(
  <>
    <path d="M14 3H6.5A2.5 2.5 0 0 0 4 5.5v13A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5V9z" />
    <path d="M14 3v6h6M8 13h8M8 17h5" />
  </>
);
export const ChartIcon = icon(<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />);
export const MoonIcon = icon(<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />);
export const SearchIcon = icon(
  <>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </>
);
export const CheckIcon = icon(<path d="M20 6 9 17l-5-5" />, { strokeWidth: 2.5 });
export const SwapIcon = icon(<path d="M16 3l4 4-4 4M20 7H4M8 21l-4-4 4-4M4 17h16" />);
export const MicIcon = icon(
  <>
    <rect x="9" y="2" width="6" height="12" rx="3" />
    <path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4" />
  </>
);
export const PlusIcon = icon(<path d="M12 5v14M5 12h14" />);
export const XIcon = icon(<path d="M18 6 6 18M6 6l12 12" />);
export const ArrowUpIcon = icon(<path d="M12 19V5M5 12l7-7 7 7" />);
export const ArrowRightIcon = icon(<path d="M5 12h14M12 5l7 7-7 7" />);
export const ChevronLeftIcon = icon(<path d="m15 18-6-6 6-6" />);
export const ChevronRightIcon = icon(<path d="m9 18 6-6-6-6" />);
export const TrashIcon = icon(
  <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
);
export const PlayIcon = icon(<path d="M7 4.5v15l12-7.5z" />, { fill: "currentColor", strokeWidth: 1 });
export const PauseIcon = icon(<path d="M8 4v16M16 4v16" />, { strokeWidth: 2.5 });
export const StopIcon = icon(<rect x="5.5" y="5.5" width="13" height="13" rx="2" />);
export const PinIcon = icon(<path d="M12 17v5M9 3h6l-1 6 3 3v2H7v-2l3-3z" />);
export const RepeatIcon = icon(<path d="M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3" />);
export const ClockIcon = icon(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </>
);
export const TargetIcon = icon(
  <>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="1" />
  </>
);
export const SparkIcon = icon(<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" />);
export const MailIcon = icon(
  <>
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="m22 7-10 6L2 7" />
  </>
);
export const GearIcon = icon(
  <>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </>
);
