export interface ProgrammingTrackWithTeamSubscriptions {
  id: string
  name: string
  teamSubscriptions: { teamId: string; isSubscribed: boolean }[]
}

export async function getTracksWithSubscriptions(teamIds: string[]) {
  return []
}
