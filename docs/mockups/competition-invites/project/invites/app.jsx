/* Main app — brings it all together, handles state, variant switching, Tweaks. */

const { useState, useEffect, useMemo } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "variant": "bold",
  "showCutoff": true
}/*EDITMODE-END*/;

function TweaksPanel({ open, tweaks, setTweaks }) {
  if (!open) return null;
  return (
    <div className="tweaks-panel">
      <div className="px-3 py-2.5 border-b border-[hsl(var(--border))] flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider">Tweaks</span>
        <span className="text-[10px] text-[hsl(var(--muted-foreground))]">Invites</span>
      </div>
      <div className="p-3 space-y-3">
        <div>
          <div className="text-[10.5px] uppercase tracking-wider text-[hsl(var(--muted-foreground))] font-medium mb-1.5">
            Visual take
          </div>
          <div className="grid grid-cols-2 gap-1">
            {[
              { id: "std", label: "By-the-book" },
              { id: "bold", label: "Bold flagship" },
            ].map((v) => (
              <button
                key={v.id}
                onClick={() => setTweaks({ ...tweaks, variant: v.id })}
                className={
                  "px-2.5 py-1.5 text-[11.5px] rounded-md border " +
                  (tweaks.variant === v.id
                    ? "border-[hsl(var(--foreground))] bg-[hsl(var(--foreground))] text-white font-medium"
                    : "border-[hsl(var(--border))] bg-white")
                }
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center justify-between text-[11.5px]">
          <span>Show cutoff line on roster</span>
          <input
            type="checkbox"
            className="checkbox"
            checked={tweaks.showCutoff}
            onChange={(e) => setTweaks({ ...tweaks, showCutoff: e.target.checked })}
          />
        </label>
      </div>
    </div>
  );
}

function InviteApp() {
  const {
    Sidebar,
    PageHeader,
    Tabs,
    Leaderboard,
    RoundBuilder,
    RoundsTimeline,
    SourcesView,
    EmailPreview,
    ATHLETES,
    ROUNDS,
    SOURCES,
    CHAMPIONSHIP,
    DEFAULT_DRAFT_ROUND,
    deriveStats,
    Icon,
  } = window;

  const [tweaks, setTweaks] = useState(TWEAK_DEFAULTS);
  const [tweaksOpen, setTweaksOpen] = useState(false);
  const [tab, setTab] = useState("roster");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(new Set());
  const [draft, setDraft] = useState(DEFAULT_DRAFT_ROUND);
  const [emailPreview, setEmailPreview] = useState(null);

  // Let the email preview modal change the tone/draft.tone
  useEffect(() => {
    window.__setTone = (t) => setDraft((d) => ({ ...d, tone: t }));
    return () => {
      window.__setTone = undefined;
    };
  }, []);

  const totalSpots = CHAMPIONSHIP.divisions[0].spots;
  const stats = useMemo(() => deriveStats(ATHLETES, totalSpots), [totalSpots]);

  const onToggle = (rank) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(rank)) next.delete(rank);
      else next.add(rank);
      return next;
    });
  };

  const onToggleAll = (list) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const allSelected = list.every((a) => next.has(a.rank));
      if (allSelected) list.forEach((a) => next.delete(a.rank));
      else list.forEach((a) => next.add(a.rank));
      return next;
    });
  };

  // Tweaks protocol
  useEffect(() => {
    const handler = (e) => {
      if (!e.data || typeof e.data !== "object") return;
      if (e.data.type === "__activate_edit_mode") setTweaksOpen(true);
      if (e.data.type === "__deactivate_edit_mode") setTweaksOpen(false);
    };
    window.addEventListener("message", handler);
    window.parent.postMessage({ type: "__edit_mode_available" }, "*");
    return () => window.removeEventListener("message", handler);
  }, []);

  useEffect(() => {
    window.parent.postMessage(
      { type: "__edit_mode_set_keys", edits: tweaks },
      "*",
    );
  }, [tweaks]);

  const variant = tweaks.variant;
  const variantClass = variant === "bold" ? "bold-variant" : "std-variant";

  return (
    <div className={variantClass + " h-screen flex overflow-hidden"} data-screen-label="organizer-invites">
      <Sidebar variant={variant} />

      <main className="flex-1 flex flex-col min-w-0">
        <TopBar variant={variant} />
        <PageHeader variant={variant} stats={stats} />
        <Tabs active={tab} onChange={setTab} variant={variant} />

        <div className="flex-1 min-h-0 flex overflow-hidden">
          {tab === "roster" && (
            <>
              <div className="flex-1 flex flex-col min-w-0 bg-white">
                <Leaderboard
                  athletes={ATHLETES}
                  selected={selected}
                  onToggle={onToggle}
                  onToggleAll={onToggleAll}
                  filter={filter}
                  setFilter={setFilter}
                  variant={variant}
                  totalSpots={tweaks.showCutoff ? totalSpots : 9999}
                />
              </div>
              <RoundBuilder
                athletes={ATHLETES}
                selected={selected}
                setSelected={setSelected}
                draft={draft}
                setDraft={setDraft}
                onPreviewEmail={() => setEmailPreview(draft.tone)}
                onSend={() => alert(`Would send Round ${draft.number} to ${selected.size} athletes.`)}
                variant={variant}
                totalSpots={totalSpots}
                stats={stats}
              />
            </>
          )}
          {tab === "sources" && (
            <div className="flex-1 overflow-y-auto thin-scroll">
              <SourcesView sources={SOURCES} variant={variant} />
            </div>
          )}
          {tab === "rounds" && (
            <div className="flex-1 overflow-y-auto thin-scroll">
              <RoundsTimeline rounds={ROUNDS} variant={variant} />
            </div>
          )}
          {tab === "email" && (
            <EmailTemplatesView variant={variant} onOpenPreview={(t) => setEmailPreview(t)} />
          )}
          {tab === "series" && <SeriesGlobalView variant={variant} />}
        </div>
      </main>

      {emailPreview && (
        <EmailPreview
          tone={emailPreview}
          draft={draft}
          championship={CHAMPIONSHIP}
          onClose={() => setEmailPreview(null)}
          variant={variant}
        />
      )}

      <TweaksPanel open={tweaksOpen} tweaks={tweaks} setTweaks={setTweaks} />
    </div>
  );
}

