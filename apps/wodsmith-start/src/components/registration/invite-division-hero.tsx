import { Sparkles, Users } from "lucide-react"
import { cn } from "@/lib/utils"

interface Props {
  championshipName: string
  divisionLabel: string
  teamSize: number
  imageUrl?: string | null
  className?: string
}

export function InviteDivisionHero({
  championshipName,
  divisionLabel,
  teamSize,
  imageUrl,
  className,
}: Props) {
  return (
    <section
      aria-label="Invitation"
      className={cn(
        "relative overflow-hidden rounded-2xl p-[1.5px]",
        "animate-[invite-rise_0.7s_cubic-bezier(0.16,1,0.3,1)_backwards]",
        className,
      )}
    >
      {/* Outer glow ring */}
      <div
        aria-hidden
        className="absolute inset-0 rounded-2xl bg-[conic-gradient(from_180deg_at_50%_50%,hsl(var(--primary))_0deg,#fbbf24_120deg,hsl(var(--primary))_240deg,#fb923c_360deg)] opacity-80 animate-[invite-glow_6s_ease-in-out_infinite]"
      />

      <div className="relative overflow-hidden rounded-[14px] bg-card px-6 py-7 sm:px-8 sm:py-9">
        {/* Blurred competition profile image as background */}
        {imageUrl ? (
          <>
            <div
              aria-hidden
              className="absolute inset-0 scale-125 bg-cover bg-center opacity-50 blur-2xl saturate-[1.15]"
              style={{ backgroundImage: `url(${JSON.stringify(imageUrl)})` }}
            />
            {/* Readability scrim */}
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-br from-card/85 via-card/70 to-card/90"
            />
          </>
        ) : (
          <>
            <div
              aria-hidden
              className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-primary/15 blur-3xl"
            />
            <div
              aria-hidden
              className="absolute -bottom-32 -left-20 h-72 w-72 rounded-full bg-amber-400/10 blur-3xl"
            />
          </>
        )}

        <div className="relative">
          {/* Eyebrow */}
          <div className="flex items-center gap-2 text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-primary">
            <Sparkles
              aria-hidden
              className="h-3.5 w-3.5 animate-[invite-spark_3.2s_ease-in-out_infinite]"
            />
            <span>Invitation Reserved</span>
            <span
              aria-hidden
              className="ml-2 h-px flex-1 bg-gradient-to-r from-primary/60 via-primary/20 to-transparent"
            />
          </div>

          {/* Headline */}
          <h2 className="mt-5 font-black tracking-tight text-3xl sm:text-4xl leading-[1.05]">
            <span className="text-foreground">
              You've been invited to compete at
            </span>{" "}
            <span className="bg-gradient-to-br from-primary via-amber-500 to-orange-600 bg-clip-text text-transparent">
              {championshipName}.
            </span>
          </h2>

          {/* Division reveal */}
          <div className="relative mt-7 overflow-hidden rounded-xl border border-primary/30 bg-card/60 backdrop-blur-sm">
            {/* Sweep shimmer */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 bg-gradient-to-r from-transparent via-white/20 to-transparent dark:via-white/10 animate-[invite-shimmer_2.4s_linear_infinite]"
            />

            <div className="relative px-6 py-6 sm:px-7 sm:py-7">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-primary/90">
                Your Division
              </p>
              <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-2">
                <p className="font-black uppercase leading-none tracking-tight text-3xl sm:text-[2.6rem]">
                  {divisionLabel}
                </p>
                {teamSize > 1 ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary">
                    <Users aria-hidden className="h-3 w-3" />
                    Team of {teamSize}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
