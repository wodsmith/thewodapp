/* Email preview modal — shows what athletes receive by tone. */

function EmailPreview({ tone, onClose, variant, draft, championship }) {
  const { Icon, EMAIL_TEMPLATES } = window;
  const tpl = EMAIL_TEMPLATES[tone] || EMAIL_TEMPLATES.guaranteed;

  const badgeColors = {
    emerald: "bg-[hsl(var(--accept))] text-white",
    orange: "bg-[hsl(var(--primary))] text-white",
    amber: "bg-[hsl(var(--pending))] text-white",
  };

  const source =
    tone === "guaranteed"
      ? "1st — SLC Throwdown"
      : tone === "opened"
        ? "the Mountain West Throwdown Series global leaderboard"
        : "the Online Qualifier";

  const deadline = tone === "guaranteed" ? "Jul 15, 2026" : tone === "opened" ? "Jul 22, 2026" : "Aug 1, 2026";

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-sm p-6 anim-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-[hsl(var(--border))] px-5 py-3 flex items-center justify-between">
          <div>
            <div className="section-label text-[hsl(var(--muted-foreground))]">Email Preview</div>
            <div className="text-[13px] font-semibold mt-0.5">
              What athletes in this round will receive
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex p-0.5 rounded-md bg-[hsl(var(--muted))]">
              {["guaranteed", "opened", "limited"].map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    // parent handles tone change via passed setter if needed; here simulate
                    draft && window.__setTone && window.__setTone(t);
                  }}
                  className={
                    "px-2.5 py-1 text-[11px] rounded font-medium capitalize " +
                    (tone === t ? "bg-white shadow-sm" : "text-[hsl(var(--muted-foreground))]")
                  }
                >
                  {t}
                </button>
              ))}
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 grid place-items-center rounded-md hover:bg-[hsl(var(--muted))]"
            >
              <Icon.X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-5 min-h-0 flex-1">
          {/* Email headers / mock client */}
          <div className="col-span-3 overflow-y-auto thin-scroll bg-[hsl(0_0%_98%)] border-r border-[hsl(var(--border))]">
            <div className="bg-white m-5 rounded-lg border border-[hsl(var(--border))] overflow-hidden">
              <div className="px-5 pt-5 pb-3 border-b border-[hsl(var(--border))]">
                <div className="flex items-center gap-2 text-[11px] text-[hsl(var(--muted-foreground))]">
                  <span className="uppercase tracking-wider font-medium">From</span>
                  <span className="text-[hsl(var(--foreground))]">
                    MWFC Finals &lt;invites@mwfc.org&gt;
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-[hsl(var(--muted-foreground))] mt-1">
                  <span className="uppercase tracking-wider font-medium">To</span>
                  <span className="text-[hsl(var(--foreground))]">
                    {tone === "guaranteed"
                      ? "marcus.reinholt@canvas.cf"
                      : tone === "opened"
                        ? "august.velkind@canvas.cf"
                        : "noah.castellanos@mhf.co"}
                  </span>
                </div>
                <div className="mt-2 text-[15px] font-semibold tracking-tight">
                  {draft ? draft.subject : tpl.headline}
                </div>
              </div>

              {/* Body */}
              <div className="p-0">
                {/* Hero */}
                <div
                  className={
                    "px-8 py-7 " +
                    (tone === "guaranteed"
                      ? "bg-[hsl(var(--accept)/0.06)]"
                      : tone === "opened"
                        ? "bg-[hsl(var(--primary)/0.05)]"
                        : "bg-[hsl(var(--pending)/0.06)]")
                  }
                >
                  <span
                    className={
                      "inline-block text-[10px] font-bold tracking-[0.15em] px-2 py-1 rounded-sm " +
                      badgeColors[tpl.badgeColor]
                    }
                  >
                    {tpl.badge}
                  </span>
                  <h1 className="font-serif text-[28px] mt-4 leading-tight tracking-tight">
                    {tpl.headline}
                  </h1>
                  <p className="text-[13.5px] text-[hsl(var(--foreground)/0.75)] mt-3 leading-relaxed">
                    {tpl.lede.replace("{source}", source)}
                  </p>
                </div>

                <div className="px-8 py-6 border-t border-[hsl(var(--border))]">
                  {/* Event card */}
                  <div className="rounded-lg border border-[hsl(var(--border))] overflow-hidden">
                    <div className="aspect-[5/2] diag-stripes grid place-items-center border-b border-[hsl(var(--border))]">
                      <span className="font-mono text-[10px] text-[hsl(var(--muted-foreground))]">
                        [event hero image]
                      </span>
                    </div>
                    <div className="px-4 py-3 bg-[hsl(0_0%_99%)]">
                      <div className="flex items-center gap-2">
                        <Icon.Trophy className="w-4 h-4 text-[hsl(var(--primary))]" />
                        <span className="text-[13px] font-semibold">MWFC Finals 2026</span>
                      </div>
                      <div className="grid grid-cols-3 gap-3 mt-3">
                        <div>
                          <div className="text-[9.5px] tracking-wider uppercase text-[hsl(var(--muted-foreground))] font-semibold">
                            When
                          </div>
                          <div className="text-[12px] font-medium mt-0.5">Aug 14–16, 2026</div>
                        </div>
                        <div>
                          <div className="text-[9.5px] tracking-wider uppercase text-[hsl(var(--muted-foreground))] font-semibold">
                            Where
                          </div>
                          <div className="text-[12px] font-medium mt-0.5">Salt Lake City, UT</div>
                        </div>
                        <div>
                          <div className="text-[9.5px] tracking-wider uppercase text-[hsl(var(--muted-foreground))] font-semibold">
                            Division
                          </div>
                          <div className="text-[12px] font-medium mt-0.5">RX Men · 20 spots</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {tone === "limited" && (
                    <div className="mt-5 flex gap-2.5 items-start bg-[hsl(var(--pending-bg))] border border-[hsl(var(--pending)/0.25)] rounded-md px-3 py-2.5">
                      <Icon.AlertTriangle className="w-4 h-4 text-[hsl(var(--pending))] shrink-0 mt-0.5" />
                      <div className="text-[12px] leading-snug">
                        <div className="font-semibold text-[hsl(35_95%_30%)]">
                          First come, first served
                        </div>
                        <div className="text-[hsl(var(--foreground)/0.7)]">
                          We've sent this invitation to 10 athletes for the final spots. Tickets will
                          go to whoever claims them first.
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mt-6">
                    <button
                      className={
                        "h-11 px-6 text-[14px] rounded-md font-semibold text-white w-full " +
                        (tone === "guaranteed"
                          ? "bg-[hsl(var(--accept))]"
                          : tone === "opened"
                            ? "bg-[hsl(var(--primary))]"
                            : "bg-[hsl(var(--foreground))]")
                      }
                    >
                      {tpl.cta} →
                    </button>
                    <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-2 text-center">
                      {tpl.footer.replace("{deadline}", deadline)}
                    </p>
                  </div>

                  <div className="mt-7 pt-5 border-t border-[hsl(var(--border))]">
                    <div className="text-[11px] text-[hsl(var(--muted-foreground))] leading-relaxed">
                      Questions? Reply to this email or reach the event crew at{" "}
                      <a className="text-[hsl(var(--primary))] underline">crew@mwfc.org</a>.
                      <br />
                      Can't make it? —{" "}
                      <a className="text-[hsl(var(--foreground))] underline">Decline the invitation</a>{" "}
                      so we can invite the next athlete.
                    </div>
                  </div>
                </div>
                <div className="px-8 py-4 bg-[hsl(0_0%_98.5%)] border-t border-[hsl(var(--border))] text-[10.5px] text-[hsl(var(--muted-foreground))] flex items-center gap-2">
                  <Icon.Logo className="w-4 h-4" />
                  Sent via WODsmith · Mountain West Fitness Co.
                </div>
              </div>
            </div>
          </div>

          {/* Tone comparison */}
          <div className="col-span-2 overflow-y-auto thin-scroll p-5">
            <div className="section-label mb-3">Tone comparison</div>
            <div className="space-y-3">
              {["guaranteed", "opened", "limited"].map((t) => {
                const tt = window.EMAIL_TEMPLATES[t];
                const active = t === tone;
                return (
                  <button
                    key={t}
                    onClick={() => window.__setTone && window.__setTone(t)}
                    className={
                      "w-full text-left p-3 rounded-md border transition-all " +
                      (active
                        ? "border-[hsl(var(--foreground))] bg-white shadow-sm"
                        : "border-[hsl(var(--border))] bg-white hover:border-[hsl(var(--foreground)/0.3)]")
                    }
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className={
                          "text-[9.5px] font-bold tracking-[0.15em] px-1.5 py-0.5 rounded-sm " +
                          badgeColors[tt.badgeColor]
                        }
                      >
                        {tt.badge}
                      </span>
                      <span className="text-[10px] uppercase font-medium text-[hsl(var(--muted-foreground))] tracking-wider">
                        {t === "guaranteed" ? "Round 1" : t === "opened" ? "Round 2" : "Round 3+"}
                      </span>
                    </div>
                    <div className="text-[12.5px] font-semibold leading-tight">{tt.headline}</div>
                    <div className="text-[11px] text-[hsl(var(--muted-foreground))] mt-1 line-clamp-3">
                      {tt.lede.replace("{source}", "their comp").slice(0, 120)}…
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="section-label mb-2 mt-6">Variables</div>
            <div className="space-y-1.5 text-[11.5px] font-mono">
              {[
                ["{athlete_name}", "Marcus Reinholt"],
                ["{source}", source],
                ["{deadline}", deadline],
                ["{claim_url}", "mwfc.org/claim/ax7f2…"],
              ].map(([k, v]) => (
                <div
                  key={k}
                  className="flex items-center justify-between p-1.5 rounded bg-[hsl(var(--muted))]"
                >
                  <span className="text-[hsl(var(--primary))]">{k}</span>
                  <span className="text-[hsl(var(--muted-foreground))] truncate ml-2">{v}</span>
                </div>
              ))}
            </div>

            <div className="mt-6">
              <button className="w-full h-8 text-[11.5px] rounded-md border border-[hsl(var(--border))] bg-white hover:bg-[hsl(var(--muted))] flex items-center justify-center gap-1.5 font-medium">
                <Icon.Pencil className="w-3 h-3" />
                Edit template
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { EmailPreview });
