"use client"

import { Link } from "@tanstack/react-router"

interface Movement {
	id: string
	name: string
	category?: string
}

interface MovementListProps {
	movements?: Movement[]
}

export function MovementList({ movements = [] }: MovementListProps) {
	if (movements.length === 0) {
		return (
			<div className="p-4 text-center text-muted-foreground">
				No movements found
			</div>
		)
	}

	return (
		<div className="grid gap-2">
			{movements.map((movement) => (
				<Link
					key={movement.id}
					to="/movements/$movementId"
					params={{ movementId: movement.id }}
					className="p-3 border rounded hover:bg-muted transition-colors"
				>
					<div className="font-medium">{movement.name}</div>
					{movement.category && (
						<div className="text-sm text-muted-foreground">
							{movement.category}
						</div>
					)}
				</Link>
			))}
		</div>
	)
}
