export function getExecuteRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) {
    if (Array.isArray(result[0])) return result[0] as T[]
    return result as T[]
  }

  return ((result as { rows?: T[] })?.rows ?? []) as T[]
}

export function getFirstExecuteValue(result: unknown): unknown {
  const [row] = getExecuteRows<unknown>(result)
  if (Array.isArray(row)) return row[0]
  if (row && typeof row === "object") return Object.values(row)[0]
  return row
}
