"use client"

import { purchaseAction } from "@/app/(dashboard)/dashboard/marketplace/purchase.action"
import ShinyButton from "@/components/ui/shiny-button"
import type { PURCHASABLE_ITEM_TYPE } from "@/db/schema"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useServerAction } from "zsa-react"

interface PurchaseButtonProps {
	itemId: string
	itemType: keyof typeof PURCHASABLE_ITEM_TYPE
}

export default function PurchaseButton({
	itemId,
	itemType,
}: PurchaseButtonProps) {
	const router = useRouter()

	const { execute: handlePurchase, isPending } = useServerAction(
		purchaseAction,
		{
			onError: (error) => {
				toast.dismiss()
				toast.error(error.err?.message || "Failed to purchase item")
			},
			onStart: () => {
				toast.loading("Processing purchase...")
			},
			onSuccess: () => {
				toast.dismiss()
				toast.success("Item purchased successfully!")
			},
		},
	)

	return (
		<ShinyButton
			onClick={() => {
				handlePurchase({ itemId, itemType }).then(() => {
					router.refresh()
				})
			}}
			disabled={isPending}
		>
			{isPending ? "Processing..." : "Purchase"}
		</ShinyButton>
	)
}
