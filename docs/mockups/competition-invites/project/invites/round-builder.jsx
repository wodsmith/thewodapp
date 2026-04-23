/* Round builder inspector: selected count, smart-select (prev-round no-response),
   round meta (number/label/tone/deadline), email preview link, send. */

function SmartSelectButton({ label, sub, count, onClick, Icon, IconKey }) {
  const Ico = Icon[IconKey] || Icon.Sparkles;
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 p-2.5 rounded-md border border-[hsl(var(--border))] bg-white hover:border-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.03)] text-left group transition-all"
    >
      <div className="w-7 h-7 shrink-0 rounded-md bg-[hsl(var(--muted))] group-hover:bg-[hsl(var(--primary)/0.1)] group-hover:text-[hsl(var(--primary))] grid place-items-center text-[hsl(var(--foreground)/0.6)]">
        <Ico className="w-3.5 h-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-medium leading-tight">{label}</div>
        <div className="text-[10.5px] text-[hsl(var(--muted-foreground))] mt-0.5">{sub}</div>
      </div>
      <div className="text-[11px] font-semibold tabular-nums text-[hsl(var(--foreground)/0.7)] group-hover:text-[hsl(var(--primary))]">
        +{count}
      </div>
    </button>
  );
}

function SelectedChip({ athlete, onRemove }) {
  const { AthleteAvatar, Icon } = window;
  return (
    <div className="flex items-center gap-2 py-1.5 px-2 rounded-md bg-[hsl(var(--primary)/0.06)] border border-[hsl(var(--primary)/0.15)]">
      <AthleteAvatar athlete={athlete} size={22} />
      <div className="min-w-0 flex-1">
        <div className="text-[11.5px] font-medium truncate leading-tight">{athlete.name}</div>
        <div className="text-[10px] text-[hsl(var(--muted-foreground))] truncate leading-tight">
          Rank {athlete.rank} · {athlete.sourceDetail}
        </div>
      </div>
      <button
        onClick={() => onRemove(athlete.rank)}
        className="w-5 h-5 grid place-items-center rounded hover:bg-[hsl(var(--primary)/0.15)] text-[hsl(var(--primary))]"
      >
        <Icon.X className="w-3 h-3" />
      </button>
    </div>
  );
}

