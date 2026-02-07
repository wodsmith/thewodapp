import { Check, Trophy } from "lucide-react"

export interface CompetitionShareCardProps {
	competitionName: string
	athleteName: string
	division?: string
	competitionLogoUrl?: string
}

export function CompetitionShareCard({
	competitionName,
	athleteName,
	division,
	competitionLogoUrl,
}: CompetitionShareCardProps) {
	return (
		<div className="relative mx-auto flex w-full flex-col items-center overflow-hidden rounded-3xl bg-linear-to-br from-[#141416] to-[#0e0e10] shadow-2xl shadow-black/40">
			{/* Ambient glow */}
			<div className="pointer-events-none absolute -left-12 -top-12 h-48 w-48 rounded-full bg-amber-500/[0.07] blur-3xl" />

			{/* Top accent line */}
			<div className="h-px w-full bg-linear-to-r from-transparent via-amber-500 to-transparent" />

			{/* Content */}
			<div className="flex w-full flex-col items-center gap-6 px-8 py-8">
				{/* WODsmith branding top */}
				<div className="flex items-center gap-2">
					<img
						src="/wodsmith-logo-no-text.png"
						alt="WODsmith"
						width={28}
						height={28}
						className="h-7 w-7 rounded-md"
					/>
					<span className="text-sm font-bold tracking-tight text-white">
						<span className="font-black uppercase">WOD</span>smith{" "}
						<span className="text-amber-500">Compete</span>
					</span>
				</div>

				{/* Competition logo */}
				<div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border border-[#2a2a2e] bg-[#1a1a1e]">
					{competitionLogoUrl ? (
						<img
							src={competitionLogoUrl}
							alt={`${competitionName} logo`}
							className="h-full w-full object-cover"
						/>
					) : (
						<Trophy className="h-10 w-10 text-slate-500" />
					)}
				</div>

				{/* REGISTERED badge */}
				<span className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-5 py-1.5">
					<Check className="h-3 w-3 text-amber-500" />
					<span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-500">
						Registered
					</span>
				</span>

				{/* Competition name */}
				<h2 className="max-w-[280px] text-balance text-center text-2xl font-bold uppercase leading-snug tracking-tight text-white">
					{competitionName}
				</h2>

				{/* Thin separator */}
				<div className="h-px w-16 bg-[#2a2a2e]" />

				{/* Athlete name + division */}
				{(athleteName || division) && (
					<div className="flex flex-col items-center gap-1">
						{athleteName && (
							<p className="text-xl font-bold uppercase tracking-tight text-white">
								{athleteName}
							</p>
						)}
						{division && (
							<p className="text-sm font-medium text-amber-500">{division}</p>
						)}
					</div>
				)}
			</div>
		</div>
	)
}
