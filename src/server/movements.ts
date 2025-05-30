import "server-only";
import { getDB } from "@/db";
import { movements } from "@/db/schema";
import { requireVerifiedEmail } from "@/utils/auth";
import { ZSAError } from "zsa";

/**
 * Get all movements available in the system
 */
export async function getAllMovements() {
  const session = await requireVerifiedEmail();

  if (!session) {
    throw new ZSAError("NOT_AUTHORIZED", "Not authenticated");
  }

  const db = getDB();

  const allMovements = await db.select().from(movements);

  return allMovements;
}
