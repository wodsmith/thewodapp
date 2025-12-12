import { createFileRoute, redirect } from '@tanstack/react-router'
import type { Team } from '~/db/schema.server'
import { getUserTeamsAction } from '~/server-functions/team'

export const Route = createFileRoute('/_settings/settings/teams')({
	component: TeamsPage,
})

async function TeamsPage() {
	const [result] = await getUserTeamsAction()
	if (!result || result.success === false) {
		throw redirect({ to: '/settings' })
	}
	const teams: Team[] = (
		Array.isArray(result.data) ? result.data.flat() : [result.data]
	).filter((t): t is Team => typeof t === 'object' && t !== null && 'slug' in t)
	if (!teams.length) {
		return <div className="p-8">You are not a member of any teams.</div>
	}
	const firstTeam = teams[0]
	if (firstTeam) {
		throw redirect({ to: `/settings/teams/${firstTeam.slug}` })
	}
	return <div className="p-8">You are not a member of any teams.</div>
}
