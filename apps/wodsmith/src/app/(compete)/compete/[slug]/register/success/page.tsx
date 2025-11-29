import { redirect } from "next/navigation"
import Link from "next/link"
import { getSessionFromCookie } from "@/utils/auth"
import { getCompetition, getUserCompetitionRegistration } from "@/server/competitions"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle, Loader2 } from "lucide-react"

export default async function RegistrationSuccessPage({
	params,
}: {
	params: Promise<{ slug: string }>
}) {
	const { slug } = await params
	const session = await getSessionFromCookie()

	if (!session) {
		redirect(`/sign-in?redirect=/compete/${slug}`)
	}

	// Get competition
	const competition = await getCompetition(slug)
	if (!competition) {
		redirect("/compete")
	}

	// Check for registration
	const registration = await getUserCompetitionRegistration(
		competition.id,
		session.userId,
	)

	if (!registration) {
		// Payment may still be processing (webhook hasn't completed yet)
		return (
			<div className="mx-auto max-w-lg py-12 px-4">
				<Card>
					<CardHeader className="text-center">
						<Loader2 className="w-16 h-16 text-blue-500 mx-auto mb-4 animate-spin" />
						<CardTitle className="text-2xl">Processing Your Registration...</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4 text-center">
						<p className="text-muted-foreground">
							Your payment was successful! We&apos;re finalizing your registration.
						</p>
						<p className="text-sm text-muted-foreground">
							This usually takes just a few seconds. You&apos;ll receive a confirmation
							email shortly.
						</p>
						<div className="pt-4 flex flex-col gap-2">
							<Button variant="outline" asChild>
								<Link href={`/compete/${slug}`}>Back to Competition</Link>
							</Button>
							<Button
								variant="ghost"
								onClick={() => window.location.reload()}
								className="text-sm"
							>
								Refresh Page
							</Button>
						</div>
					</CardContent>
				</Card>
			</div>
		)
	}

	// Registration found - show success
	return (
		<div className="mx-auto max-w-lg py-12 px-4">
			<Card>
				<CardHeader className="text-center">
					<CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
					<CardTitle className="text-2xl">Registration Complete!</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4 text-center">
					<p>
						You&apos;re registered for <strong>{competition.name}</strong>
					</p>

					{registration.teamName && (
						<p className="text-muted-foreground">
							Team: <strong>{registration.teamName}</strong>
						</p>
					)}

					<div className="pt-4">
						<Button asChild>
							<Link href={`/compete/${slug}`}>View Competition</Link>
						</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	)
}
