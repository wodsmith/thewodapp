import { generateSlug } from "../../utils/slugify"

export function getCrewEventIdentityUpdate(name: string | undefined): {
  name?: string
  slug?: string
} {
  if (name === undefined) return {}

  const slug = generateSlug(name)
  if (!slug) {
    throw new Error("Event name must include letters or numbers")
  }

  return { name, slug }
}
