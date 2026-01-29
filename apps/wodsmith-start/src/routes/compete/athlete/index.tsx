import { createFileRoute, Link } from "@tanstack/react-router"
import {
	Calendar,
	Edit,
	ExternalLink,
	Facebook,
	Instagram,
	MapPin,
	Pencil,
	Receipt,
	Trophy,
	Twitter,
	Users,
} from "lucide-react"
import { isSameUTCDay } from "@/utils/date-utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { getAthleteProfileDataFn } from "@/server-fns/athlete-profile-fns"

export const Route = createFileRoute("/compete/athlete/")({
	component: AthleteProfilePage,
	loader: async () => {
		return await getAthleteProfileDataFn()
	},
})

// ============================================================================
// Helper Functions
// ============================================================================

type AthleteProfileData = {
	coverImageUrl?: string
	preferredUnits?: "imperial" | "metric"
	heightCm?: number
	weightKg?: number
	conditioning?: {
		fran?: { time?: string; date?: string }
		grace?: { time?: string; date?: string }
		helen?: { time?: string; date?: string }
		diane?: { time?: string; date?: string }
		murph?: { time?: string; date?: string }
		maxCindyRounds?: { rounds?: string; date?: string }
		row2k?: { time?: string; date?: string }
		run1Mile?: { time?: string; date?: string }
		run5k?: { time?: string; date?: string }
		row500m?: { time?: string; date?: string }
		maxPullups?: { reps?: string; date?: string }
	}
	strength?: {
		backSquat?: { weight?: number; unit?: "kg" | "lbs"; date?: string }
		deadlift?: { weight?: number; unit?: "kg" | "lbs"; date?: string }
		benchPress?: { weight?: number; unit?: "kg" | "lbs"; date?: string }
		press?: { weight?: number; unit?: "kg" | "lbs"; date?: string }
		snatch?: { weight?: number; unit?: "kg" | "lbs"; date?: string }
		cleanAndJerk?: { weight?: number; unit?: "kg" | "lbs"; date?: string }
	}
	social?: {
		facebook?: string
		instagram?: string
		twitter?: string
		tiktok?: string
	}
}

function parseAthleteProfile(json: string | null): AthleteProfileData | null {
	if (!json) return null
	try {
		return JSON.parse(json) as AthleteProfileData
	} catch {
		return null
	}
}

function calculateAge(
	dateOfBirth: Date | number | string | null,
): number | null {
	if (!dateOfBirth) return null
	const dob = new Date(dateOfBirth)
	if (Number.isNaN(dob.getTime())) return null
	const today = new Date()
	let age = today.getFullYear() - dob.getFullYear()
	const monthDiff = today.getMonth() - dob.getMonth()
	if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
		age--
	}
	return age
}

function formatHeight(
	heightCm: number | undefined,
	units: "imperial" | "metric",
): string {
	if (!heightCm) return "Not set"
	if (units === "metric") return `${heightCm} cm`
	const totalInches = Math.round(heightCm / 2.54)
	const feet = Math.floor(totalInches / 12)
	const inches = totalInches % 12
	return `${feet}'${inches}"`
}

function formatWeight(
	weightKg: number | undefined,
	units: "imperial" | "metric",
): string {
	if (!weightKg) return "Not set"
	if (units === "metric") return `${weightKg} kg`
	return `${Math.round(weightKg * 2.205)} lbs`
}

function formatLiftWeight(
	weight: number,
	unit: "kg" | "lbs",
	preferredUnits: "imperial" | "metric",
): string {
	if (preferredUnits === "metric") {
		if (unit === "lbs") {
			return `${Math.round(weight / 2.205)} kg`
		}
		return `${weight} kg`
	}
	if (unit === "kg") {
		return `${Math.round(weight * 2.205)} lbs`
	}
	return `${weight} lbs`
}

function formatDate(date: Date | number | string | null): string {
	if (!date) return "TBA"
	const d = new Date(date)
	if (Number.isNaN(d.getTime())) return "Invalid Date"
	return d.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	})
}

// ============================================================================
// Component
// ============================================================================

