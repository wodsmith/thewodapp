"use server";

import { z } from "zod";
import { createServerAction } from "@repo/zsa";
import {
  checkCanCreateTeam,
  checkCanInviteMember,
  checkCanCreateProgrammingTrack,
} from "@/server/entitlements-checks";

/**
 * Check if user can create more teams
 */
export const checkCanCreateTeamAction = createServerAction().handler(
  async () => {
    const result = await checkCanCreateTeam();
    return { success: true, data: result };
  }
);

/**
 * Check if team can invite more members
 */
export const checkCanInviteMemberAction = createServerAction()
  .input(
    z.object({
      teamId: z.string().min(1, "Team ID is required"),
    })
  )
  .handler(async ({ input }) => {
    const result = await checkCanInviteMember(input.teamId);
    return { success: true, data: result };
  });

/**
 * Check if team can create more programming tracks
 */
export const checkCanCreateProgrammingTrackAction = createServerAction()
  .input(
    z.object({
      teamId: z.string().min(1, "Team ID is required"),
    })
  )
  .handler(async ({ input }) => {
    const result = await checkCanCreateProgrammingTrack(input.teamId);
    return { success: true, data: result };
  });
