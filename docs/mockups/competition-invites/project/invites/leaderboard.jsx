/* Leaderboard with invite status — matches WODsmith's public leaderboard shape:
   rank+points stacked, athlete+affiliate stacked, sortable headers,
   event columns with score + rank/points beneath, muted italic em-dash for missing.
   Overlay: left-accent bar + row tint + status pill column at the end. */

const STATUS_META = {
  accepted_paid: {
    label: "Ticket purchased",
    short: "Paid",
    rowClass: "row-accent-ticket",
    pillClass: "bg-[hsl(var(--ticket)/0.12)] text-[hsl(var(--ticket))]",
    iconKey: "Ticket",
  },
  accepted: {
    label: "Accepted",
    short: "Accepted",
    rowClass: "row-accent-accepted",
    pillClass: "bg-[hsl(var(--accept-bg))] text-[hsl(var(--accept))]",
    iconKey: "Check",
  },
  pending: {
    label: "Awaiting response",
    short: "Pending",
    rowClass: "row-accent-pending",
    pillClass: "bg-[hsl(var(--pending-bg))] text-[hsl(35_95%_38%)]",
    iconKey: "Clock",
  },
  declined: {
    label: "Declined",
    short: "Declined",
    rowClass: "row-accent-declined",
    pillClass: "bg-[hsl(var(--declined-bg))] text-[hsl(var(--declined))]",
    iconKey: "X",
  },
  expired: {
    label: "Expired · no response",
    short: "Expired",
    rowClass: "row-accent-expired",
    pillClass: "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]",
    iconKey: "Clock",
  },
  not_invited: {
    label: "Not yet invited",
    short: "Not invited",
    rowClass: "row-accent-none",
    pillClass:
      "bg-transparent text-[hsl(var(--muted-foreground))] border border-dashed border-[hsl(var(--border))]",
    iconKey: "Dot",
  },
};

const SOURCE_META = {
  "series-denver": { label: "Denver", color: "#be5a3f" },
  "series-boise": { label: "Boise", color: "#3f8abe" },
  "series-slc": { label: "SLC", color: "#a16bd9" },
  "series-global": { label: "Series GLB", color: "#737373" },
  online: { label: "Online Qual.", color: "#0c7f5b" },
};

// Simulated event results per athlete (for the leaderboard table — matches public leaderboard shape)
const EVENTS = [
  { id: "e1", name: "Event 1 — Sprint", scheme: "time" },
  { id: "e2", name: "Event 2 — Max Clean", scheme: "weight" },
  { id: "e3", name: "Event 3 — Chipper", scheme: "time" },
];

// Deterministic fake event results based on athlete rank
function eventResultsFor(a) {
  const seedOffset = (a.rank * 37) % 11;
  return [
    {
      id: "e1",
      score: `${3 + Math.floor(seedOffset / 3)}:${String((seedOffset * 7) % 60).padStart(2, "0")}`,
      rank: ((a.rank + 2) % 20) + 1,
      points: 100 - a.rank * 2 + seedOffset,
    },
    {
      id: "e2",
      score: `${270 + ((a.rank * 3) % 60)} lb`,
      rank: ((a.rank + 5) % 20) + 1,
      points: 95 - a.rank * 2 + (seedOffset % 5),
    },
    {
      id: "e3",
      score: `${9 + Math.floor(seedOffset / 4)}:${String((seedOffset * 11) % 60).padStart(2, "0")}`,
      rank: ((a.rank + 1) % 20) + 1,
      points: 105 - a.rank * 2 + seedOffset,
    },
  ];
}

function StatusPill({ status, variant }) {
  const { Icon } = window;
  const meta = STATUS_META[status];
  const Ico = Icon[meta.iconKey] || Icon.Dot;
  const cls = variant === "bold" ? "pill sq" : "pill";
  return (
    <span className={cls + " " + meta.pillClass}>
      <Ico className="w-3 h-3" />
      {meta.short}
    </span>
  );
}

