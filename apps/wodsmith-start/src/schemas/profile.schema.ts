import { z } from "zod"

// Keep signup and profile validation within the users table's varchar(255) limit.
export const accountNameFields = {
  firstName: z
    .string()
    .trim()
    .min(1, "First name is required")
    .max(255, "First name is too long"),
  lastName: z
    .string()
    .trim()
    .min(1, "Last name is required")
    .max(255, "Last name is too long"),
}

export const userProfileSchema = z.object({
  ...accountNameFields,
  avatar: z
    .string()
    .url("Invalid avatar URL")
    .max(600, "URL is too long")
    .optional()
    .or(z.literal("")),
})
