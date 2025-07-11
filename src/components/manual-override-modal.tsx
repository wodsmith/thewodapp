import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface ManualOverrideModalProps {
	isOpen: boolean
	onClose: () => void
	// Add props for class details, coach selection, etc.
}

export function ManualOverrideModal({
	isOpen,
	onClose,
}: ManualOverrideModalProps) {
	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent className="sm:max-w-[425px]">
				<DialogHeader>
					<DialogTitle>Manual Schedule Override</DialogTitle>
				</DialogHeader>
				<div className="grid gap-4 py-4">
					<p>Content for manual override goes here.</p>
					{/* Add form elements for changing coach, time, etc. */}
				</div>
				<div className="flex justify-end gap-2">
					<Button variant="outline" onClick={onClose}>
						Cancel
					</Button>
					<Button
						onClick={() => {
							/* Handle save logic */ onClose()
						}}
					>
						Save Changes
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	)
}
