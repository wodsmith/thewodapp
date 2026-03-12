import { CheckCircle2, Trophy } from "lucide-react"

export interface RegistrationItem {
  registrationId: string
  divisionLabel: string | null
  teamName?: string | null
}

export interface CompetitionRegisteredBannerProps {
  competitionName: string
  athleteName: string
  affiliateName?: string
  competitionLogoUrl?: string
  items: RegistrationItem[]
}

export function CompetitionRegisteredBanner({
  competitionName,
  athleteName,
  affiliateName,
  competitionLogoUrl,
  items,
}: CompetitionRegisteredBannerProps) {
  return (
    <div className="relative mx-auto w-full max-w-2xl overflow-hidden rounded-2xl bg-linear-to-br from-[#141416] to-[#0e0e10] shadow-2xl shadow-black/40">
      {/* Ambient glow behind logo */}
      <div className="pointer-events-none absolute -left-12 -top-12 h-48 w-48 rounded-full bg-amber-500/[0.07] blur-3xl" />

      {/* Top accent */}
      <div className="h-px w-full bg-linear-to-r from-transparent via-amber-500 to-transparent" />

      <div className="relative flex flex-col items-center gap-10 px-10 py-12">
        {/* Success header */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10">
            <CheckCircle2 className="h-7 w-7 text-amber-500" />
          </div>
          <h1 className="text-2xl font-bold text-white">You're Registered!</h1>
          <p className="text-sm text-slate-400">
            You're all set for {competitionName}. See you on competition day.
          </p>
        </div>

        {/* Registration details */}
        <div className="flex w-full items-center gap-8">
          {/* Competition logo */}
          <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/8 bg-white/3 ring-1 ring-white/4">
            {competitionLogoUrl ? (
              <img
                src={competitionLogoUrl}
                alt={`${competitionName} logo`}
                className="h-full w-full object-cover"
              />
            ) : (
              <Trophy className="h-12 w-12 text-slate-600" />
            )}
          </div>

          {/* Info */}
          <div className="flex flex-1 flex-col gap-3">
            <h2 className="text-left text-2xl font-bold uppercase tracking-tight text-white">
              {competitionName}
            </h2>
            <div className="flex items-center gap-3">
              {athleteName && (
                <p className="text-lg font-semibold text-slate-300">
                  {athleteName}
                </p>
              )}
              {affiliateName && (
                <>
                  <span className="text-slate-600">·</span>
                  <p className="text-base font-medium text-slate-400">
                    {affiliateName}
                  </p>
                </>
              )}
            </div>
            {items.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {items.map((item) => (
                  <span
                    key={item.registrationId}
                    className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1"
                  >
                    <span className="text-xs font-medium text-amber-500">
                      {item.divisionLabel ?? "Division"}
                    </span>
                    {item.teamName && (
                      <span className="text-xs text-slate-400">
                        ({item.teamName})
                      </span>
                    )}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Branding */}
          <div className="flex shrink-0 flex-col items-center gap-1.5 opacity-40">
            <img
              src="/wodsmith-logo-no-text.png"
              alt="WODsmith"
              width={28}
              height={28}
              className="h-7 w-7 rounded-md"
            />
            <span className="text-[9px] font-medium tracking-wider text-slate-500">
              wodsmith.com
            </span>
          </div>
        </div>
      </div>

      {/* Bottom subtle line */}
      <div className="h-px w-full bg-linear-to-r from-transparent via-white/4 to-transparent" />
    </div>
  )
}