function SourceTag({ sourceKey, variant }) {
  const meta = SOURCE_META[sourceKey] || { label: sourceKey, color: "#888" };
  return (
    <span
      className={
        "inline-flex items-center gap-1.5 text-[10px] " +
        (variant === "bold" ? "font-mono" : "")
      }
      style={{ color: meta.color }}
    >
      <span className="w-1.5 h-1.5 rounded-sm" style={{ background: meta.color }} />
      {meta.label}
    </span>
  );
}

function AthleteAvatar({ athlete, size = 26 }) {
  let hash = 0;
  for (let i = 0; i < athlete.name.length; i++)
    hash = athlete.name.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return (
    <div
      className="rounded-full grid place-items-center font-semibold shrink-0"
      style={{
        width: size,
        height: size,
        background: `hsl(${hue} 45% 92%)`,
        color: `hsl(${hue} 55% 28%)`,
        fontSize: size * 0.38,
      }}
    >
      {athlete.avatar}
    </div>
  );
}

// WODsmith RankCell: Trophy (1), Medal (2,3), then bold rank + points underneath
function RankCell({ rank, points }) {
  const { Icon } = window;
  const icon =
    rank === 1 ? (
      <Icon.Trophy className="h-3.5 w-3.5 text-[hsl(42_90%_48%)]" />
    ) : rank === 2 ? (
      <Icon.Medal className="h-3.5 w-3.5 text-[hsl(0_0%_62%)]" />
    ) : rank === 3 ? (
      <Icon.Medal className="h-3.5 w-3.5 text-[hsl(28_70%_45%)]" />
    ) : null;
  const isPodium = rank <= 3;
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1.5">
        {icon}
        <span className={"tabular-nums " + (isPodium ? "font-bold text-[14px]" : "font-semibold text-[13px]")}>
          {rank}
        </span>
      </div>
      {points !== undefined && (
        <span className="text-[10.5px] text-[hsl(var(--muted-foreground))] tabular-nums">
          {points} pts
        </span>
      )}
    </div>
  );
}

// WODsmith EventResultCell: score on top (medium), #rank · +points beneath
function EventResultCell({ result }) {
  if (!result || result.rank === 0) {
    return <span className="text-[hsl(var(--muted-foreground))] italic">—</span>;
  }
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-medium tabular-nums text-[12.5px]">{result.score}</span>
      <span className="text-[10.5px] text-[hsl(var(--muted-foreground))] tabular-nums">
        <span className="font-medium">#{result.rank}</span>
        <span className="mx-1">·</span>
        <span>+{result.points}</span>
      </span>
    </div>
  );
}

function SortableHeader({ children, sorted, onClick }) {
  const { Icon } = window;
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
    >
      {children}
      <Icon.Chevron
        className={
          "w-3 h-3 transition-colors " +
          (sorted ? "text-[hsl(var(--foreground))]" : "text-[hsl(var(--muted-foreground)/0.5)]")
        }
      />
    </button>
  );
}

function FilterChips({ filter, setFilter, stats }) {
  const items = [
    { id: "all", label: "All", count: stats.all },
    { id: "pending", label: "Awaiting response", count: stats.pending },
    { id: "declined", label: "Declined", count: stats.declined },
    { id: "expired", label: "Expired", count: stats.expired },
    { id: "not_invited", label: "Not invited", count: stats.not_invited },
    { id: "accepted", label: "Accepted", count: stats.accepted },
  ];
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {items.map((it) => (
        <button
          key={it.id}
          onClick={() => setFilter(it.id)}
          className={
            "flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border " +
            (filter === it.id
              ? "border-[hsl(var(--foreground))] bg-[hsl(var(--foreground))] text-white"
              : "border-[hsl(var(--border))] bg-white text-[hsl(var(--foreground)/0.7)] hover:border-[hsl(var(--foreground)/0.3)]")
          }
        >
          <span>{it.label}</span>
          <span
            className={
              "tabular-nums " +
              (filter === it.id ? "text-white/70" : "text-[hsl(var(--muted-foreground))]")
            }
          >
            {it.count}
          </span>
        </button>
      ))}
    </div>
  );
}

