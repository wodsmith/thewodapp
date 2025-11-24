import { tool } from "ai";
import { z } from "zod/v4";
import { getAvailableWorkoutMovements } from "@/server/workouts";
import description from "./get-movements.md";

export const getMovements = (teamId: string) => tool({
  name: "getMovements",
  description,
  inputSchema: z.object({}),
  execute: async () => {
    console.log("🤖 getMovements called for teamId:", teamId);

    try {
      const movements = await getAvailableWorkoutMovements(teamId);

      console.log("🤖 getMovements returned:", {
        count: movements.length,
        movements: movements.slice(0, 10),
      });

      return movements;
    } catch (error) {
      console.error("🤖 getMovements error:", error);
      throw error;
    }
  },
});
