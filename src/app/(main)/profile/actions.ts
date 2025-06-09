"use server";

import { createServerAction, ZSAError } from "zsa";
import { z } from "zod";
import { getDB } from "@/db";
import { userTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireVerifiedEmail } from "@/utils/auth";
import { updateAllSessionsOfUser } from "@/utils/kv-session";

const updateUserNameSchema = z.object({
	firstName: z.string().min(1, "First name is required").max(255, "First name is too long"),
});

/**
 * Update the current user's first name
 */
export const updateUserNameAction = createServerAction()
	.input(updateUserNameSchema)
	.handler(async ({ input }) => {
		try {
			// Get the current session and ensure user is authenticated
			const session = await requireVerifiedEmail();

			if (!session?.user?.id) {
				throw new ZSAError("NOT_AUTHORIZED", "Not authenticated");
			}

			const db = getDB();

			// Update the user's first name
			await db
				.update(userTable)
				.set({ firstName: input.firstName })
				.where(eq(userTable.id, session.user.id));

			// Update all sessions of the user to reflect the change
			await updateAllSessionsOfUser(session.user.id);

			// Revalidate the profile page to show the updated name
			revalidatePath("/profile");
			revalidatePath("/");

			return { success: true, message: "Name updated successfully." };
		} catch (error) {
			console.error("Failed to update user name:", error);

			if (error instanceof ZSAError) {
				throw error;
			}

			throw new ZSAError("INTERNAL_SERVER_ERROR", "Failed to update name");
		}
	});
