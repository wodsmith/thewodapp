/**
 * Address formatting and normalization utilities
 */

import type { Address, LocationBadgeDisplay } from "@/types/address"

/**
 * US state name to abbreviation mapping
 */
const US_STATE_ABBREVIATIONS: Record<string, string> = {
	alabama: "AL",
	alaska: "AK",
	arizona: "AZ",
	arkansas: "AR",
	california: "CA",
	colorado: "CO",
	connecticut: "CT",
	delaware: "DE",
	florida: "FL",
	georgia: "GA",
	hawaii: "HI",
	idaho: "ID",
	illinois: "IL",
	indiana: "IN",
	iowa: "IA",
	kansas: "KS",
	kentucky: "KY",
	louisiana: "LA",
	maine: "ME",
	maryland: "MD",
	massachusetts: "MA",
	michigan: "MI",
	minnesota: "MN",
	mississippi: "MS",
	missouri: "MO",
	montana: "MT",
	nebraska: "NE",
	nevada: "NV",
	"new hampshire": "NH",
	"new jersey": "NJ",
	"new mexico": "NM",
	"new york": "NY",
	"north carolina": "NC",
	"north dakota": "ND",
	ohio: "OH",
	oklahoma: "OK",
	oregon: "OR",
	pennsylvania: "PA",
	"rhode island": "RI",
	"south carolina": "SC",
	"south dakota": "SD",
	tennessee: "TN",
	texas: "TX",
	utah: "UT",
	vermont: "VT",
	virginia: "VA",
	washington: "WA",
	"west virginia": "WV",
	wisconsin: "WI",
	wyoming: "WY",
	"district of columbia": "DC",
}

/**
 * Country name to ISO 3166-1 alpha-2 code mapping
 */
const COUNTRY_CODE_MAP: Record<string, string> = {
	"united states": "US",
	"united states of america": "US",
	usa: "US",
	america: "US",
	canada: "CA",
	"united kingdom": "GB",
	uk: "GB",
	"great britain": "GB",
	england: "GB",
	scotland: "GB",
	wales: "GB",
	"northern ireland": "GB",
	australia: "AU",
	"new zealand": "NZ",
	ireland: "IE",
	mexico: "MX",
	germany: "DE",
	france: "FR",
	spain: "ES",
	italy: "IT",
	netherlands: "NL",
	belgium: "BE",
	switzerland: "CH",
	austria: "AT",
	denmark: "DK",
	sweden: "SE",
	norway: "NO",
	finland: "FI",
	poland: "PL",
	portugal: "PT",
	greece: "GR",
	czech: "CZ",
	"czech republic": "CZ",
	iceland: "IS",
	brazil: "BR",
	argentina: "AR",
	chile: "CL",
	japan: "JP",
	china: "CN",
	"south korea": "KR",
	india: "IN",
	singapore: "SG",
	"hong kong": "HK",
	philippines: "PH",
	thailand: "TH",
	vietnam: "VN",
	malaysia: "MY",
	indonesia: "ID",
	"south africa": "ZA",
	israel: "IL",
	"saudi arabia": "SA",
	"united arab emirates": "AE",
	uae: "AE",
	dubai: "AE",
	turkey: "TR",
	russia: "RU",
	ukraine: "UA",
}

/**
 * Country code to display name mapping
 */
const COUNTRY_DISPLAY_NAMES: Record<string, string> = {
	US: "United States",
	CA: "Canada",
	GB: "United Kingdom",
	AU: "Australia",
	NZ: "New Zealand",
	IE: "Ireland",
	MX: "Mexico",
	DE: "Germany",
	FR: "France",
	ES: "Spain",
	IT: "Italy",
	NL: "Netherlands",
	BE: "Belgium",
	CH: "Switzerland",
	AT: "Austria",
	DK: "Denmark",
	SE: "Sweden",
	NO: "Norway",
	FI: "Finland",
	PL: "Poland",
	PT: "Portugal",
	GR: "Greece",
	CZ: "Czech Republic",
	IS: "Iceland",
	BR: "Brazil",
	AR: "Argentina",
	CL: "Chile",
	JP: "Japan",
	CN: "China",
	KR: "South Korea",
	IN: "India",
	SG: "Singapore",
	HK: "Hong Kong",
	PH: "Philippines",
	TH: "Thailand",
	VN: "Vietnam",
	MY: "Malaysia",
	ID: "Indonesia",
	ZA: "South Africa",
	IL: "Israel",
	SA: "Saudi Arabia",
	AE: "United Arab Emirates",
	TR: "Turkey",
	RU: "Russia",
	UA: "Ukraine",
}

/**
 * Normalize US state name to abbreviation
 * @param state - State name or abbreviation
 * @returns State abbreviation or original value if not found
 */
export function normalizeState(state: string | null | undefined): string | null {
	if (!state) return null

	const trimmed = state.trim()
	const normalized = trimmed.toLowerCase()

	// If already an abbreviation (2 uppercase letters), return as-is
	if (/^[A-Z]{2}$/.test(trimmed)) {
		return trimmed
	}

	// Look up in mapping
	const abbr = US_STATE_ABBREVIATIONS[normalized]
	return abbr || trimmed
}

/**
 * Normalize country name to ISO 3166-1 alpha-2 code
 * @param country - Country name or code
 * @returns Country code or original value if not found
 */
