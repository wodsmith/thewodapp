/* Minimal SVG icon set, lucide-style. Exports to window.Icon */

function makeIcon(path, { fill = false } = {}) {
  return function ({ className = "w-4 h-4", strokeWidth = 2, ...rest }) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill={fill ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        {...rest}
      >
        {path}
      </svg>
    );
  };
}

const Icon = {
  Trophy: makeIcon(
    <>
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </>,
  ),
  Medal: makeIcon(
    <>
      <path d="M7.21 15 2.66 7.14a2 2 0 0 1 .13-2.2L4.4 2.8A2 2 0 0 1 6 2h12a2 2 0 0 1 1.6.8l1.6 2.14a2 2 0 0 1 .14 2.2L16.79 15" />
      <path d="M11 12 5.12 2.2" />
      <path d="m13 12 5.88-9.8" />
      <path d="M8 7h8" />
      <circle cx="12" cy="17" r="5" />
      <path d="M12 18v-2h-.5" />
    </>,
  ),
  Send: makeIcon(
    <>
      <path d="M22 2L11 13" />
      <path d="M22 2l-7 20-4-9-9-4 20-7z" />
    </>,
  ),
  Check: makeIcon(<path d="M20 6 9 17l-5-5" />),
  X: makeIcon(
    <>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </>,
  ),
  Clock: makeIcon(
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </>,
  ),
  Mail: makeIcon(
    <>
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </>,
  ),
  Users: makeIcon(
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>,
  ),
  Ticket: makeIcon(
    <>
      <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
      <path d="M13 5v2" />
      <path d="M13 17v2" />
      <path d="M13 11v2" />
    </>,
  ),
  Layers: makeIcon(
    <>
      <path d="m12 2 9 5-9 5-9-5 9-5Z" />
      <path d="m3 17 9 5 9-5" />
      <path d="m3 12 9 5 9-5" />
    </>,
  ),
  Sparkles: makeIcon(
    <>
      <path d="m12 3-1.9 4.8a2 2 0 0 1-1.3 1.3L4 11l4.8 1.9a2 2 0 0 1 1.3 1.3L12 19l1.9-4.8a2 2 0 0 1 1.3-1.3L20 11l-4.8-1.9a2 2 0 0 1-1.3-1.3Z" />
      <path d="M19 3v4" />
      <path d="M17 5h4" />
    </>,
  ),
  Chevron: makeIcon(<path d="m6 9 6 6 6-6" />),
  ChevronRight: makeIcon(<path d="m9 6 6 6-6 6" />),
  Home: makeIcon(
    <>
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </>,
  ),
  Settings: makeIcon(
    <>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </>,
  ),
  Calendar: makeIcon(
    <>
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </>,
  ),
  Link: makeIcon(
    <>
      <path d="M9 17H7a5 5 0 0 1 0-10h2" />
      <path d="M15 7h2a5 5 0 1 1 0 10h-2" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </>,
  ),
  Plus: makeIcon(
    <>
      <path d="M12 5v14M5 12h14" />
    </>,
  ),
  AlertTriangle: makeIcon(
    <>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </>,
  ),
  Filter: makeIcon(<path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />),
  Search: makeIcon(
    <>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </>,
  ),
  Eye: makeIcon(
    <>
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </>,
  ),
  Menu: makeIcon(
    <>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </>,
  ),
  Arrow: makeIcon(<path d="M5 12h14M12 5l7 7-7 7" />),
  Dot: makeIcon(<circle cx="12" cy="12" r="3" />, { fill: true }),
  Crown: makeIcon(
    <>
      <path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14" />
    </>,
  ),
  Bolt: makeIcon(<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z" />),
  Refresh: makeIcon(
    <>
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
      <path d="M3 21v-5h5" />
    </>,
  ),
  Copy: makeIcon(
    <>
      <rect width="14" height="14" x="8" y="8" rx="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </>,
  ),
  Pencil: makeIcon(
    <>
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </>,
  ),
  Logo: function ({ className = "w-6 h-6" }) {
    return (
      <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
        <rect x="1" y="1" width="30" height="30" rx="7" fill="hsl(24.6 95% 53.1%)" />
        <path
          d="M9 10 L13 22 L16 14 L19 22 L23 10"
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    );
  },
};

window.Icon = Icon;