function Leaderboard({
  athletes,
  selected,
  onToggle,
  onToggleAll,
  filter,
  setFilter,
  variant,
  totalSpots,
}) {
  const { Icon } = window;

  const filtered = athletes.filter((a) => {
    if (filter === "all") return true;
    if (filter === "accepted") return a.status === "accepted" || a.status === "accepted_paid";
    return a.status === filter;
  });

  const filterCounts = {
    all: athletes.length,
    pending: athletes.filter((a) => a.status === "pending").length,
    declined: athletes.filter((a) => a.status === "declined").length,
    expired: athletes.filter((a) => a.status === "expired").length,
    not_invited: athletes.filter((a) => a.status === "not_invited").length,
    accepted: athletes.filter((a) => a.status === "accepted" || a.status === "accepted_paid").length,
  };

  const allFilteredSelected = filtered.length > 0 && filtered.every((a) => selected.has(a.rank));
  const someFilteredSelected = filtered.some((a) => selected.has(a.rank));

  return (
    <div className="flex flex-col min-h-0 flex-1">
      {/* Filter bar */}
      <div className="px-5 pt-4 pb-3 flex items-center justify-between gap-4 border-b border-[hsl(var(--border))] bg-white">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Icon.Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
            <input
              placeholder="Search athletes or affiliate…"
              className="h-8 text-[12px] pl-7 pr-2.5 w-56 rounded-md border border-[hsl(var(--border))] bg-white"
            />
          </div>
          <button className="h-8 px-2.5 text-[12px] rounded-md border border-[hsl(var(--border))] bg-white flex items-center gap-1.5 text-[hsl(var(--foreground)/0.8)]">
            <Icon.Filter className="w-3.5 h-3.5" />
            Division: RX Men
            <Icon.Chevron className="w-3 h-3" />
          </button>
          <button className="h-8 px-2.5 text-[12px] rounded-md border border-[hsl(var(--border))] bg-white flex items-center gap-1.5 text-[hsl(var(--foreground)/0.8)]">
            View: Overall
            <Icon.Chevron className="w-3 h-3" />
          </button>
        </div>
        <div className="text-[11px] text-[hsl(var(--muted-foreground))] tabular-nums">
          {filtered.length} of {athletes.length} athletes
        </div>
      </div>
      <div className="px-5 py-2.5 border-b border-[hsl(var(--border))] bg-[hsl(0_0%_98.5%)]">
        <FilterChips filter={filter} setFilter={setFilter} stats={filterCounts} />
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto thin-scroll">
        <table className="w-full text-[13px] border-collapse">
          <thead className="sticky top-0 bg-[hsl(0_0%_99%)] z-10">
            <tr className="border-b border-[hsl(var(--border))]">
              <th className="w-9 pl-5 py-2.5 text-left align-bottom">
                <input
                  type="checkbox"
                  className="checkbox"
                  checked={allFilteredSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someFilteredSelected && !allFilteredSelected;
                  }}
                  onChange={() => onToggleAll(filtered)}
                />
              </th>
              <th className="w-16 py-2.5 text-left align-bottom">
                <SortableHeader sorted>Rank</SortableHeader>
              </th>
              <th className="py-2.5 text-left align-bottom min-w-[200px]">
                <SortableHeader>Athlete</SortableHeader>
              </th>
              <th className="py-2.5 text-left align-bottom w-[150px]">
                <SortableHeader>Qualified via</SortableHeader>
              </th>
              {EVENTS.map((e) => (
                <th key={e.id} className="py-2.5 text-left align-bottom w-[108px]">
                  <SortableHeader>{e.name}</SortableHeader>
                </th>
              ))}
              <th className="py-2.5 text-left align-bottom w-[130px]">Invite status</th>
              <th className="py-2.5 text-left align-bottom w-[70px]">Round</th>
              <th className="w-8 pr-5"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => {
              const meta = STATUS_META[a.status];
              const isSelected = selected.has(a.rank);
              const isCutoff = a.rank === totalSpots + 1 && filter === "all";
              const results = eventResultsFor(a);
              const totalPts = results.reduce((s, r) => s + r.points, 0);
              return (
                <React.Fragment key={a.rank}>
                  {isCutoff && (
                    <tr>
                      <td colSpan={9 + EVENTS.length} className="px-5 py-0">
                        <div className="flex items-center gap-3 py-2">
                          <div className="flex-1 h-px bg-[hsl(var(--primary)/0.25)] border-t border-dashed" />
                          <div className="text-[10px] tracking-wider uppercase text-[hsl(var(--primary))] font-semibold px-2 py-0.5 rounded-full bg-[hsl(var(--primary)/0.08)] border border-[hsl(var(--primary)/0.2)] flex items-center gap-1.5">
                            <Icon.Arrow className="w-3 h-3" />
                            Cutoff · {totalSpots} spots
                          </div>
                          <div className="flex-1 h-px bg-[hsl(var(--primary)/0.25)] border-t border-dashed" />
                        </div>
                      </td>
                    </tr>
                  )}
                  <tr
                    onClick={() => onToggle(a.rank)}
                    className={
                      "group cursor-pointer transition-colors border-b border-[hsl(var(--border))] " +
                      (isSelected ? "row-selected " : meta.rowClass + " ") +
                      "hover:brightness-[0.99]"
                    }
                  >
                    <td className="pl-5 py-2.5 align-top">
                      <input
                        type="checkbox"
                        className="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          e.stopPropagation();
                          onToggle(a.rank);
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                    <td className="py-2.5 align-top">
                      <RankCell rank={a.rank} points={totalPts} />
                    </td>
                    <td className="py-2.5 align-top">
                      <div className="flex items-center gap-2.5">
                        <AthleteAvatar athlete={a} />
                        <div className="min-w-0">
                          <div className="font-medium text-[13px] leading-tight truncate">
                            {a.name}
                          </div>
                          <div className="text-[10.5px] text-[hsl(var(--muted-foreground))] leading-tight truncate mt-0.5">
                            {a.affiliate}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 align-top">
                      <div className="flex flex-col gap-0.5">
                        <SourceTag sourceKey={a.source} variant={variant} />
                        <span className="text-[10.5px] text-[hsl(var(--muted-foreground))] truncate">
                          {a.sourceDetail}
                        </span>
                      </div>
                    </td>
                    {results.map((r) => (
                      <td key={r.id} className="py-2.5 align-top">
                        <EventResultCell result={r} />
                      </td>
                    ))}
                    <td className="py-2.5 align-top">
                      <StatusPill status={a.status} variant={variant} />
                      {a.sentAt && (
                        <div className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1">
                          Sent {a.sentAt}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 align-top">
                      {a.round ? (
                        <span
                          className={
                            "round-chip inline-flex items-center gap-1 text-[10.5px] font-medium px-1.5 py-0.5 rounded " +
                            (variant === "bold"
                              ? "bg-[hsl(var(--foreground))] text-white"
                              : "bg-[hsl(var(--muted))] text-[hsl(var(--foreground)/0.75)]")
                          }
                        >
                          R{a.round}
                        </span>
                      ) : (
                        <span className="text-[11px] text-[hsl(var(--muted-foreground))]">—</span>
                      )}
                    </td>
                    <td className="pr-5 py-2.5 text-right align-top">
                      <button
                        className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded hover:bg-[hsl(var(--muted))] grid place-items-center text-[hsl(var(--muted-foreground))]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Icon.ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

Object.assign(window, {
  Leaderboard,
  STATUS_META,
  SOURCE_META,
  StatusPill,
  SourceTag,
  AthleteAvatar,
  EVENTS,
  eventResultsFor,
  RankCell,
  EventResultCell,
});
