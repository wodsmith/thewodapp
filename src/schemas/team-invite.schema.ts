import { z } from "zod";

export const teamInviteSchema = z.object({
  token: z.string().min(1, "Invitation token is required"),
});
