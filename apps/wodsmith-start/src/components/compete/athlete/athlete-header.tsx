"use client"

interface AthleteHeaderProps {
	athlete?: {
		id: string
		name?: string | null
		image?: string | null
	}
}

export function AthleteHeader({ athlete }: AthleteHeaderProps) {
	return (
		<div className="flex items-center gap-4 p-4 border-b">
			<div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
				{athlete?.image ? (
					<img
						src={athlete.image}
						alt={athlete.name || "Athlete"}
						className="w-16 h-16 rounded-full object-cover"
					/>
				) : (
					<span className="text-2xl font-bold text-muted-foreground">
						{athlete?.name?.[0] || "A"}
					</span>
				)}
			</div>
			<div>
				<h1 className="text-2xl font-bold">{athlete?.name || "Athlete"}</h1>
			</div>
		</div>
	)
}
