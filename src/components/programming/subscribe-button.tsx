"use client"

import { Button } from "@/components/ui/button"

interface SubscribeButtonProps {
	trackId: string
}

export function SubscribeButton(_props: SubscribeButtonProps) {
	return <Button size="sm">Subscribe</Button>
}
