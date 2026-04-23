/* Qualification Sources tab — define which comps/series feed the championship. */

function SourceCard({ source, variant, index }) {
  const { Icon } = window;
  const isSeries = source.kind === "series";

  return (
    <div className="card-chrome overflow-hidden">
      <div className="p-5 flex items-start gap-4 border-b border-[hsl(var(--border))]">
        <div
          className={
            "w-11 h-11 shrink-0 rounded-lg grid place-items-center " +
            (isSeries
              ? "bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))]"
              : "bg-[hsl(var(--accept-bg))] text-[hsl(var(--accept))]")
          }
        >
          {isSeries ? <Icon.Layers className="w-5 h-5" /> : <Icon.Trophy className="w-5 h-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span
              className={
                "round-chip text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wider " +
                (isSeries
                  ? "bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))]"
                  : "bg-[hsl(var(--accept-bg))] text-[hsl(var(--accept))]")
              }
            >
              {isSeries ? "Series" : "Single competition"}
            </span>
            <span className="text-[11px] text-[hsl(var(--muted-foreground))]">· {source.date}</span>
          </div>
          <h3 className="text-[16px] font-semibold">{source.name}</h3>
          <div className="text-[11.5px] text-[hsl(var(--muted-foreground))] mt-1">
            Contributes{" "}
            <span className="font-semibold text-[hsl(var(--foreground))] tabular-nums">
              {source.allocated}
            </span>{" "}
            qualifying spots to the championship.
          </div>
        </div>
        <button className="h-7 px-2.5 text-[11.5px] rounded-md border border-[hsl(var(--border))] bg-white hover:bg-[hsl(var(--muted))] flex items-center gap-1.5">
          <Icon.Pencil className="w-3 h-3" />
          Edit
        </button>
      </div>

      {isSeries ? (
        <div className="grid grid-cols-2 gap-0 divide-x divide-[hsl(var(--border))]">
          <div className="p-5">
            <div className="section-label mb-2">Direct qualifiers</div>
            <div className="text-[11.5px] text-[hsl(var(--muted-foreground))] mb-3">
              Top{" "}
              <span className="font-semibold text-[hsl(var(--foreground))]">
                {source.directSpotsPerComp}
              </span>{" "}
              of each individual throwdown are directly invited. Their individual leaderboards
              display below.
            </div>
            <div className="space-y-1.5">
              {source.comps.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-2 px-2.5 py-2 rounded-md border border-[hsl(var(--border))] bg-white"
                >
                  <div className="w-6 h-6 rounded bg-[hsl(var(--muted))] grid place-items-center">
                    <Icon.Trophy className="w-3 h-3 text-[hsl(var(--muted-foreground))]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-medium truncate">{c.name}</div>
                    <div className="text-[10.5px] text-[hsl(var(--muted-foreground))]">
                      {c.date} · {c.athletes} athletes
                    </div>
                  </div>
                  <span className="text-[10.5px] font-semibold text-[hsl(var(--accept))] tabular-nums">
                    +{source.directSpotsPerComp}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="p-5">
            <div className="section-label mb-2">Series global leaderboard</div>
            <div className="text-[11.5px] text-[hsl(var(--muted-foreground))] mb-3">
              Remaining spots flow to the top athletes across the series who didn't qualify
              directly.
            </div>
            <div className="flex items-center gap-4 px-3 py-3 rounded-md border border-[hsl(var(--border))] bg-white">
              <div>
                <div className="display-number text-[32px] leading-none">{source.globalSpots}</div>
                <div className="section-label mt-1">Global spots</div>
              </div>
              <div className="w-px h-10 bg-[hsl(var(--border))]" />
              <div className="flex-1 text-[11px] text-[hsl(var(--muted-foreground))] leading-snug">
                Winners already direct-qualified are{" "}
                <span className="font-medium text-[hsl(var(--foreground))]">skipped</span>.
              </div>
            </div>
            <button className="mt-3 text-[11.5px] text-[hsl(var(--primary))] font-medium flex items-center gap-1 hover:underline">
              View series global leaderboard
              <Icon.ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      ) : (
        <div className="p-5">
          <div className="flex items-center gap-4">
            <div>
              <div className="display-number text-[32px] leading-none">{source.allocated}</div>
              <div className="section-label mt-1">Spots from top {source.allocated}</div>
            </div>
            <div className="w-px h-10 bg-[hsl(var(--border))]" />
            <div className="text-[11.5px] text-[hsl(var(--muted-foreground))] flex-1">
              {source.athletes} athletes competed · leaderboard already finalized
            </div>
            <button className="h-7 px-2.5 text-[11.5px] rounded-md border border-[hsl(var(--border))] bg-white hover:bg-[hsl(var(--muted))] flex items-center gap-1.5">
              <Icon.Link className="w-3 h-3" />
              View leaderboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SourcesView({ sources, variant }) {
  const { Icon } = window;
  const total = sources.reduce((s, src) => s + src.allocated, 0);
  return (
    <div className="p-8 max-w-[960px] mx-auto w-full">
      <div className="flex items-end justify-between mb-5">
        <div>
          <div className="section-label mb-1">Qualification Sources</div>
          <h2
            className={
              variant === "bold"
                ? "page-title text-[32px]"
                : "text-[22px] font-semibold tracking-tight"
            }
          >
            Who can earn a spot at MWFC Finals?
          </h2>
          <p className="text-[13px] text-[hsl(var(--muted-foreground))] mt-1 max-w-xl">
            Each source defines how many athletes feed into the championship. Athletes appear in
            the unified roster ordered by qualification priority.
          </p>
        </div>
        <button className="h-9 px-3 text-[12.5px] rounded-md bg-[hsl(var(--foreground))] text-white font-medium flex items-center gap-1.5">
          <Icon.Plus className="w-3.5 h-3.5" />
          Add source
        </button>
      </div>

      <div className="card-chrome p-5 mb-6 flex items-center gap-6">
        <div>
          <div className="display-number text-[32px] leading-none">{total}</div>
          <div className="section-label mt-1">Total qualifying spots</div>
        </div>
        <div className="w-px h-10 bg-[hsl(var(--border))]" />
        <div>
          <div className="display-number text-[32px] leading-none">20</div>
          <div className="section-label mt-1">Division capacity · RX Men</div>
        </div>
        <div className="w-px h-10 bg-[hsl(var(--border))]" />
        <div className="flex-1 text-[11.5px] text-[hsl(var(--muted-foreground))] leading-snug max-w-sm">
          If more athletes qualify than spots exist, athletes lower on the unified leaderboard move
          to a waitlist and only receive invitations in later rounds.
        </div>
      </div>

      <div className="space-y-4">
        {sources.map((s, i) => (
          <SourceCard key={s.id} source={s} variant={variant} index={i} />
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { SourcesView });
