"use client"

interface BenchmarkStatsProps {
	benchmarks?: Array<{
		name: string
		score: string
	}>
}

export function BenchmarkStats({ benchmarks = [] }: BenchmarkStatsProps) {
	if (benchmarks.length === 0) {
		return (
			<div className="p-4 text-center text-muted-foreground">
				No benchmark data available
			</div>
		)
	}

	return (
		<div className="p-4 space-y-2">
			<h3 className="font-semibold">Benchmarks</h3>
			<div className="grid gap-2">
				{benchmarks.map((benchmark) => (
					<div
						key={benchmark.name}
						className="flex justify-between items-center p-2 bg-muted rounded"
					>
						<span>{benchmark.name}</span>
						<span className="font-mono">{benchmark.score}</span>
					</div>
				))}
			</div>
		</div>
	)
}
