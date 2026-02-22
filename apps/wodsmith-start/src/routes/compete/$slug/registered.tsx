import {
	createFileRoute,
	getRouteApi,
	Link,
	redirect,
	useRouter,
} from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { Loader2 } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { z } from "zod"
import { CompetitionRegisteredBanner } from "@/components/competition-registered-banner"
import { CompetitionShareCard } from "@/components/competition-share-card"
import { CompetitionTabs } from "@/components/competition-tabs"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
	getRegistrationPurchaseStatusFn,
	getUserCompetitionRegistrationFn,
} from "@/server-fns/competition-detail-fns"
import { getUserAffiliateNameFn } from "@/server-fns/registration-fns"

const parentRoute = getRouteApi("/compete/$slug")

export const Route = createFileRoute("/compete/$slug/registered")({
	component: RegisteredPage,
	validateSearch: z.object({
		session_id: z.string().optional(),
		registration_id: z.string().optional(),
	}),
	loaderDeps: ({ search }) => ({ session_id: search.session_id }),
	loader: async ({ params, context, deps, parentMatchPromise }) => {
		const { slug } = params
		const session = context?.session ?? null

		if (!session) {
			throw redirect({
				to: "/sign-in",
				search: { redirect: `/compete/${slug}` },
			})
		}

		const parentMatch = await parentMatchPromise
		const competition = parentMatch.loaderData?.competition
		const divisions = parentMatch.loaderData?.divisions ?? []
		if (!competition) {
			throw redirect({ to: "/compete" })
		}

		const [{ registration }, affiliateResult] = await Promise.all([
			getUserCompetitionRegistrationFn({
				data: {
					competitionId: competition.id,
					userId: session.userId,
				},
			}),
			getUserAffiliateNameFn({
				data: { userId: session.userId },
			}),
		])

		if (!registration) {
			// If we arrived here from Stripe checkout, the workflow may still be processing.
			// Check for a pending purchase instead of redirecting away.
			if (deps.session_id) {
				const { status } = await getRegistrationPurchaseStatusFn({
					data: {
						competitionId: competition.id,
						userId: session.userId,
					},
				})

				if (status === "processing") {
					return {
						pending: true as const,
						athleteName: `${session.user.firstName} ${session.user.lastName}`,
						divisionLabel: null,
						affiliateName: affiliateResult.affiliateName ?? "Independent",
						registrationId: null,
						competitionId: competition.id,
						userId: session.userId,
					}
				}
			}

			throw redirect({
				to: "/compete/$slug",
				params: { slug },
			})
		}

		const userDivision = registration.divisionId
			? divisions.find((d) => d.id === registration.divisionId)
			: null

		return {
			pending: false as const,
			athleteName: `${session.user.firstName} ${session.user.lastName}`,
			divisionLabel: userDivision?.label ?? null,
			affiliateName: affiliateResult.affiliateName ?? "Independent",
			registrationId: registration.id,
			competitionId: competition.id,
			userId: session.userId,
		}
	},
})

const POLL_INTERVAL_MS = 3000
const MAX_POLL_ATTEMPTS = 40 // ~2 minutes of polling

function RegisteredPage() {
	const { competition } = parentRoute.useLoaderData()
	const loaderData = Route.useLoaderData()
	const { slug } = Route.useParams()
	const router = useRouter()
	const checkStatus = useServerFn(getRegistrationPurchaseStatusFn)

	const [polling, setPolling] = useState(loaderData.pending)
	const pollCount = useRef(0)

	useEffect(() => {
		if (!polling) return

		const interval = setInterval(async () => {
			pollCount.current += 1

			if (pollCount.current >= MAX_POLL_ATTEMPTS) {
				setPolling(false)
				clearInterval(interval)
				return
			}

			const { status } = await checkStatus({
				data: {
					competitionId: loaderData.competitionId,
					userId: loaderData.userId,
				},
			})

			if (status === "registered") {
				setPolling(false)
				clearInterval(interval)
				// Re-run the loader to get full registration data
				router.invalidate()
			}
		}, POLL_INTERVAL_MS)

		return () => clearInterval(interval)
	}, [
		polling,
		checkStatus,
		loaderData.competitionId,
		loaderData.userId,
		router,
	])

	if (loaderData.pending) {
		return (
			<div className="space-y-4">
				<div className="sticky top-4 z-10">
					<CompetitionTabs slug={competition.slug} />
				</div>

				<div className="mx-auto max-w-lg py-12 px-4">
					<Card>
						<CardHeader className="text-center">
							<Loader2 className="w-12 h-12 text-blue-500 mx-auto mb-4 animate-spin" />
							<CardTitle className="text-xl">
								Finalizing Your Registration...
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4 text-center">
							<p className="text-muted-foreground">
								Your payment was successful! We're finishing up the registration
								process.
							</p>
							<p className="text-sm text-muted-foreground">
								This page will update automatically once your registration is
								confirmed.
							</p>
							{!polling && (
								<div className="pt-4">
									<Button
										variant="outline"
										onClick={() => {
											pollCount.current = 0
											setPolling(true)
										}}
									>
										Check Again
									</Button>
								</div>
							)}
						</CardContent>
					</Card>
				</div>
			</div>
		)
	}

	const { athleteName, divisionLabel, affiliateName, registrationId } =
		loaderData

	const profileImage =
		competition.profileImageUrl ?? competition.organizingTeam?.avatarUrl

	return (
		<div className="space-y-4">
			{/* Sticky Tabs */}
			<div className="sticky top-4 z-10">
				<CompetitionTabs slug={competition.slug} />
			</div>

			{/* Mobile: share card as full body content */}
			<div className="flex flex-col items-center gap-6 md:hidden">
				<CompetitionShareCard
					competitionName={competition.name}
					athleteName={athleteName}
					division={divisionLabel ?? undefined}
					affiliateName={affiliateName}
					competitionLogoUrl={profileImage ?? undefined}
				/>
				{registrationId && (
					<Button variant="ghost" size="sm" asChild className="text-slate-400">
						<Link
							to="/compete/$slug/teams/$registrationId"
							params={{ slug, registrationId }}
						>
							View Registration
						</Link>
					</Button>
				)}
			</div>

			{/* Desktop: banner with everything built in */}
			<div className="hidden flex-col items-center gap-6 md:flex">
				<CompetitionRegisteredBanner
					competitionName={competition.name}
					athleteName={athleteName}
					division={divisionLabel ?? undefined}
					affiliateName={affiliateName}
					competitionLogoUrl={profileImage ?? undefined}
				/>
				{registrationId && (
					<Button variant="ghost" size="sm" asChild className="text-slate-400">
						<Link
							to="/compete/$slug/teams/$registrationId"
							params={{ slug, registrationId }}
						>
							View Registration
						</Link>
					</Button>
				)}
			</div>
		</div>
	)
}
