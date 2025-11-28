"use client"

import { Copy, Check } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

type Props = {
	token: string
	competitionSlug: string
}

export function CopyInviteLinkButton({ token, competitionSlug: _competitionSlug }: Props) {
	const [copied, setCopied] = useState(false)

	const handleCopy = async () => {
		const url = `${window.location.origin}/compete/invite/${token}`

		try {
			await navigator.clipboard.writeText(url)
			setCopied(true)
			toast.success("Invite link copied!")
			setTimeout(() => setCopied(false), 2000)
		} catch {
			toast.error("Failed to copy link")
		}
	}

	return (
		<Button variant="ghost" size="sm" onClick={handleCopy}>
			{copied ? (
				<Check className="w-4 h-4 text-green-500" />
			) : (
				<Copy className="w-4 h-4" />
			)}
		</Button>
	)
}
