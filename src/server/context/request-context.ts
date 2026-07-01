import 'server-only'

import { cache } from 'react'
import type { User } from '@supabase/supabase-js'
import { getActiveTeam, type TeamMembership } from '@/lib/supabase/team'
import { getProfile, getSessionUser } from '@/lib/supabase/session'

export type RequestContextRole = 'guest' | 'member' | 'admin' | 'owner'

export type RequestContextProfile = {
  id: string
  name: string | null
  avatar_url: string | null
}

export type RequestContext = {
  user: User
  profile: RequestContextProfile | null
  activeTeamId: string | null
  activeTeamName: string | null
  membership: TeamMembership | null
  memberships: TeamMembership[]
  role: RequestContextRole
}

function toRequestContextRole(membership: TeamMembership | null): RequestContextRole {
  if (!membership) return 'guest'
  return membership.role
}

export const getRequestContext = cache(async (): Promise<RequestContext | null> => {
  const user = await getSessionUser()
  if (!user) return null

  const [profile, activeTeam] = await Promise.all([
    getProfile(user.id),
    getActiveTeam(user.id),
  ])

  const membership =
    activeTeam.memberships.find(item => item.team_id === activeTeam.activeTeamId)
    ?? null

  return {
    user,
    profile: profile as RequestContextProfile | null,
    activeTeamId: activeTeam.activeTeamId,
    activeTeamName: activeTeam.activeTeamName,
    membership,
    memberships: activeTeam.memberships,
    role: toRequestContextRole(membership),
  }
})
