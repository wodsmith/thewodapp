"use client"

import { Button } from "~/components/ui/button"

interface PasskeyProps {
	passkeys?: Array<{
		id: string
		name: string
		createdAt: string
	}>
	onAdd?: () => void
	onRemove?: (id: string) => void
}

export function Passkey({ passkeys = [], onAdd, onRemove }: PasskeyProps) {
	return (
		<div className="space-y-4">
			<div className="flex justify-between items-center">
				<h3 className="font-semibold">Passkeys</h3>
				<Button onClick={onAdd} size="sm">
					Add Passkey
				</Button>
			</div>
			{passkeys.length === 0 ? (
				<p className="text-muted-foreground text-sm">
					No passkeys configured. Add a passkey for passwordless sign-in.
				</p>
			) : (
				<div className="space-y-2">
					{passkeys.map((passkey) => (
						<div
							key={passkey.id}
							className="flex justify-between items-center p-3 border rounded"
						>
							<div>
								<div className="font-medium">{passkey.name}</div>
								<div className="text-sm text-muted-foreground">
									Added {passkey.createdAt}
								</div>
							</div>
							<Button
								variant="destructive"
								size="sm"
								onClick={() => onRemove?.(passkey.id)}
							>
								Remove
							</Button>
						</div>
					))}
				</div>
			)}
		</div>
	)
}
