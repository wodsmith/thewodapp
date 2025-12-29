/**
 * Get initials from a full name
 * @param name - Full name (e.g., "John Doe")
 * @returns Initials (e.g., "JD")
 */
export function getInitials(name: string): string {
	if (!name) return ""

	const parts = name.trim().split(/\s+/)

	if (parts.length === 1) {
		return parts[0].charAt(0).toUpperCase()
	}

	return (
		parts[0].charAt(0).toUpperCase() +
		parts[parts.length - 1].charAt(0).toUpperCase()
	)
}
