import 'server-only'

import { cache } from 'react'
import { cookies } from 'next/headers'
import { createClient } from './server'

export const ACTIVE_TEAM_COOKIE = 'edv2_active_team_id'

export type TeamRole = 'owner' | 'admin' | 'member'

export type TeamSummary = {
  id: string
  name: string
  owner_id: string | null
}

export type TeamMembership = {
  id: string
  team_id: string
  user_id: string
  role: TeamRole
  permissions: Record<string, unknown>
  created_at: string | null
  team: TeamSummary | null
}

export type ActiveTeamResult = {
  activeTeamId: string | null
  activeTeamName: string | null
  activeRole: TeamRole | null
  memberships: TeamMembership[]
}

type MembershipRow = {
  id: string
  team_id: string
  user_id: string
  role: string | null
  permissions: unknown
  created_at: string | null
}

type TeamRow = {
  id: string
  name: string
  owner_id: string | null
}

function toTeamRole(role: string | null): TeamRole {
  return role === 'owner' || role === 'admin' || role === 'member' ? role : 'member'
}

function toPermissions(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

export const getActiveTeam = cache(async (userId: string): Promise<ActiveTeamResult> => {
  if (!userId) {
    return { activeTeamId: null, activeTeamName: null, activeRole: null, memberships: [] }
  }

  const supabase = createClient()
  const requestedTeamId = cookies().get(ACTIVE_TEAM_COOKIE)?.value ?? null

  const { data: membershipRows } = await supabase
    .from('team_members')
    .select('id, team_id, user_id, role, permissions, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  const rows = (membershipRows ?? []) as MembershipRow[]
  const teamIds = Array.from(new Set(rows.map(row => row.team_id).filter(Boolean)))

  let teamsById = new Map<string, TeamSummary>()
  if (teamIds.length > 0) {
    const { data: teamRows } = await supabase
      .from('teams')
      .select('id, name, owner_id')
      .in('id', teamIds)

    teamsById = new Map(
      ((teamRows ?? []) as TeamRow[]).map(team => [team.id, team])
    )
  }

  const memberships: TeamMembership[] = rows.map(row => ({
    id: row.id,
    team_id: row.team_id,
    user_id: row.user_id,
    role: toTeamRole(row.role),
    permissions: toPermissions(row.permissions),
    created_at: row.created_at,
    team: teamsById.get(row.team_id) ?? null,
  }))

  const activeMembership =
    memberships.find(membership => membership.team_id === requestedTeamId)
    ?? memberships[0]
    ?? null

  return {
    activeTeamId: activeMembership?.team_id ?? null,
    activeTeamName: activeMembership?.team?.name ?? null,
    activeRole: activeMembership?.role ?? null,
    memberships,
  }
})