export function normalizeCountry(
	country: string | null | undefined,
): string | null {
	if (!country) return null

	const trimmed = country.trim()
	const normalized = trimmed.toLowerCase()

	// Look up in mapping first (handles "UK" -> "GB")
	const code = COUNTRY_CODE_MAP[normalized]
	if (code) return code

	// If already a 2-letter code, return uppercase
	if (/^[a-z]{2}$/i.test(trimmed)) {
		return trimmed.toUpperCase()
	}

	// Return original if not found
	return trimmed
}

/**
 * Get display name for country code
 * @param countryCode - ISO 3166-1 alpha-2 country code
 * @returns Display name or country code if not found
 */
export function getCountryDisplayName(
	countryCode: string | null | undefined,
): string | null {
	if (!countryCode) return null

	const normalized = countryCode.trim().toUpperCase()
	return COUNTRY_DISPLAY_NAMES[normalized] || countryCode
}

/**
 * Check if address has any meaningful data
 * @param address - Address object (can be partial or null)
 * @returns true if address has at least one field with data
 */
export function hasAddressData(
	address: Partial<Address> | null | undefined,
): boolean {
	if (!address) return false

	return Boolean(
		address.name?.trim() ||
			address.streetLine1?.trim() ||
			address.streetLine2?.trim() ||
			address.city?.trim() ||
			address.stateProvince?.trim() ||
			address.postalCode?.trim() ||
			address.countryCode?.trim(),
	)
}

/**
 * Format city and state/country line (e.g., "Austin, TX" or "London, UK")
 * @param address - Address object (can be partial or null)
 * @returns Formatted city line or null if insufficient data
 */
export function formatCityLine(
	address: Partial<Address> | null | undefined,
): string | null {
	if (!address?.city?.trim()) return null

	const city = address.city.trim()
	const state = address.stateProvince?.trim()
	const country = address.countryCode?.trim()

	// If we have state, use city + state (e.g., "Austin, TX")
	if (state) {
		return `${city}, ${state}`
	}

	// If we have country, use city + country (e.g., "London, UK")
	if (country) {
		return `${city}, ${country}`
	}

	// Just city
	return city
}

/**
 * Format full address with all available components
 * @param address - Address object (can be partial or null)
 * @returns Formatted full address or null if no data
 */
export function formatFullAddress(
	address: Partial<Address> | null | undefined,
): string | null {
	if (!hasAddressData(address)) return null

	const parts: string[] = []

	// Name (venue/location name)
	if (address.name?.trim()) {
		parts.push(address.name.trim())
	}

	// Street lines
	if (address.streetLine1?.trim()) {
		parts.push(address.streetLine1.trim())
	}
	if (address.streetLine2?.trim()) {
		parts.push(address.streetLine2.trim())
	}

	// City, State/Province Postal
	const cityParts: string[] = []
	if (address.city?.trim()) {
		cityParts.push(address.city.trim())
	}
	if (address.stateProvince?.trim()) {
		cityParts.push(address.stateProvince.trim())
	}

	// Add postal code to the last part (state or city)
	if (address.postalCode?.trim() && cityParts.length > 0) {
		const lastIndex = cityParts.length - 1
		cityParts[lastIndex] = `${cityParts[lastIndex]} ${address.postalCode.trim()}`
	} else if (address.postalCode?.trim()) {
		// No city or state, just postal code
		cityParts.push(address.postalCode.trim())
	}

	if (cityParts.length > 0) {
		parts.push(cityParts.join(", "))
	}

	// Country
	if (address.countryCode?.trim()) {
		const countryDisplay = getCountryDisplayName(address.countryCode.trim())
		if (countryDisplay) {
			parts.push(countryDisplay)
		}
	}

	return parts.length > 0 ? parts.join("\n") : null
}

/**
 * Format location badge display for competition listings
 * Priority: online > city+state > city+country > city > name > team name > "Location TBA"
 * @param address - Address object (can be partial or null)
 * @param competitionType - Competition type ('in-person' or 'online')
 * @param organizingTeamName - Fallback team name if no address data
 * @returns LocationBadgeDisplay with text and icon
 */
export function formatLocationBadge(
	address: Partial<Address> | null | undefined,
	competitionType: "in-person" | "online",
	organizingTeamName?: string | null,
): LocationBadgeDisplay {
	// Online competitions always show globe icon with "Online"
	if (competitionType === "online") {
		return {
			text: "Online",
			icon: "globe",
		}
	}

	// Try to format city line (city + state/country)
	const cityLine = formatCityLine(address)
	if (cityLine) {
		return {
			text: cityLine,
			icon: "map-pin",
		}
	}

	// Just city
	if (address?.city?.trim()) {
		return {
			text: address.city.trim(),
			icon: "map-pin",
		}
	}

	// Venue/location name
	if (address?.name?.trim()) {
		return {
			text: address.name.trim(),
			icon: "map-pin",
		}
	}

	// Fallback to organizing team name
	if (organizingTeamName?.trim()) {
		return {
			text: organizingTeamName.trim(),
			icon: "map-pin",
		}
	}

	// No location data
	return {
		text: "Location TBA",
		icon: "map-pin",
	}
}

/**
 * Normalize address input by standardizing state and country codes
 * @param input - Raw address input
 * @returns Normalized address input
 */
export function normalizeAddressInput(
	input: Partial<Address>,
): Partial<Address> {
	return {
		...input,
		stateProvince: normalizeState(input.stateProvince),
		countryCode: normalizeCountry(input.countryCode),
	}
}