function AthleteProfilePage() {
	const { user, sponsors, competitionHistory } = Route.useLoaderData()

	const athleteProfile = parseAthleteProfile(user.athleteProfile)
	const age = calculateAge(user.dateOfBirth)
	const fullName = `${user.firstName || ""} ${user.lastName || ""}`.trim()
	const initials =
		`${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase()
	const preferredUnits = athleteProfile?.preferredUnits || "imperial"

	// Cover image background style
	const coverImage = athleteProfile?.coverImageUrl
	const backgroundStyle = coverImage
		? {
				backgroundImage: `url(${coverImage})`,
				backgroundSize: "cover",
				backgroundPosition: "center",
			}
		: {
				background:
					"linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.5) 100%)",
			}

	return (
		<div className="mx-auto max-w-4xl space-y-8 pb-12">
			{/* Header with cover image and avatar */}
			<div className="relative">
				<div
					className="h-48 w-full rounded-lg sm:h-64"
					style={backgroundStyle}
				/>
				<div className="container mx-auto px-4">
					<div className="relative -mt-16 sm:-mt-20">
						<Avatar className="border-background h-32 w-32 border-4 sm:h-40 sm:w-40">
							<AvatarImage src={user.avatar || undefined} alt={fullName} />
							<AvatarFallback className="text-2xl sm:text-4xl">
								{initials}
							</AvatarFallback>
						</Avatar>
						<div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
							<div>
								<h1 className="text-3xl font-bold sm:text-4xl">{fullName}</h1>
								{user.affiliateName && (
									<p className="text-muted-foreground mt-1 text-lg">
										{user.affiliateName}
									</p>
								)}
								{age !== null && (
									<p className="text-muted-foreground mt-1">{age} years old</p>
								)}
							</div>
							<div className="flex gap-2">
								<Button asChild variant="outline" size="sm">
									<Link to="/compete/athlete/invoices">
										<Receipt className="mr-2 h-4 w-4" />
										Invoices
									</Link>
								</Button>
								<Button asChild variant="outline" size="sm">
									<Link to="/compete/athlete/edit">
										<Edit className="mr-2 h-4 w-4" />
										Edit Profile
									</Link>
								</Button>
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Stats Section */}
			<div className="grid gap-4 sm:grid-cols-3">
				<Card>
					<CardContent className="pt-6">
						<div className="text-center">
							<p className="text-muted-foreground text-sm font-medium">Age</p>
							<p className="mt-2 text-2xl font-bold">
								{age !== null ? `${age} y.o.` : "Not set"}
							</p>
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="pt-6">
						<div className="text-center">
							<p className="text-muted-foreground text-sm font-medium">
								Height
							</p>
							<p className="mt-2 text-2xl font-bold">
								{formatHeight(athleteProfile?.heightCm, preferredUnits)}
							</p>
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="pt-6">
						<div className="text-center">
							<p className="text-muted-foreground text-sm font-medium">
								Weight
							</p>
							<p className="mt-2 text-2xl font-bold">
								{formatWeight(athleteProfile?.weightKg, preferredUnits)}
							</p>
						</div>
					</CardContent>
				</Card>
			</div>

			<Separator />

			{/* Competitive History */}
			<CompetitiveHistory registrations={competitionHistory} />

			<Separator />

			{/* Benchmark Stats */}
			<BenchmarkStats
				athleteProfile={athleteProfile}
				preferredUnits={preferredUnits}
			/>

			<Separator />

			{/* Sponsors & Social */}
			<SponsorsSocial athleteProfile={athleteProfile} sponsors={sponsors} />
		</div>
	)
}

// ============================================================================
// Sub-components
// ============================================================================

// Registration type is inferred from the loader data - using any[] for flexibility

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CompetitiveHistory({ registrations }: { registrations: any[] }) {
	if (registrations.length === 0) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Competitive History</CardTitle>
					<CardDescription>
						Your competition participation history
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="text-muted-foreground flex flex-col items-center justify-center py-12 text-center">
						<Trophy className="mb-4 h-12 w-12 opacity-20" />
						<p className="text-lg font-medium">No competitions yet</p>
						<p className="mt-1 text-sm">
							Register for a competition to start building your competitive
							history
						</p>
						<Button asChild className="mt-4">
							<Link to="/compete">Browse Competitions</Link>
						</Button>
					</div>
				</CardContent>
			</Card>
		)
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Competitive History</CardTitle>
				<CardDescription>
					{registrations.length}{" "}
					{registrations.length === 1 ? "competition" : "competitions"}
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="space-y-4">
					{registrations.map((registration) => {
						if (!registration.competition) return null
						const isTeamRegistration =
							(registration.division?.teamSize ?? 1) > 1

						return (
							<div
								key={registration.id}
								className="border-b last:border-b-0 pb-4 last:pb-0"
							>
								<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
									<div className="flex-1">
										<h3 className="font-semibold">
											<Link
												to="/compete/$slug"
												params={{ slug: registration.competition.slug }}
												className="hover:underline"
											>
												{registration.competition.name}
											</Link>
										</h3>
										{isTeamRegistration &&
											(registration.teamName ||
												registration.athleteTeam?.name) && (
												<p className="text-sm text-muted-foreground mt-1">
													<Users className="inline h-3 w-3 mr-1" />
													{registration.teamName ||
														registration.athleteTeam?.name}
												</p>
											)}
										<div className="mt-2 flex flex-wrap gap-3 text-sm">
											<div className="text-muted-foreground flex items-center gap-1">
												<Calendar className="h-3 w-3" />
												<span>
													{isSameUTCDay(
														registration.competition.startDate,
														registration.competition.endDate,
													)
														? formatDate(registration.competition.startDate)
														: `${formatDate(registration.competition.startDate)} - ${formatDate(registration.competition.endDate)}`}
												</span>
											</div>
											{registration.division && (
												<Badge variant="outline">
													{registration.division.label}
												</Badge>
											)}
											{registration.competition.organizingTeam && (
												<div className="text-muted-foreground flex items-center gap-1">
													<MapPin className="h-3 w-3" />
													<span>
														{registration.competition.organizingTeam.name}
													</span>
												</div>
											)}
										</div>
									</div>
									<div className="flex gap-2">
										<Button asChild variant="outline" size="sm">
											<Link
												to="/compete/$slug"
												params={{ slug: registration.competition.slug }}
											>
												View Event
											</Link>
										</Button>
									</div>
								</div>
							</div>
						)
					})}
				</div>
			</CardContent>
		</Card>
	)
}

function BenchmarkStats({
	athleteProfile,
	preferredUnits,
}: {
	athleteProfile: AthleteProfileData | null
	preferredUnits: "imperial" | "metric"
}) {
	const conditioning = athleteProfile?.conditioning
	const strength = athleteProfile?.strength

	const formatConditioningValue = (
		value:
			| { time?: string; reps?: string; rounds?: string; date?: string }
			| undefined,
	): React.ReactNode => {
		if (!value || (!value.time && !value.reps && !value.rounds)) {
			return <span className="text-muted-foreground">Not recorded</span>
		}
		const displayValue = value.time || value.reps || value.rounds || "N/A"
		return (
			<div>
				<span className="font-semibold">{displayValue}</span>
				{value.date && (
					<span className="text-muted-foreground ml-2 text-sm">
						{new Date(value.date).toLocaleDateString()}
					</span>
				)}
			</div>
		)
	}

	const formatStrengthValue = (
		lift: { weight?: number; unit?: "kg" | "lbs"; date?: string } | undefined,
	): React.ReactNode => {
		if (!lift || !lift.weight) {
			return <span className="text-muted-foreground">Not recorded</span>
		}
		const unit = lift.unit || "lbs"
		return (
			<div>
				<span className="font-semibold">
					{formatLiftWeight(lift.weight, unit, preferredUnits)}
				</span>
				{lift.date && (
					<span className="text-muted-foreground ml-2 text-sm">
						{new Date(lift.date).toLocaleDateString()}
					</span>
				)}
			</div>
		)
	}

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle>Notable Metcons</CardTitle>
					<CardDescription>
						Personal bests for benchmark workouts
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="grid gap-4 sm:grid-cols-2">
						<div className="space-y-1">
							<p className="text-muted-foreground text-sm">Fran</p>
							{formatConditioningValue(conditioning?.fran)}
						</div>
						<div className="space-y-1">
							<p className="text-muted-foreground text-sm">Grace</p>
							{formatConditioningValue(conditioning?.grace)}
						</div>
						<div className="space-y-1">
							<p className="text-muted-foreground text-sm">Helen</p>
							{formatConditioningValue(conditioning?.helen)}
						</div>
						<div className="space-y-1">
							<p className="text-muted-foreground text-sm">Diane</p>
							{formatConditioningValue(conditioning?.diane)}
						</div>
						<div className="space-y-1">
							<p className="text-muted-foreground text-sm">Murph</p>
							{formatConditioningValue(conditioning?.murph)}
						</div>
						<div className="space-y-1">
							<p className="text-muted-foreground text-sm">Cindy</p>
							{formatConditioningValue(conditioning?.maxCindyRounds)}
						</div>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Conditioning Metcons</CardTitle>
					<CardDescription>
						Personal bests for other conditioning workouts
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="grid gap-4 sm:grid-cols-2">
						<div className="space-y-1">
							<p className="text-muted-foreground text-sm">2K Row</p>
							{formatConditioningValue(conditioning?.row2k)}
						</div>
						<div className="space-y-1">
							<p className="text-muted-foreground text-sm">1 Mile Run</p>
							{formatConditioningValue(conditioning?.run1Mile)}
						</div>
						<div className="space-y-1">
							<p className="text-muted-foreground text-sm">5K Run</p>
							{formatConditioningValue(conditioning?.run5k)}
						</div>
						<div className="space-y-1">
							<p className="text-muted-foreground text-sm">500m Row</p>
							{formatConditioningValue(conditioning?.row500m)}
						</div>
						<div className="space-y-1">
							<p className="text-muted-foreground text-sm">Max Pull-ups</p>
							{formatConditioningValue(conditioning?.maxPullups)}
						</div>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Strength Lifts</CardTitle>
					<CardDescription>One-rep max personal records</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="grid gap-4 sm:grid-cols-2">
						<div className="space-y-1">
							<p className="text-muted-foreground text-sm">Back Squat</p>
							{formatStrengthValue(strength?.backSquat)}
						</div>
						<div className="space-y-1">
							<p className="text-muted-foreground text-sm">Deadlift</p>
							{formatStrengthValue(strength?.deadlift)}
						</div>
						<div className="space-y-1">
							<p className="text-muted-foreground text-sm">Bench Press</p>
							{formatStrengthValue(strength?.benchPress)}
						</div>
						<div className="space-y-1">
							<p className="text-muted-foreground text-sm">Press</p>
							{formatStrengthValue(strength?.press)}
						</div>
						<div className="space-y-1">
							<p className="text-muted-foreground text-sm">Snatch</p>
							{formatStrengthValue(strength?.snatch)}
						</div>
						<div className="space-y-1">
							<p className="text-muted-foreground text-sm">Clean & Jerk</p>
							{formatStrengthValue(strength?.cleanAndJerk)}
						</div>
					</div>
				</CardContent>
			</Card>
		</div>
	)
}

type Sponsor = {
	id: string
	name: string
	logoUrl: string | null
	website: string | null
}

function SponsorsSocial({
	athleteProfile,
	sponsors,
}: {
	athleteProfile: AthleteProfileData | null
	sponsors: Sponsor[]
}) {
	const social = athleteProfile?.social
	const hasSocialLinks =
		social?.facebook || social?.instagram || social?.twitter || social?.tiktok
	const hasSponsors = sponsors && sponsors.length > 0

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle>Social Networks</CardTitle>
					<CardDescription>Connect on social media</CardDescription>
				</CardHeader>
				<CardContent>
					{hasSocialLinks ? (
						<div className="flex flex-wrap gap-3">
							{social?.instagram && (
								<Button asChild variant="outline" size="sm">
									<a
										href={social.instagram}
										target="_blank"
										rel="noopener noreferrer"
									>
										<Instagram className="mr-2 h-4 w-4" />
										Instagram
									</a>
								</Button>
							)}
							{social?.facebook && (
								<Button asChild variant="outline" size="sm">
									<a
										href={social.facebook}
										target="_blank"
										rel="noopener noreferrer"
									>
										<Facebook className="mr-2 h-4 w-4" />
										Facebook
									</a>
								</Button>
							)}
							{social?.twitter && (
								<Button asChild variant="outline" size="sm">
									<a
										href={social.twitter}
										target="_blank"
										rel="noopener noreferrer"
									>
										<Twitter className="mr-2 h-4 w-4" />
										Twitter
									</a>
								</Button>
							)}
							{social?.tiktok && (
								<Button asChild variant="outline" size="sm">
									<a
										href={social.tiktok}
										target="_blank"
										rel="noopener noreferrer"
									>
										<ExternalLink className="mr-2 h-4 w-4" />
										TikTok
									</a>
								</Button>
							)}
						</div>
					) : (
						<p className="text-muted-foreground text-sm">
							No social networks added yet
						</p>
					)}
				</CardContent>
			</Card>

			<Card>
				<CardHeader className="flex flex-row items-center justify-between space-y-0">
					<div className="space-y-1.5">
						<CardTitle>Sponsors</CardTitle>
						<CardDescription>Supporting brands and partners</CardDescription>
					</div>
					<Button asChild variant="outline" size="sm">
						<Link to="/compete/athlete/sponsors">
							<Pencil className="mr-2 h-4 w-4" />
							Manage
						</Link>
					</Button>
				</CardHeader>
				<CardContent>
					{hasSponsors ? (
						<div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
							{sponsors.map((sponsor) => (
								<div
									key={sponsor.id}
									className="border-muted flex flex-col items-center gap-2 rounded-lg border p-4 text-center"
								>
									{sponsor.logoUrl ? (
										<img
											src={sponsor.logoUrl}
											alt={sponsor.name}
											className="h-16 w-auto object-contain"
										/>
									) : (
										<div className="flex h-16 items-center">
											<p className="font-semibold">{sponsor.name}</p>
										</div>
									)}
									{sponsor.website && (
										<Button
											asChild
											variant="link"
											size="sm"
											className="h-auto p-0"
										>
											<a
												href={sponsor.website}
												target="_blank"
												rel="noopener noreferrer"
												className="text-xs"
											>
												Visit Website
											</a>
										</Button>
									)}
								</div>
							))}
						</div>
					) : (
						<p className="text-muted-foreground text-sm">
							No sponsors added yet
						</p>
					)}
				</CardContent>
			</Card>
		</div>
	)
}
