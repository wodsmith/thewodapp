"use client"

import { useState } from "react"
import { Pencil, X, Check, Loader2 } from "lucide-react"
import { useServerAction } from "@repo/zsa-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import { AffiliateCombobox } from "@/app/(compete)/compete/[slug]/register/_components/affiliate-combobox"
import { updateRegistrationAffiliateAction } from "@/actions/competition-actions"

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

	const { execute, isPending } = useServerAction(
		updateRegistrationAffiliateAction,
		{
			onSuccess: () => {
				toast.success("Affiliate updated!")
				setIsEditing(false)
			},
			onError: ({ err }) => {
				toast.error(err?.message || "Failed to update affiliate")
			},
		},
	)

	const handleSave = () => {
		execute({
			registrationId,
			userId,
			affiliateName: value.trim() || null,
		})
	}

	const handleCancel = () => {
		setValue(currentAffiliate || "")
		setIsEditing(false)
	}

	const displayValue = currentAffiliate || "Independent"

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<span>🏠</span>
					My Affiliate
				</CardTitle>
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