function RoundBuilder({
  athletes,
  selected,
  setSelected,
  draft,
  setDraft,
  onPreviewEmail,
  onSend,
  variant,
  totalSpots,
  stats,
}) {
  const { Icon } = window;
  const selectedList = athletes.filter((a) => selected.has(a.rank));

  // Smart-select helpers
  const pendingPrev = athletes.filter((a) => a.status === "pending" || a.status === "expired" || a.status === "declined");
  const topWaitlist = athletes.filter((a) => a.status === "not_invited").slice(0, 5);
  const topWaitlist10 = athletes.filter((a) => a.status === "not_invited").slice(0, 10);

  const addMany = (list) => {
    const next = new Set(selected);
    list.forEach((a) => next.add(a.rank));
    setSelected(next);
  };

  const clear = () => setSelected(new Set());

  const spotsRemaining = totalSpots - stats.paid;
  const overAllocated = selectedList.length > spotsRemaining;

  return (
    <aside
      className={
        "w-[380px] shrink-0 border-l border-[hsl(var(--border))] bg-[hsl(0_0%_99%)] flex flex-col h-full " +
        (variant === "bold" ? "" : "")
      }
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-[hsl(var(--border))] bg-white">
        <div className="flex items-center justify-between">
          <div>
            <div className="section-label mb-1">Round Builder</div>
            <h2
              className={
                variant === "bold"
                  ? "page-title text-[24px] leading-tight"
                  : "text-[17px] font-semibold tracking-tight"
              }
            >
              Round {draft.number}
            </h2>
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-1">
          <span
            className={
              "display-number " +
              (variant === "bold" ? "text-[38px] leading-none" : "text-[28px] font-semibold leading-none")
            }
          >
            {selectedList.length}
          </span>
          <span className="text-[12px] text-[hsl(var(--muted-foreground))] font-medium">
            athletes selected
          </span>
          <span className="ml-auto text-[10.5px] text-[hsl(var(--muted-foreground))] tabular-nums">
            {spotsRemaining} spots left
          </span>
        </div>
        {overAllocated && (
          <div className="mt-2 flex items-start gap-1.5 text-[11px] text-[hsl(var(--pending))] bg-[hsl(var(--pending-bg))] p-2 rounded">
            <Icon.AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>
              Selection exceeds remaining spots — that's fine if you expect some athletes to decline.
            </span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto thin-scroll">
        {/* Smart-select */}
        <div className="px-5 py-4 border-b border-[hsl(var(--border))]">
          <div className="section-label mb-2.5">Quick add</div>
          <div className="space-y-1.5">
            <SmartSelectButton
              Icon={Icon}
              IconKey="Refresh"
              label="Re-invite non-responders"
              sub="Previous rounds who didn't accept"
              count={pendingPrev.length}
              onClick={() => addMany(pendingPrev)}
            />
            <SmartSelectButton
              Icon={Icon}
              IconKey="Arrow"
              label="Next 5 on leaderboard"
              sub="Open invites to ranks 21–25"
              count={topWaitlist.length}
              onClick={() => addMany(topWaitlist)}
            />
            <SmartSelectButton
              Icon={Icon}
              IconKey="Arrow"
              label="Next 10 on leaderboard"
              sub="Open invites to ranks 21–30"
              count={topWaitlist10.length}
              onClick={() => addMany(topWaitlist10)}
            />
          </div>
        </div>

        {/* Round metadata */}
        <div className="px-5 py-4 border-b border-[hsl(var(--border))] space-y-3">
          <div className="section-label">Round details</div>

          <div>
            <label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))] block mb-1">
              Round label
            </label>
            <input
              value={draft.label}
              onChange={(e) => setDraft({ ...draft, label: e.target.value })}
              className="w-full h-8 px-2.5 text-[12.5px] rounded-md border border-[hsl(var(--border))] bg-white"
            />
          </div>

          <div>
            <label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))] block mb-1">
              RSVP deadline
            </label>
            <div className="flex gap-1.5">
              {[2, 4, 7, 14].map((d) => (
                <button
                  key={d}
                  onClick={() => setDraft({ ...draft, rsvpDays: d })}
                  className={
                    "flex-1 h-8 text-[11.5px] rounded-md border tabular-nums " +
                    (draft.rsvpDays === d
                      ? "border-[hsl(var(--foreground))] bg-[hsl(var(--foreground))] text-white font-medium"
                      : "border-[hsl(var(--border))] bg-white hover:border-[hsl(var(--foreground)/0.3)]")
                  }
                >
                  {d} days
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[11px] font-medium text-[hsl(var(--muted-foreground))] block mb-1">
              Email subject
            </label>
            <input
              value={draft.subject}
              onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
              className="w-full h-8 px-2.5 text-[12.5px] rounded-md border border-[hsl(var(--border))] bg-white"
            />
          </div>
        </div>

        {/* Selected athletes list */}
        <div className="px-5 py-4">
          <div className="flex items-center justify-between mb-2">
            <div className="section-label">Recipients</div>
            {selectedList.length > 0 && (
              <button
                onClick={clear}
                className="text-[11px] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              >
                Clear all
              </button>
            )}
          </div>
          {selectedList.length === 0 ? (
            <div className="text-[11.5px] text-[hsl(var(--muted-foreground))] py-6 text-center border border-dashed border-[hsl(var(--border))] rounded-md">
              Select athletes on the left or use Quick add
            </div>
          ) : (
            <div className="space-y-1">
              {selectedList.map((a) => (
                <SelectedChip
                  key={a.rank}
                  athlete={a}
                  onRemove={(rank) => {
                    const next = new Set(selected);
                    next.delete(rank);
                    setSelected(next);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-[hsl(var(--border))] bg-white p-4 space-y-2">
        <button
          onClick={onPreviewEmail}
          className="w-full h-9 text-[12.5px] rounded-md border border-[hsl(var(--border))] bg-white flex items-center justify-center gap-1.5 font-medium hover:bg-[hsl(var(--muted))]"
        >
          <Icon.Eye className="w-3.5 h-3.5" />
          Preview email
        </button>
        <button
          onClick={onSend}
          disabled={selectedList.length === 0}
          className={
            "w-full h-10 text-[13px] rounded-md font-semibold flex items-center justify-center gap-2 transition-all " +
            (selectedList.length === 0
              ? "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] cursor-not-allowed"
              : variant === "bold"
                ? "bg-[hsl(var(--foreground))] text-white hover:bg-[hsl(var(--foreground)/0.9)]"
                : "bg-[hsl(var(--primary))] text-white hover:bg-[hsl(var(--primary)/0.9)]")
          }
        >
          <Icon.Send className="w-4 h-4" />
          Send Round {draft.number} · {selectedList.length} {selectedList.length === 1 ? "invite" : "invites"}
        </button>
        <div className="text-[10.5px] text-[hsl(var(--muted-foreground))] text-center">
          Emails send immediately · athletes receive a link to claim their spot
        </div>
      </div>
    </aside>
  );
}

Object.assign(window, { RoundBuilder });
