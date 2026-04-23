/* Round history timeline — stacked cards for previous rounds. */

function StatTick({ label, value, tone, variant }) {
  const toneClass = {
    accept: "text-[hsl(var(--accept))]",
    pending: "text-[hsl(35_95%_38%)]",
    declined: "text-[hsl(var(--declined))]",
    muted: "text-[hsl(var(--muted-foreground))]",
    ticket: "text-[hsl(var(--ticket))]",
  }[tone];
  return (
    <div className="flex flex-col">
      <span className={"text-[18px] font-semibold tabular-nums leading-none " + toneClass}>
        {value}
      </span>
      <span className="text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))] mt-1 font-medium">
        {label}
      </span>
    </div>
  );
}

function RoundsTimeline({ rounds, variant }) {
  const { Icon } = window;
  return (
    <div className="p-8 max-w-[960px] mx-auto w-full">
      <div className="flex items-end justify-between mb-5">
        <div>
          <div className="section-label mb-1">Round History</div>
          <h2
            className={
              variant === "bold"
                ? "page-title text-[32px]"
                : "text-[22px] font-semibold tracking-tight"
            }
          >
            Two rounds sent. One in flight.
          </h2>
        </div>
      </div>

      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-[22px] top-3 bottom-3 w-px bg-[hsl(var(--border))]" />

        {rounds.map((r, i) => (
          <div key={r.id} className="relative pl-14 pb-5 last:pb-0">
            <div
              className={
                "absolute left-[14px] top-5 w-[18px] h-[18px] rounded-full grid place-items-center border-4 border-[hsl(var(--background))] " +
                (r.tone === "guaranteed"
                  ? "bg-[hsl(var(--accept))]"
                  : "bg-[hsl(var(--primary))]")
              }
            >
              <span className="text-white font-mono text-[9px] font-bold">{r.number}</span>
            </div>

            <div className="card-chrome p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span
                      className={
                        "round-chip text-[10px] font-semibold px-1.5 py-0.5 rounded " +
                        (r.tone === "guaranteed"
                          ? "bg-[hsl(var(--accept-bg))] text-[hsl(var(--accept))]"
                          : "bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))]")
                      }
                    >
                      {r.tone === "guaranteed" ? "GUARANTEED" : "OPENED"}
                    </span>
                    <span className="text-[11px] text-[hsl(var(--muted-foreground))]">
                      · Deadline {r.rsvpDeadline}
                    </span>
                  </div>
                  <h3 className="text-[16px] font-semibold">{r.label}</h3>
                  <div className="text-[12px] text-[hsl(var(--muted-foreground))] mt-0.5 truncate">
                    Subject: <span className="text-[hsl(var(--foreground)/0.8)]">{r.subject}</span>
                  </div>
                  <div className="text-[11px] text-[hsl(var(--muted-foreground))] mt-2 flex items-center gap-3 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Icon.Send className="w-3 h-3" />
                      {r.sentAt}
                    </span>
                    <span className="flex items-center gap-1">
                      <Icon.Users className="w-3 h-3" />
                      by {r.sentBy}
                    </span>
                    <span className="flex items-center gap-1">
                      <Icon.Mail className="w-3 h-3" />
                      {r.recipients} recipients
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button className="h-7 px-2.5 text-[11.5px] rounded-md border border-[hsl(var(--border))] bg-white hover:bg-[hsl(var(--muted))] flex items-center gap-1.5">
                    <Icon.Eye className="w-3 h-3" />
                    View email
                  </button>
                  <button className="h-7 px-2.5 text-[11.5px] rounded-md border border-[hsl(var(--border))] bg-white hover:bg-[hsl(var(--muted))]">
                    Export CSV
                  </button>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-4">
                <div className="flex items-center h-2 rounded-full overflow-hidden bg-[hsl(var(--muted))]">
                  <div
                    className="h-full bg-[hsl(var(--ticket))]"
                    style={{ width: `${(r.paid / r.recipients) * 100}%` }}
                  />
                  <div
                    className="h-full bg-[hsl(var(--accept))]"
                    style={{ width: `${((r.accepted - r.paid) / r.recipients) * 100}%` }}
                  />
                  <div
                    className="h-full bg-[hsl(var(--pending))]"
                    style={{ width: `${(r.pending / r.recipients) * 100}%` }}
                  />
                  <div
                    className="h-full bg-[hsl(var(--declined))]"
                    style={{ width: `${(r.declined / r.recipients) * 100}%` }}
                  />
                  <div
                    className="h-full bg-[hsl(var(--muted-foreground)/0.5)]"
                    style={{ width: `${(r.expired / r.recipients) * 100}%` }}
                  />
                </div>
                <div className="mt-4 grid grid-cols-5 gap-3">
                  <StatTick label="Purchased" value={r.paid} tone="ticket" />
                  <StatTick label="Accepted" value={r.accepted - r.paid} tone="accept" />
                  <StatTick label="Pending" value={r.pending} tone="pending" />
                  <StatTick label="Declined" value={r.declined} tone="declined" />
                  <StatTick label="Expired" value={r.expired} tone="muted" />
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Draft/next round */}
        <div className="relative pl-14">
          <div className="absolute left-[14px] top-5 w-[18px] h-[18px] rounded-full grid place-items-center border-4 border-[hsl(var(--background))] bg-[hsl(var(--muted))] border-dashed">
            <span className="font-mono text-[9px] font-bold text-[hsl(var(--muted-foreground))]">
              3
            </span>
          </div>
          <div className="card-chrome p-5 border-dashed">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))] grid place-items-center">
                <Icon.Plus className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="text-[14px] font-semibold">Round 3 — Wildcard Wave (draft)</div>
                <div className="text-[11.5px] text-[hsl(var(--muted-foreground))] mt-0.5">
                  Build the next round in the Roster tab.
                </div>
              </div>
              <button className="h-8 px-3 text-[12px] rounded-md bg-[hsl(var(--primary))] text-white font-medium">
                Open Round Builder
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { RoundsTimeline });
