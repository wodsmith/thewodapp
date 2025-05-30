"use server";

import { z } from "zod";
import { getAllMovements } from "@/server/movements";
import { ZSAError, createServerAction } from "zsa";

/**
 * Get all movements in the system
 */
export const getAllMovementsAction = createServerAction().handler(async () => {
  try {
    const movements = await getAllMovements();
    return { success: true, data: movements };
  } catch (error) {
    console.error("Failed to get all movements:", error);

    if (error instanceof ZSAError) {
      throw error;
    }

    throw new ZSAError("INTERNAL_SERVER_ERROR", "Failed to get all movements");
  }
});
