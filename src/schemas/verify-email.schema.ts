import { z } from "zod";

export const verifyEmailSchema = z.object({
  token: z.string().min(1, "Verification token is required"),
});
