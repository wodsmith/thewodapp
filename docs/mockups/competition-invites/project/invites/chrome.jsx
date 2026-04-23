/* Dashboard chrome: sidebar + topbar + page header, matching WODsmith organizer layout. */

const navGroups = [
  {
    label: "Overview",
    items: [
      { label: "Dashboard", icon: "Home" },
    ],
  },
  {
    label: "Build",
    items: [
      { label: "Events", icon: "Layers" },
      { label: "Divisions", icon: "Users" },
      { label: "Schedule", icon: "Calendar" },
      { label: "Scoring", icon: "Trophy" },
    ],
  },
  {
    label: "Athletes",
    items: [
      { label: "Registered", icon: "Users" },
      { label: "Invites", icon: "Send", active: true, badge: "3 pending" },
      { label: "Volunteers", icon: "Sparkles" },
    ],
  },
  {
    label: "Finance",
    items: [
      { label: "Pricing", icon: "Ticket" },
      { label: "Coupons", icon: "Copy" },
      { label: "Revenue", icon: "Ticket" },
    ],
  },
  {
    label: "Broadcast",
    items: [
      { label: "Announcements", icon: "Mail" },
      { label: "Sponsors", icon: "Sparkles" },
    ],
  },
];

function Sidebar({ variant }) {
  const { Icon } = window;
  return (
    <aside className="w-60 shrink-0 border-r border-[hsl(var(--border))] bg-[hsl(0_0%_98%)] flex flex-col">
      <div className="h-14 flex items-center gap-2.5 px-4 border-b border-[hsl(var(--border))]">
        <Icon.Logo className="w-7 h-7" />
        <div className="flex flex-col leading-tight">
          <span className="text-[13px] font-semibold">WODsmith</span>
          <span className="text-[10.5px] text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
            Organizer
          </span>
        </div>
      </div>

      {/* Competition switcher */}
      <div className="px-3 pt-3 pb-2">
        <button className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md border border-[hsl(var(--border))] hover:bg-white text-left group">
          <div className="w-7 h-7 rounded-md bg-[hsl(var(--primary))] text-white grid place-items-center shrink-0">
            <Icon.Trophy className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-medium truncate">MWFC Finals 2026</div>
            <div className="text-[10px] text-[hsl(var(--muted-foreground))] truncate">
              Championship · Aug 14–16
            </div>
          </div>
          <Icon.Chevron className="w-3.5 h-3.5 text-[hsl(var(--muted-foreground))]" />
        </button>
      </div>

      <nav className="px-2 flex-1 overflow-y-auto thin-scroll pb-4">
        {navGroups.map((group) => (
          <div key={group.label} className="mt-3">
            <div className="px-2 pb-1 text-[10px] font-medium tracking-wider uppercase text-[hsl(var(--muted-foreground))]">
              {group.label}
            </div>
            {group.items.map((item) => {
              const Ico = Icon[item.icon] || Icon.Dot;
              return (
                <a
                  key={item.label}
                  href="#"
                  onClick={(e) => e.preventDefault()}
                  className={
                    "flex items-center gap-2.5 px-2 py-1.5 rounded-md text-[13px] " +
                    (item.active
                      ? "bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))] font-semibold"
                      : "text-[hsl(var(--foreground)/0.78)] hover:bg-[hsl(var(--muted))]")
                  }
                >
                  <Ico className="w-4 h-4 shrink-0" />
                  <span className="truncate flex-1">{item.label}</span>
                  {item.badge && (
                    <span
                      className={
                        "text-[10px] font-medium px-1.5 py-0.5 rounded-full " +
                        (item.active
                          ? "bg-[hsl(var(--primary))] text-white"
                          : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]")
                      }
                    >
                      {item.badge}
                    </span>
                  )}
                </a>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="border-t border-[hsl(var(--border))] p-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-[hsl(var(--foreground))] text-white grid place-items-center text-[11px] font-semibold">
            JT
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="text-[12px] font-medium truncate">Jordan Tessmer</div>
            <div className="text-[10px] text-[hsl(var(--muted-foreground))] truncate">
              Canvas CrossFit
            </div>
          </div>
          <Icon.Settings className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
        </div>
      </div>
    </aside>
  );
}

function Breadcrumbs() {
  const { Icon } = window;
  const parts = ["Organizer", "MWFC Finals 2026", "Invites"];
  return (
    <div className="flex items-center gap-1.5 text-[12px] text-[hsl(var(--muted-foreground))]">
      {parts.map((p, i) => (
        <React.Fragment key={p}>
          <span className={i === parts.length - 1 ? "text-[hsl(var(--foreground))] font-medium" : ""}>
            {p}
          </span>
          {i < parts.length - 1 && <Icon.ChevronRight className="w-3 h-3" />}
        </React.Fragment>
      ))}
    </div>
  );
}

function PageHeader({ variant, stats }) {
  const { Icon, CHAMPIONSHIP, CURRENT_DIVISION_LABEL } = window;

  if (variant === "bold") {
    return (
      <div className="border-b border-[hsl(var(--border))] bg-[hsl(0_0%_99.5%)]">
        <div className="dot-grid">
          <div className="px-8 pt-5 pb-1">
            <Breadcrumbs />
          </div>
          <div className="px-8 pb-6 flex items-end justify-between gap-8">
            <div>
              <div className="section-label text-[hsl(var(--muted-foreground))] mb-2">
                Competition Invitations · {CURRENT_DIVISION_LABEL}
              </div>
              <h1 className="page-title text-[44px] leading-[1.05]">
                Fill the floor.
              </h1>
              <p className="mt-2 max-w-xl text-[13px] text-[hsl(var(--muted-foreground))]">
                Qualify athletes from the series and online qualifier. Send rounds
                of invitations, re-invite the ones who didn't respond, and watch
                the roster settle in real time.
              </p>
            </div>
            <div className="flex items-stretch gap-3">
              <BigStat
                value={stats.paid}
                total={CHAMPIONSHIP.divisions[0].spots}
                label="Tickets sold"
                accent="primary"
                variant={variant}
              />
              <BigStat
                value={stats.accepted - stats.paid}
                label="Accepted · awaiting payment"
                accent="emerald"
                variant={variant}
              />
              <BigStat
                value={stats.pending}
                label="Awaiting response"
                accent="amber"
                pulse
                variant={variant}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-[hsl(var(--border))] bg-white">
      <div className="px-8 pt-4 pb-2">
        <Breadcrumbs />
      </div>
      <div className="px-8 pb-5 flex items-end justify-between gap-6">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight">Invites</h1>
          <p className="mt-1 text-[13px] text-[hsl(var(--muted-foreground))]">
            Invite athletes from qualifying competitions and send them in rounds.
          </p>
        </div>
        <div className="flex items-stretch gap-3">
          <BigStat value={stats.paid} total={CHAMPIONSHIP.divisions[0].spots} label="Tickets sold" accent="primary" variant={variant} />
          <BigStat value={stats.accepted - stats.paid} label="Accepted" accent="emerald" variant={variant} />
          <BigStat value={stats.pending} label="Pending" accent="amber" variant={variant} />
        </div>
      </div>
    </div>
  );
}

function BigStat({ value, total, label, accent, pulse, variant }) {
  const accentClass =
    accent === "primary"
      ? "bg-[hsl(var(--primary))] text-white"
      : accent === "emerald"
        ? "bg-[hsl(var(--accept))] text-white"
        : accent === "amber"
          ? "bg-[hsl(var(--pending))] text-white"
          : "bg-[hsl(var(--foreground))] text-white";

  if (variant === "bold") {
    return (
      <div className={"card-chrome big-stat px-4 py-3 min-w-[148px] relative"}>
        <div className="flex items-baseline gap-1.5">
          <span className="display-number text-[32px] leading-none">{value}</span>
          {total != null && (
            <span className="text-[13px] text-white/50 font-medium">/ {total}</span>
          )}
        </div>
        <div className="section-label text-white/60 mt-1">{label}</div>
        {pulse && (
          <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-[hsl(var(--pending))] pulse-dot" />
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-[hsl(var(--border))] bg-white px-3.5 py-2.5 min-w-[130px]">
      <div className={"w-1 h-10 rounded-full " + accentClass} />
      <div>
        <div className="flex items-baseline gap-1">
          <span className="text-[22px] font-semibold tabular-nums leading-none">{value}</span>
          {total != null && (
            <span className="text-[12px] text-[hsl(var(--muted-foreground))] font-medium">/ {total}</span>
          )}
        </div>
        <div className="text-[10.5px] uppercase tracking-wide text-[hsl(var(--muted-foreground))] mt-1 font-medium">
          {label}
        </div>
      </div>
    </div>
  );
}

function Tabs({ active, onChange, variant }) {
  const tabs = [
    { id: "roster", label: "Roster & Rounds", badge: null },
    { id: "sources", label: "Qualification Sources", badge: "2" },
    { id: "rounds", label: "Round History", badge: "2" },
    { id: "email", label: "Email Templates" },
    { id: "series", label: "Series Global Leaderboard" },
  ];
  return (
    <div className="px-8 border-b border-[hsl(var(--border))] bg-white flex items-center gap-1 overflow-x-auto thin-scroll">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={
            "relative px-3 py-3 text-[13px] whitespace-nowrap transition-colors " +
            (active === t.id
              ? "text-[hsl(var(--foreground))] font-medium"
              : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]")
          }
        >
          <span>{t.label}</span>
          {t.badge && (
            <span className="ml-1.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]">
              {t.badge}
            </span>
          )}
          {active === t.id && (
            <span
              className={
                "absolute left-2 right-2 -bottom-px h-[2px] " +
                (variant === "bold"
                  ? "bg-[hsl(var(--foreground))]"
                  : "bg-[hsl(var(--primary))]")
              }
            />
          )}
        </button>
      ))}
    </div>
  );
}

Object.assign(window, { Sidebar, PageHeader, Tabs });
