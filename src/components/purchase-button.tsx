"use client"

import { toast } from "sonner"
import ShinyButton from "@/components/ui/shiny-button"
import { useServerAction } from "zsa-react"
import { purchaseAction } from "@/app/(dashboard)/dashboard/marketplace/purchase.action"
import type { PURCHASABLE_ITEM_TYPE } from "@/db/schema"
import { useRouter } from "next/navigation"

interface PurchaseButtonProps {
  itemId: string
  itemType: keyof typeof PURCHASABLE_ITEM_TYPE
}

export default function PurchaseButton({ itemId, itemType }: PurchaseButtonProps) {
  const router = useRouter()

  const { execute: handlePurchase, isPending } = useServerAction(purchaseAction, {
    onError: (error) => {
      toast.dismiss();
      toast.error(error.err?.message || "Failed to purchase item")
    },
    onStart: () => {
      toast.loading("Processing purchase...")
    },
    onSuccess: () => {
      toast.dismiss()
      toast.success("Item purchased successfully!")
    },
  })

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
