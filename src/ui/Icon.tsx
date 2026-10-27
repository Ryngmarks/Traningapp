import type { SVGProps } from 'react'

// Small, consistent line-icon set (24×24, 1.75 stroke). No icon dependency.
const paths = {
  home: <><path d="M4 11.5 12 5l8 6.5" /><path d="M6 10v9h12v-9" /></>,
  dumbbell: <><path d="M7 12h10" /><path d="M4.5 9v6M19.5 9v6" /><path d="M7.5 7.5v9M16.5 7.5v9" /></>,
  activity: <><path d="M3 12h4l2.5-6 5 12L17 12h4" /></>,
  chart: <><path d="M5 19V11M12 19V5M19 19v-6" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  minus: <><path d="M5 12h14" /></>,
  check: <><path d="m5 12.5 4.5 4.5L19 7.5" /></>,
  x: <><path d="M6 6l12 12M18 6 6 18" /></>,
  chevronRight: <><path d="m9 6 6 6-6 6" /></>,
  chevronLeft: <><path d="m15 6-6 6 6 6" /></>,
  chevronDown: <><path d="m6 9 6 6 6-6" /></>,
  chevronUp: <><path d="m6 15 6-6 6 6" /></>,
  undo: <><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></>,
  more: <><circle cx="5" cy="12" r="1.3" /><circle cx="12" cy="12" r="1.3" /><circle cx="19" cy="12" r="1.3" /></>,
  trash: <><path d="M4.5 7h15M10 11v6M14 11v6" /><path d="M6.5 7l1 12h9l1-12M9.5 7V4.5h5V7" /></>,
  swap: <><path d="M7 7h12l-3-3M17 17H5l3 3" /></>,
  play: <><path d="M8 5.5v13l10-6.5z" /></>,
  clock: <><circle cx="12" cy="12" r="8" /><path d="M12 8v4l2.5 2.5" /></>,
  ball: <><circle cx="12" cy="12" r="8.5" /><path d="m12 7.5 3.5 2.5-1.3 4h-4.4l-1.3-4z" /><path d="M12 3.5v4M15.5 10l4-1.5M14.2 14l2.5 3.5M9.8 14l-2.5 3.5M8.5 10l-4-1.5" /></>,
  walk: <><circle cx="13" cy="4.5" r="1.8" /><path d="m10 21 2-6.5 3 3V21M8 12l2.5-4.5L14 9l2.5 3M12 14.5 10.5 8" /></>,
  run: <><circle cx="15" cy="4.5" r="1.8" /><path d="m6 20 3.5-4 2.5 1.5 1.5-4.5M8 10.5 11.5 7l3.5 3 2.5 2.5H20M13.5 13l3 2.5-1.5 4.5" /></>,
  sparkle: <><path d="M12 4v4M12 16v4M4 12h4M16 12h4M7 7l2 2M15 15l2 2M7 17l2-2M15 9l2-2" /></>,
  trophy: <><path d="M8 4h8v5a4 4 0 0 1-8 0z" /><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M10 20h4M12 13v7" /></>,
  upload: <><path d="M12 15V4M7.5 8.5 12 4l4.5 4.5" /><path d="M5 15v4h14v-4" /></>,
  history: <><path d="M4 12a8 8 0 1 0 2.5-5.8" /><path d="M4 4v4h4M12 8v4l3 2" /></>,
  logout: <><path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" /></>,
  edit: <><path d="M5 19h4L19 9l-4-4L5 15z" /><path d="m13 7 4 4" /></>,
  grip: <><circle cx="9" cy="7" r="1.1" /><circle cx="15" cy="7" r="1.1" /><circle cx="9" cy="12" r="1.1" /><circle cx="15" cy="12" r="1.1" /><circle cx="9" cy="17" r="1.1" /><circle cx="15" cy="17" r="1.1" /></>,
  flame: <><path d="M12 21a6 6 0 0 0 6-6c0-4-3-6-4-10-2 2-3 4-3 6-1-1-1.5-2-1.5-3C7 10 6 12.5 6 15a6 6 0 0 0 6 6z" /></>,
  cloudOff: <><path d="M4 4l16 16" /><path d="M8.5 8.6A5 5 0 0 0 7 18h10.5M19.5 16.5A3.5 3.5 0 0 0 17 11h-.2a5 5 0 0 0-6.2-3.7" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></>,
  info: <><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5M12 8h.01" /></>,
  book: <><path d="M5 5.5A1.5 1.5 0 0 1 6.5 4H19v14H6.5A1.5 1.5 0 0 0 5 19.5z" /><path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3" /></>,
  archive: <><path d="M4 5h16v4H4z" /><path d="M5.5 9v10h13V9M10 13h4" /></>,
} as const

export type IconName = keyof typeof paths

export function Icon({ name, size = 22, strokeWidth = 1.75, ...rest }: { name: IconName; size?: number; strokeWidth?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}
    >
      {paths[name]}
    </svg>
  )
}
