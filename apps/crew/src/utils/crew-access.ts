import type {CrewViewerRole} from '@/lib/crew/navigation'

export interface CrewViewerInput {
  role?: CrewViewerRole | null
  isWodsmithOperator?: boolean
  isDepartmentLead?: boolean
  isVolunteerPublic?: boolean
}

export interface CrewViewer {
  role: CrewViewerRole
  isWodsmithOperator: boolean
  isOrganizer: boolean
  isDepartmentLead: boolean
  isVolunteerPublic: boolean
}

export function resolveCrewViewer(input: CrewViewerInput = {}): CrewViewer {
  const role = resolveCrewViewerRole(input)

  return {
    role,
    isWodsmithOperator: role === 'wodsmith_operator',
    isOrganizer: role === 'organizer_admin',
    isDepartmentLead: role === 'department_lead',
    isVolunteerPublic: role === 'volunteer_public',
  }
}

export function resolveCrewViewerRole({
  role,
  isWodsmithOperator = false,
  isDepartmentLead = false,
  isVolunteerPublic = false,
}: CrewViewerInput = {}): CrewViewerRole {
  if (role) return role
  if (isWodsmithOperator) return 'wodsmith_operator'
  if (isDepartmentLead) return 'department_lead'
  if (isVolunteerPublic) return 'volunteer_public'

  return 'organizer_admin'
}