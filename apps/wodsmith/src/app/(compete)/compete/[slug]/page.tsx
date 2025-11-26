import { Calendar, CheckCircle2, MapPin, Trophy, Users } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { getCompetition, getCompetitionRegistrations, getUserCompetitionRegistration } from "@/server/competitions"
import { parseCompetitionSettings } from "@/types/competitions"
import { getSessionFromCookie } from "@/utils/auth"

type Props = {
	params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const { slug } = await params
	const competition = await getCompetition(slug)

	if (!competition) {
		return {
			title: "Competition Not Found",
		}
	}

	return {
		title: `${competition.name} - Compete`,
		description: competition.description || `Register for ${competition.name}`,
		openGraph: {
			type: "website",
			title: competition.name,
			description: competition.description || `Register for ${competition.name}`,
			images: [
				{
					url: `/api/og?title=${encodeURIComponent(competition.name)}`,
					width: 1200,
					height: 630,
					alt: competition.name,
				},
			],
		},
	}
}

function formatDate(date: Date | number | null): string {
	if (!date) return "TBA"
	const d = typeof date === "number" ? new Date(date) : date
	return d.toLocaleDateString("en-US", {
		weekday: "long",
		month: "long",
		day: "numeric",
		year: "numeric",
	})
}

function formatDateTime(date: Date | number | null): string {
	if (!date) return "TBA"
	const d = typeof date === "number" ? new Date(date) : date
	return d.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "numeric",
		minute: "2-digit",
	})
}

export default async function CompetitionDetailPage({ params }: Props) {
	const { slug } = await params
	const competition = await getCompetition(slug)

	if (!competition) {
		notFound()
	}

	// Get current user session
	const session = await getSessionFromCookie()

	// Check if user is already registered
	let userRegistration = null
	if (session) {
		userRegistration = await getUserCompetitionRegistration(
			competition.id,
			session.userId,
		)
	}

	// Get competition settings to check divisions
	const settings = parseCompetitionSettings(competition.settings)

	// Get registration count
	const registrations = await getCompetitionRegistrations(competition.id)
	const registrationCount = registrations.length

	// Check registration status
	const now = new Date()
	const regOpensAt = competition.registrationOpensAt
		? typeof competition.registrationOpensAt === "number"
			? new Date(competition.registrationOpensAt)
			: competition.registrationOpensAt
		: null
	const regClosesAt = competition.registrationClosesAt
		? typeof competition.registrationClosesAt === "number"
			? new Date(competition.registrationClosesAt)
			: competition.registrationClosesAt
		: null

	const registrationOpen = !!(regOpensAt && regClosesAt && regOpensAt <= now && regClosesAt >= now)
	const registrationClosed = !!(regClosesAt && regClosesAt < now)
	const registrationNotYetOpen = !!(regOpensAt && regOpensAt > now)

	return (
		<div className="mx-auto max-w-4xl space-y-8">
			{/* Header */}
			<div className="space-y-4">
				<div className="flex items-start justify-between gap-4">
					<div className="space-y-2">
						<h1 className="text-4xl font-bold">{competition.name}</h1>
						{competition.group && (
							<p className="text-muted-foreground text-lg">{competition.group.name}</p>
						)}
					</div>
					{userRegistration && (
						<Badge variant="default" className="flex items-center gap-1">
							<CheckCircle2 className="h-3 w-3" />
							Registered
						</Badge>
					)}
				</div>

				<div className="flex flex-wrap gap-4 text-sm">
					<div className="flex items-center gap-2">
						<Calendar className="text-muted-foreground h-4 w-4" />
						<span>
							{formatDate(competition.startDate)} - {formatDate(competition.endDate)}
						</span>
					</div>
					<div className="flex items-center gap-2">
						<MapPin className="text-muted-foreground h-4 w-4" />
						<span>{competition.organizingTeam?.name || "TBA"}</span>
					</div>
					<div className="flex items-center gap-2">
						<Users className="text-muted-foreground h-4 w-4" />
						<span>{registrationCount} registered</span>
					</div>
				</div>
			</div>

			<Separator />

			{/* Description */}
			{competition.description && (
				<Card>
					<CardHeader>
						<CardTitle>About This Competition</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="whitespace-pre-wrap">{competition.description}</p>
					</CardContent>
				</Card>
			)}

			{/* Registration Info */}
			<Card>
				<CardHeader>
					<CardTitle>Registration Information</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					{regOpensAt && (
						<div>
							<p className="text-muted-foreground text-sm">Opens</p>
							<p className="font-medium">{formatDateTime(regOpensAt)}</p>
						</div>
					)}
					{regClosesAt && (
						<div>
							<p className="text-muted-foreground text-sm">Closes</p>
							<p className="font-medium">{formatDateTime(regClosesAt)}</p>
						</div>
					)}

					{userRegistration ? (
						<div className="bg-muted/50 rounded-lg border p-4 space-y-2">
							<p className="font-semibold flex items-center gap-2">
								<CheckCircle2 className="h-5 w-5 text-green-600" />
								You're Registered!
							</p>
							{userRegistration.division && (
								<p className="text-sm">
									Division: <span className="font-medium">{userRegistration.division.label}</span>
								</p>
							)}
							<p className="text-muted-foreground text-sm">
								Registered on {formatDate(userRegistration.registeredAt)}
							</p>
						</div>
					) : (
						<div className="space-y-4">
							{registrationNotYetOpen && (
								<div className="bg-muted/50 rounded-lg border p-4">
									<p className="text-sm">
										Registration opens {formatDateTime(regOpensAt)}
									</p>
								</div>
							)}
							{registrationClosed && (
								<div className="bg-destructive/10 rounded-lg border border-destructive/20 p-4">
									<p className="text-sm">Registration is closed</p>
								</div>
							)}
							{registrationOpen && session && (
								<Button asChild size="lg" className="w-full">
									<Link href={`/compete/${slug}/register`}>
										<Trophy className="mr-2 h-4 w-4" />
										Register Now
									</Link>
								</Button>
							)}
							{registrationOpen && !session && (
								<div className="space-y-2">
									<Button asChild size="lg" className="w-full">
										<Link href={`/sign-in?redirect=/compete/${slug}/register`}>
											Sign In to Register
										</Link>
									</Button>
									<p className="text-muted-foreground text-center text-sm">
										Don't have an account?{" "}
										<Link href={`/sign-up?redirect=/compete/${slug}/register`} className="underline">
											Sign up
										</Link>
									</p>
								</div>
							)}
						</div>
					)}
				</CardContent>
			</Card>

			{/* Divisions */}
			{settings?.divisions?.scalingGroupId && (
				<Card>
					<CardHeader>
						<CardTitle>Divisions</CardTitle>
						<CardDescription>
							Select your division when you register
						</CardDescription>
					</CardHeader>
					<CardContent>
						<p className="text-muted-foreground text-sm">
							Divisions are configured for this competition. You'll choose your division during registration.
						</p>
					</CardContent>
				</Card>
			)}

			{/* Organizing Team Info */}
			{competition.organizingTeam && (
				<Card>
					<CardHeader>
						<CardTitle>Hosted By</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="flex items-center gap-3">
							{competition.organizingTeam.avatarUrl && (
								<div className="h-12 w-12 rounded-full overflow-hidden">
									<img
										src={competition.organizingTeam.avatarUrl}
										alt={competition.organizingTeam.name}
										className="h-full w-full object-cover"
									/>
								</div>
							)}
							<div>
								<p className="font-semibold">{competition.organizingTeam.name}</p>
							</div>
						</div>
					</CardContent>
				</Card>
			)}
		</div>
	)
}