function TopBar({ variant }) {
  const { Icon } = window;
  return (
    <div className="h-14 border-b border-[hsl(var(--border))] bg-white flex items-center px-8 gap-4">
      <div className="flex items-center gap-2 text-[12.5px]">
        <span className="font-semibold">Jordan Tessmer</span>
        <span className="text-[hsl(var(--muted-foreground))]">· Organizer</span>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <button className="h-8 px-2.5 text-[12px] rounded-md border border-[hsl(var(--border))] bg-white flex items-center gap-1.5">
          <Icon.Eye className="w-3.5 h-3.5" />
          Preview public page
        </button>
        <button className="h-8 w-8 rounded-md border border-[hsl(var(--border))] bg-white grid place-items-center">
          <Icon.Settings className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function EmailTemplatesView({ variant, onOpenPreview }) {
  const { EMAIL_TEMPLATES, Icon } = window;
  return (
    <div className="flex-1 overflow-y-auto thin-scroll">
      <div className="p-8 max-w-[960px] mx-auto w-full">
        <div className="section-label mb-1">Email Templates</div>
        <h2
          className={
            variant === "bold"
              ? "page-title text-[32px] mb-5"
              : "text-[22px] font-semibold tracking-tight mb-5"
          }
        >
          Tone changes as rounds progress.
        </h2>

        <div className="grid grid-cols-3 gap-4">
          {Object.entries(EMAIL_TEMPLATES).map(([key, tpl]) => (
            <button
              key={key}
              onClick={() => onOpenPreview(key)}
              className="card-chrome p-5 text-left hover:border-[hsl(var(--foreground)/0.3)] transition-all"
            >
              <span
                className={
                  "inline-block text-[9.5px] font-bold tracking-[0.15em] px-1.5 py-1 rounded-sm text-white mb-3 " +
                  (tpl.badgeColor === "emerald"
                    ? "bg-[hsl(var(--accept))]"
                    : tpl.badgeColor === "orange"
                      ? "bg-[hsl(var(--primary))]"
                      : "bg-[hsl(var(--pending))]")
                }
              >
                {tpl.badge}
              </span>
              <div className="text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))] font-medium mb-1">
                {key === "guaranteed" ? "Round 1" : key === "opened" ? "Round 2" : "Round 3+"}
              </div>
              <h3 className="font-serif text-[20px] leading-tight tracking-tight">
                {tpl.headline}
              </h3>
              <p className="text-[11.5px] text-[hsl(var(--muted-foreground))] mt-2 line-clamp-3">
                {tpl.lede.replace("{source}", "their comp")}
              </p>
              <div className="mt-4 flex items-center gap-1.5 text-[11px] text-[hsl(var(--primary))] font-medium">
                <Icon.Eye className="w-3 h-3" />
                Preview email
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function SeriesGlobalView({ variant }) {
  const { Icon, ATHLETES, SourceTag } = window;
  // Pretend series global leaderboard = athletes from series sources, ordered by points
  const seriesAthletes = ATHLETES.filter((a) => a.source.startsWith("series"))
    .slice()
    .sort((a, b) => b.points - a.points);

  return (
    <div className="flex-1 overflow-y-auto thin-scroll">
      <div className="p-8 max-w-[960px] mx-auto w-full">
        <div className="section-label mb-1">Series Global Leaderboard</div>
        <h2
          className={
            variant === "bold"
              ? "page-title text-[32px]"
              : "text-[22px] font-semibold tracking-tight"
          }
        >
          Mountain West Throwdown Series
        </h2>
        <p className="text-[13px] text-[hsl(var(--muted-foreground))] mt-1 max-w-xl">
          Aggregated points across all three throwdowns. Athletes who already direct-qualified are
          marked; the next non-qualified athletes fill the remaining 6 global spots.
        </p>

        <div className="card-chrome mt-5 overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="bg-[hsl(0_0%_99%)] border-b border-[hsl(var(--border))]">
              <tr className="text-left text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))] font-medium">
                <th className="py-2.5 pl-5 w-12">#</th>
                <th className="py-2.5">Athlete</th>
                <th className="py-2.5 w-[160px]">Best finish</th>
                <th className="py-2.5 w-[90px] text-right">Points</th>
                <th className="py-2.5 w-[160px] pr-5">Status</th>
              </tr>
            </thead>
            <tbody>
              {seriesAthletes.map((a, i) => {
                const { AthleteAvatar, StatusPill } = window;
                const alreadyQualified = a.source !== "series-global";
                const globalPos = seriesAthletes
                  .filter((x) => x.source === "series-global")
                  .findIndex((x) => x.rank === a.rank);
                const isGlobalFill = a.source === "series-global";
                return (
                  <tr key={a.rank} className="border-b border-[hsl(var(--border))] last:border-0">
                    <td className="py-2.5 pl-5 font-mono text-[11px] text-[hsl(var(--muted-foreground))] tabular-nums">
                      {String(i + 1).padStart(2, "0")}
                    </td>
                    <td className="py-2.5">
                      <div className="flex items-center gap-2.5">
                        <AthleteAvatar athlete={a} />
                        <div>
                          <div className="text-[13px] font-medium leading-tight">{a.name}</div>
                          <div className="text-[11px] text-[hsl(var(--muted-foreground))] leading-tight">
                            {a.affiliate}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5">
                      <SourceTag sourceKey={a.source} variant={variant} />
                      <div className="text-[10.5px] text-[hsl(var(--muted-foreground))] mt-0.5">
                        {a.sourceDetail}
                      </div>
                    </td>
                    <td className="py-2.5 text-right font-semibold tabular-nums">{a.points}</td>
                    <td className="py-2.5 pr-5">
                      {alreadyQualified ? (
                        <span className="pill bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]">
                          <Icon.Check className="w-3 h-3" />
                          Direct-qualified
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="round-chip text-[9.5px] font-semibold px-1.5 py-0.5 rounded bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))]">
                            GLB {globalPos + 1}/6
                          </span>
                          <StatusPill status={a.status} variant={variant} />
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<InviteApp />);
