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
			<Badge
				variant="default"
				className="bg-green-600 hover:bg-green-600 gap-1.5 py-1.5 px-3 text-sm"
			>
				<CheckCircle2 className="h-4 w-4" />
				Registered
			</Badge>
		)
	}

	if (registrationClosed) {
		return (
			<Button variant="outline" disabled className="hidden lg:flex">
				Registration Closed
			</Button>
		)
	}

	if (registrationNotYetOpen) {
		return (
			<Button variant="outline" disabled className="hidden lg:flex">
				Coming Soon
			</Button>
		)
	}

	if (registrationOpen) {
		if (isLoggedIn) {
			return (
				<Button
					asChild
					className="bg-teal-600 hover:bg-teal-500 font-semibold hidden lg:flex"
				>
					<Link href={`/compete/${slug}/register`}>Register Now →</Link>
				</Button>
			)
		}

		return (
			<Button
				asChild
				className="bg-teal-600 hover:bg-teal-500 font-semibold hidden lg:flex"
			>
				<Link href={`/sign-in?redirect=/compete/${slug}/register`}>
					Sign In to Register
				</Link>
			</Button>
		)
	}

	return null
}
