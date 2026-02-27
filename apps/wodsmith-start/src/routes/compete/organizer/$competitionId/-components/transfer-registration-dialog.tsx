import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { initiatePurchaseTransferFn } from "@/server-fns/purchase-transfer-fns"

interface TransferRegistrationDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	registration: {
		id: string
		athleteName: string
		divisionId: string | null
		divisionLabel: string | null
		commercePurchaseId: string | null
	}
	competitionId: string
}

export function TransferRegistrationDialog({
	open,
	onOpenChange,
	registration,
}: TransferRegistrationDialogProps) {
	const router = useRouter()
	const initiatePurchaseTransfer = useServerFn(initiatePurchaseTransferFn)
	const [targetEmail, setTargetEmail] = useState("")
	const [notes, setNotes] = useState("")
	const [isSubmitting, setIsSubmitting] = useState(false)

	const handleClose = (nextOpen: boolean) => {
		if (!nextOpen) {
			setTargetEmail("")
			setNotes("")
		}
		onOpenChange(nextOpen)
	}

	const handleSubmit = async () => {
		if (!registration.commercePurchaseId) return
		if (!targetEmail) return

		setIsSubmitting(true)
		try {
			await initiatePurchaseTransfer({
				data: {
					purchaseId: registration.commercePurchaseId,
					targetEmail,
					notes: notes || undefined,
				},
			})
			toast.success("Transfer initiated. An email has been sent to the recipient.")
			handleClose(false)
			router.invalidate()
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to initiate transfer",
			)
		} finally {
			setIsSubmitting(false)
		}
	}

	const isDisabled = !registration.commercePurchaseId
	const canSubmit = !isDisabled && !!targetEmail && !isSubmitting

	return (
		<Dialog open={open} onOpenChange={handleClose}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Transfer Registration</DialogTitle>
					<DialogDescription>
						Transfer{" "}
						<strong className="text-foreground">
							{registration.athleteName}
						</strong>
						{"'"}s registration
						{registration.divisionLabel && (
							<>
								{" "}in{" "}
								<strong className="text-foreground">
									{registration.divisionLabel}
								</strong>
							</>
						)}{" "}
						to a different person.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-2">
					{isDisabled && (
						<p className="text-sm text-destructive">
							This registration does not have an associated purchase and cannot
							be transferred.
						</p>
					)}

					<div className="space-y-2">
						<Label htmlFor="recipient-email">Recipient Email</Label>
						<Input
							id="recipient-email"
							type="email"
							placeholder="email@example.com"
							value={targetEmail}
							onChange={(e) => setTargetEmail(e.target.value)}
							disabled={isDisabled || isSubmitting}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="transfer-notes">Notes (optional)</Label>
						<Textarea
							id="transfer-notes"
							placeholder="Add any notes for the recipient..."
							value={notes}
							onChange={(e) => setNotes(e.target.value)}
							disabled={isDisabled || isSubmitting}
							rows={3}
						/>
					</div>

					<p className="text-sm text-muted-foreground">
						An email will be sent to the recipient with a link to accept the
						transfer. The link expires in 7 days.
					</p>
				</div>

				<DialogFooter>
					<Button
						variant="outline"
						onClick={() => handleClose(false)}
						disabled={isSubmitting}
					>
						Cancel
					</Button>
					<Button onClick={handleSubmit} disabled={!canSubmit}>
						{isSubmitting ? "Sending..." : "Send Transfer"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
