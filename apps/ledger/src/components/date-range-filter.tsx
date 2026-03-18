import { cn } from "@/utils/cn"

interface DateRangeFilterProps {
	startDate: string
	endDate: string
	onDateChange: (startDate: string, endDate: string) => void
}

const PRESETS = [
	{ label: "7d", days: 7 },
	{ label: "30d", days: 30 },
	{ label: "90d", days: 90 },
	{ label: "1y", days: 365 },
] as const

function formatISODate(date: Date): string {
	return date.toISOString().split("T")[0]
}

function daysAgo(days: number): string {
	const d = new Date()
	d.setDate(d.getDate() - days)
	return formatISODate(d)
}

function getActivePreset(startDate: string, endDate: string): number | null {
	const today = formatISODate(new Date())
	if (endDate !== today) return null
	for (const preset of PRESETS) {
		if (startDate === daysAgo(preset.days)) return preset.days
	}
	return null
}

export function DateRangeFilter({
	startDate,
	endDate,
	onDateChange,
}: DateRangeFilterProps) {
	const activePreset = getActivePreset(startDate, endDate)

	const handlePreset = (days: number) => {
		onDateChange(daysAgo(days), formatISODate(new Date()))
	}

	return (
		<div className="flex items-center gap-2 flex-wrap">
			<div className="flex items-center gap-1">
				{PRESETS.map((preset) => (
					<button
						key={preset.label}
						type="button"
						onClick={() => handlePreset(preset.days)}
						className={cn(
							"inline-flex h-8 items-center rounded-md px-2.5 text-xs font-medium transition-colors",
							activePreset === preset.days
								? "bg-primary text-primary-foreground"
								: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
							preset.days === 30 &&
								activePreset === null &&
								"ring-1 ring-primary/30",
						)}
					>
						{preset.label}
					</button>
				))}
			</div>
			<div className="flex items-center gap-1.5 text-sm text-muted-foreground">
				<input
					type="date"
					value={startDate}
					onChange={(e) => onDateChange(e.target.value, endDate)}
					className="flex h-8 rounded-md border border-input bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				/>
				<span>&ndash;</span>
				<input
					type="date"
					value={endDate}
					onChange={(e) => onDateChange(startDate, e.target.value)}
					className="flex h-8 rounded-md border border-input bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				/>
			</div>
		</div>
	)
}
