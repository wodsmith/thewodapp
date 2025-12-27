'use client'

import {useNavigate, useSearch} from '@tanstack/react-router'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface OrganizingTeam {
  id: string
  name: string
}

interface TeamFilterProps {
  teams: OrganizingTeam[]
  selectedTeamId: string
}

export function TeamFilter({teams, selectedTeamId}: TeamFilterProps) {
  const navigate = useNavigate()
  const searchParams = useSearch({strict: false}) as any

  const handleTeamChange = async (teamId: string) => {
    // Build new search params
    const newParams = {...searchParams}
    newParams.teamId = teamId
    // Reset group filter when changing teams
    delete newParams.groupId

    navigate({
      to: '/compete/organizer',
      search: newParams as any,
    })
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">Organizing as:</span>
      <Select value={selectedTeamId} onValueChange={handleTeamChange}>
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Select team" />
        </SelectTrigger>
        <SelectContent>
          {teams.map((team) => (
            <SelectItem key={team.id} value={team.id}>
              {team.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
