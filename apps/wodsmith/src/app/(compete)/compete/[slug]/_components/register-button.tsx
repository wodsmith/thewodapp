import { CheckCircle2 } from "lucide-react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

interface RegisterButtonProps {
	slug: string
	isLoggedIn: boolean
	isRegistered: boolean
	registrationOpen: boolean
	registrationClosed: boolean
	registrationNotYetOpen: boolean
}

export function RegisterButton({
	slug,
	isLoggedIn,
	isRegistered,
	registrationOpen,
	registrationClosed,
	registrationNotYetOpen,
}: RegisterButtonProps) {
	if (isRegistered) {
		return (
			<Badge variant="default" className="bg-green-600 hover:bg-green-600 gap-1">
				<CheckCircle2 className="h-3 w-3" />
				Registered
			</Badge>
		)
	}

	if (registrationClosed) {
		return (
			<Button variant="outline" size="sm" disabled>
				Registration Closed
			</Button>
		)
	}

	if (registrationNotYetOpen) {
		return (
			<Button variant="outline" size="sm" disabled>
				Coming Soon
			</Button>
		)
	}

	if (registrationOpen) {
		if (isLoggedIn) {
			return (
				<Button asChild size="sm" className="bg-teal-600 hover:bg-teal-500">
					<Link href={`/compete/${slug}/register`}>
						Register →
					</Link>
				</Button>
			)
		}

		return (
			<Button asChild size="sm" className="bg-teal-600 hover:bg-teal-500">
				<Link href={`/sign-in?redirect=/compete/${slug}/register`}>
					Sign In to Register
				</Link>
			</Button>
		)
	}

	return null
}
