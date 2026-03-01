import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { ArrowRight } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import type { CompetitionDivisionWithCounts } from "@/server-fns/competition-divisions-fns"
import { transferRegistrationDivisionFn } from "@/server-fns/registration-fns"

interface TransferDivisionDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	registration: {
		id: string
		athleteName: string
		divisionId: string | null
		divisionLabel: string | null
		teamSize: number
	}
	divisions: CompetitionDivisionWithCounts[]
	competitionId: string
	registeredDivisionIds: string[]
}

export function TransferDivisionDialog({
	open,
	onOpenChange,
	registration,
	divisions,
	competitionId,
	registeredDivisionIds,
}: TransferDivisionDialogProps) {
	const router = useRouter()
	const transferRegistration = useServerFn(transferRegistrationDivisionFn)
	const [selectedDivisionId, setSelectedDivisionId] = useState<string>("")
	const [isTransferring, setIsTransferring] = useState(false)

	// Filter to compatible divisions (matching teamSize, excluding already-registered)
	const compatibleDivisions = divisions.filter(
		(d) =>
			d.teamSize === registration.teamSize &&
			!registeredDivisionIds.includes(d.id),
	)

	const selectedDivision = divisions.find((d) => d.id === selectedDivisionId)
	const isAtCapacity =
		selectedDivision?.maxSpots != null &&
		selectedDivision.registrationCount >= selectedDivision.maxSpots

	const handleTransfer = async () => {
		if (!selectedDivisionId) return
		setIsTransferring(true)
		try {
			const result = await transferRegistration({
				data: {
					registrationId: registration.id,
					competitionId,
					targetDivisionId: selectedDivisionId,
				},
			})
			const message =
				result.removedHeatAssignments > 0
					? `Transferred successfully. ${result.removedHeatAssignments} heat assignment${result.removedHeatAssignments === 1 ? "" : "s"} removed.`
					: "Transferred successfully."
			toast.success(message)
			onOpenChange(false)
			setSelectedDivisionId("")
			router.invalidate()
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to transfer division",
			)
		} finally {
			setIsTransferring(false)
		}
	}

	return (
		<Dialog
			open={open}
			onOpenChange={(nextOpen) => {
				if (!nextOpen) {
					setSelectedDivisionId("")
				}
				onOpenChange(nextOpen)
			}}
		>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Transfer Division</DialogTitle>
					<DialogDescription>
						Move{" "}
						<strong className="text-foreground">
							{registration.athleteName}
						</strong>{" "}
						from{" "}
						<strong className="text-foreground">
							{registration.divisionLabel ?? "No Division"}
						</strong>{" "}
						to a different division.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-2">
					<div className="space-y-2">
						<label htmlFor="target-division" className="text-sm font-medium">
							Target Division
						</label>
						<Select
							value={selectedDivisionId}
							onValueChange={setSelectedDivisionId}
						>
							<SelectTrigger id="target-division">
								<SelectValue placeholder="Select a division" />
							</SelectTrigger>
							<SelectContent>
								{compatibleDivisions.map((division) => (
									<SelectItem key={division.id} value={division.id}>
										<span className="flex items-center gap-2">
											{division.label}
											<span className="text-muted-foreground text-xs">
												({division.registrationCount}
												{division.maxSpots != null
													? `/${division.maxSpots}`
													: " registered"}
												)
											</span>
										</span>
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					{selectedDivision && (
						<div className="flex items-center gap-2 text-sm">
							<Badge variant="outline">
								{registration.divisionLabel ?? "No Division"}
							</Badge>
							<ArrowRight className="h-4 w-4 text-muted-foreground" />
							<Badge variant="outline">{selectedDivision.label}</Badge>
						</div>
					)}

					{isAtCapacity && (
						<p className="text-sm text-yellow-600 dark:text-yellow-500">
							Warning: This division is at capacity (
							{selectedDivision!.registrationCount}/{selectedDivision!.maxSpots}
							). The transfer will still proceed.
						</p>
					)}

					<p className="text-sm text-muted-foreground">
						Any existing heat assignments will be removed.
					</p>
				</div>

				<DialogFooter>
					<Button
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={isTransferring}
					>
						Cancel
					</Button>
					<Button
						onClick={handleTransfer}
						disabled={!selectedDivisionId || isTransferring}
					>
						{isTransferring ? "Transferring..." : "Transfer"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
