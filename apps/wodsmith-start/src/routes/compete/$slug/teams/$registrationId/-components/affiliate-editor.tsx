"use client"

import { useServerFn } from "@tanstack/react-start"
import { Check, Loader2, Pencil, X } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { AffiliateCombobox } from "@/components/registration/affiliate-combobox"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import { updateRegistrationAffiliateFn } from "@/server-fns/registration-fns"

type Props = {
	registrationId: string
	userId: string
	currentAffiliate: string | null
	canEdit: boolean
}

export function AffiliateEditor({
	registrationId,
	userId,
	currentAffiliate,
	canEdit,
}: Props) {
	const [isEditing, setIsEditing] = useState(false)
	const [value, setValue] = useState(currentAffiliate || "")
	const [savedAffiliate, setSavedAffiliate] = useState(currentAffiliate)
	const [isPending, setIsPending] = useState(false)

	const updateAffiliate = useServerFn(updateRegistrationAffiliateFn)

	const handleSave = async () => {
		setIsPending(true)
		try {
			await updateAffiliate({
				data: {
					registrationId,
					userId,
					affiliateName: value.trim() || null,
				},
			})
			setSavedAffiliate(value.trim() || null)
			toast.success("Affiliate updated!")
			setIsEditing(false)
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : "Failed to update affiliate",
			)
		} finally {
			setIsPending(false)
		}
	}

	const handleCancel = () => {
		setValue(savedAffiliate || "")
		setIsEditing(false)
	}

	const displayValue = savedAffiliate || "Independent"

	return (
		<Card>
			<CardHeader>
				<CardTitle>My Affiliate</CardTitle>
				<CardDescription>Your gym or affiliate</CardDescription>
			</CardHeader>
			<CardContent>
				{isEditing ? (
					<div className="space-y-3">
						<AffiliateCombobox
							value={value}
							onChange={setValue}
							placeholder="Search or enter affiliate..."
							disabled={isPending}
						/>
						<div className="flex items-center gap-2">
							<Button size="sm" onClick={handleSave} disabled={isPending}>
								{isPending ? (
									<Loader2 className="w-4 h-4 mr-1 animate-spin" />
								) : (
									<Check className="w-4 h-4 mr-1" />
								)}
								Save
							</Button>
							<Button
								size="sm"
								variant="outline"
								onClick={handleCancel}
								disabled={isPending}
							>
								<X className="w-4 h-4 mr-1" />
								Cancel
							</Button>
						</div>
						<p className="text-xs text-muted-foreground">
							Leave empty and save to set as Independent
						</p>
					</div>
				) : (
					<div className="flex items-center justify-between">
						<span className="font-medium">{displayValue}</span>
						{canEdit && (
							<Button
								variant="ghost"
								size="sm"
								onClick={() => setIsEditing(true)}
							>
								<Pencil className="w-4 h-4 mr-1" />
								Edit
							</Button>
						)}
					</div>
				)}
			</CardContent>
		</Card>
	)
}
