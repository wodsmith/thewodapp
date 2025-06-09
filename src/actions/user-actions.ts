"use server";

import { createServerAction, ZSAError } from "zsa";
import { requireVerifiedEmail } from "@/utils/auth";
import { getUserFromDB } from "@/utils/auth";

/**
 * Get the current user's profile data
 */
export const getUserAction = createServerAction()
  .handler(async () => {
    try {
      // Get the current session and ensure user is authenticated
      const session = await requireVerifiedEmail();

      if (!session?.user?.id) {
        throw new ZSAError("NOT_AUTHORIZED", "Not authenticated");
      }

      // Get the user data from the database
      const user = await getUserFromDB(session.user.id);

      if (!user) {
        throw new ZSAError("NOT_FOUND", "User not found");
      }

      return { success: true, data: user };
    } catch (error) {
      console.error("Failed to get user:", error);

      if (error instanceof ZSAError) {
        throw error;
      }

      throw new ZSAError("INTERNAL_SERVER_ERROR", "Failed to get user");
    }
  });
