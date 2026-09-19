import { generateSlug } from "../../utils/slugify"

export function getCrewEventIdentityUpdate(
  name: string | undefined,
  currentName?: string,
): {
  name?: string
  slug?: string
} {
  if (name === undefined) return {}
  if (name === currentName) return { name }

  const slug = generateSlug(name)
  if (!slug) {
    throw new Error("Event name must include letters or numbers")
  }

  return { name, slug }
}

export function isCrewEventSlugCollisionError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false

  const candidate = error as {
    code?: unknown
    errno?: unknown
    message?: unknown
    cause?: unknown
  }

  return (
    candidate.code === "ER_DUP_ENTRY" ||
    candidate.errno === 1062 ||
    (typeof candidate.message === "string" &&
      candidate.message.includes("Duplicate entry")) ||
    (candidate.cause !== error &&
      isCrewEventSlugCollisionError(candidate.cause))
  )
}
