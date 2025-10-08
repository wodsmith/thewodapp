/**
 * Server functions for checking entitlements in UI
 * These return structured data for UI display, not throwing errors
 */
import "server-only";

import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  SYSTEM_ROLES_ENUM,
  teamMembershipTable,
} from "@/db/schema";
import { requireVerifiedEmail } from "@/utils/auth";
import { LIMITS } from "@/config/limits";
import { PLANS } from "@/config/plans";
import { getTeamPlan } from "./entitlements";

export interface TeamLimitCheckResult {
  canCreate: boolean;
  currentCount: number;
  maxAllowed: number;
  isUnlimited: boolean;
  planName: string;
  message?: string;
}

/**
 * Check if the current user can create more teams
 * Returns structured data for UI display
 */
export async function checkCanCreateTeam(): Promise<TeamLimitCheckResult> {
  const session = await requireVerifiedEmail();
  if (!session) {
    return {
      canCreate: false,
      currentCount: 0,
      maxAllowed: 0,
      isUnlimited: false,
      planName: "Free",
      message: "You must be logged in to create teams",
    };
  }

  const db = getDb();

  // Get all teams where the user is owner via team_membership
  const ownedTeamMemberships = await db.query.teamMembershipTable.findMany({
    where: and(
      eq(teamMembershipTable.userId, session.userId),
      eq(teamMembershipTable.roleId, SYSTEM_ROLES_ENUM.OWNER),
      eq(teamMembershipTable.isSystemRole, 1)
    ),
    with: {
      team: true,
    },
  });

  // Filter out personal teams to count only non-personal teams
  const nonPersonalTeams = ownedTeamMemberships.filter(
    (membership) => !membership.team?.isPersonalTeam
  );

  // Get user's plan from their first team (personal or otherwise)
  const firstTeam = ownedTeamMemberships[0]?.team;
  let maxTeams = PLANS.FREE.entitlements.limits[LIMITS.MAX_TEAMS];
  let planName = "Free";

  if (firstTeam) {
    const userPlan = await getTeamPlan(firstTeam.id);
    maxTeams = userPlan.entitlements.limits[LIMITS.MAX_TEAMS];
    planName = userPlan.name;
  }

  const currentCount = nonPersonalTeams.length;
  const isUnlimited = maxTeams === -1;
  const canCreate = isUnlimited || currentCount < maxTeams;

  let message: string | undefined;
  if (!canCreate) {
    message = `You've reached your limit of ${maxTeams} team${maxTeams === 1 ? "" : "s"} on the ${planName} plan. Upgrade to create more teams.`;
  } else if (!isUnlimited) {
    message = `You have ${maxTeams - currentCount} team${maxTeams - currentCount === 1 ? "" : "s"} remaining on your ${planName} plan.`;
  }

  return {
    canCreate,
    currentCount,
    maxAllowed: maxTeams,
    isUnlimited,
    planName,
    message,
  };
}
