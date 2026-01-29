import { describe, expect, it } from "vitest"
import {
	formatLocationBadge,
	formatFullAddress,
	hasAddressData,
	formatCityLine,
	normalizeState,
	normalizeCountry,
	getCountryDisplayName,
	normalizeAddressInput,
	getGoogleMapsUrl,
} from "@/utils/address"
import type { Address } from "@/types/address"

describe("address utilities", () => {
	// ==========================================================================
	// normalizeState
	// ==========================================================================

	describe("normalizeState", () => {
		it("converts full state names to abbreviations", () => {
			expect(normalizeState("Texas")).toBe("TX")
			expect(normalizeState("California")).toBe("CA")
			expect(normalizeState("New York")).toBe("NY")
			expect(normalizeState("North Carolina")).toBe("NC")
		})

		it("handles case-insensitive input", () => {
			expect(normalizeState("texas")).toBe("TX")
			expect(normalizeState("TEXAS")).toBe("TX")
			expect(normalizeState("TeXaS")).toBe("TX")
		})

		it("returns abbreviations as-is", () => {
			expect(normalizeState("TX")).toBe("TX")
			expect(normalizeState("CA")).toBe("CA")
			expect(normalizeState("NY")).toBe("NY")
		})

		it("handles whitespace", () => {
			expect(normalizeState("  Texas  ")).toBe("TX")
			expect(normalizeState("  TX  ")).toBe("TX")
		})

		it("returns null for null or undefined", () => {
			expect(normalizeState(null)).toBeNull()
			expect(normalizeState(undefined)).toBeNull()
		})

		it("returns original value for unknown states", () => {
			expect(normalizeState("Unknown State")).toBe("Unknown State")
		})

		it("handles all US states", () => {
			expect(normalizeState("Alabama")).toBe("AL")
			expect(normalizeState("Alaska")).toBe("AK")
			expect(normalizeState("Arizona")).toBe("AZ")
			expect(normalizeState("Florida")).toBe("FL")
			expect(normalizeState("Hawaii")).toBe("HI")
			expect(normalizeState("District of Columbia")).toBe("DC")
		})
	})

	// ==========================================================================
	// normalizeCountry
	// ==========================================================================

	describe("normalizeCountry", () => {
		it("converts full country names to ISO codes", () => {
			expect(normalizeCountry("United States")).toBe("US")
			expect(normalizeCountry("Canada")).toBe("CA")
			expect(normalizeCountry("United Kingdom")).toBe("GB")
			expect(normalizeCountry("Australia")).toBe("AU")
		})

		it("handles various US name formats", () => {
			expect(normalizeCountry("United States of America")).toBe("US")
			expect(normalizeCountry("USA")).toBe("US")
			expect(normalizeCountry("America")).toBe("US")
		})

		it("handles various UK name formats", () => {
			expect(normalizeCountry("UK")).toBe("GB")
			expect(normalizeCountry("Great Britain")).toBe("GB")
			expect(normalizeCountry("England")).toBe("GB")
			expect(normalizeCountry("Scotland")).toBe("GB")
		})

		it("handles case-insensitive input", () => {
			expect(normalizeCountry("united states")).toBe("US")
			expect(normalizeCountry("CANADA")).toBe("CA")
			expect(normalizeCountry("AuStRaLiA")).toBe("AU")
		})

		it("returns country codes as-is (uppercase)", () => {
			expect(normalizeCountry("US")).toBe("US")
			expect(normalizeCountry("us")).toBe("US")
			expect(normalizeCountry("GB")).toBe("GB")
			expect(normalizeCountry("gb")).toBe("GB")
		})

		it("handles whitespace", () => {
			expect(normalizeCountry("  United States  ")).toBe("US")
			expect(normalizeCountry("  US  ")).toBe("US")
		})

		it("returns null for null or undefined", () => {
			expect(normalizeCountry(null)).toBeNull()
			expect(normalizeCountry(undefined)).toBeNull()
		})

		it("returns original value for unknown countries", () => {
			expect(normalizeCountry("Unknown Country")).toBe("Unknown Country")
		})

		it("handles common countries", () => {
			expect(normalizeCountry("Mexico")).toBe("MX")
			expect(normalizeCountry("Germany")).toBe("DE")
			expect(normalizeCountry("France")).toBe("FR")
			expect(normalizeCountry("Japan")).toBe("JP")
			expect(normalizeCountry("Brazil")).toBe("BR")
		})
	})

	// ==========================================================================
	// getCountryDisplayName
	// ==========================================================================

	describe("getCountryDisplayName", () => {
		it("converts country codes to display names", () => {
			expect(getCountryDisplayName("US")).toBe("United States")
			expect(getCountryDisplayName("CA")).toBe("Canada")
			expect(getCountryDisplayName("GB")).toBe("United Kingdom")
			expect(getCountryDisplayName("AU")).toBe("Australia")
		})

		it("handles lowercase codes", () => {
			expect(getCountryDisplayName("us")).toBe("United States")
			expect(getCountryDisplayName("ca")).toBe("Canada")
		})

		it("handles whitespace", () => {
			expect(getCountryDisplayName("  US  ")).toBe("United States")
		})

		it("returns null for null or undefined", () => {
			expect(getCountryDisplayName(null)).toBeNull()
			expect(getCountryDisplayName(undefined)).toBeNull()
		})

		it("returns original code for unknown countries", () => {
			expect(getCountryDisplayName("XX")).toBe("XX")
		})
	})

	// ==========================================================================
	// hasAddressData
	// ==========================================================================

	describe("hasAddressData", () => {
		it("returns true when address has name", () => {
			expect(hasAddressData({ name: "CrossFit Gym" })).toBe(true)
		})

		it("returns true when address has street", () => {
			expect(hasAddressData({ streetLine1: "123 Main St" })).toBe(true)
		})

		it("returns true when address has city", () => {
			expect(hasAddressData({ city: "Austin" })).toBe(true)
		})

		it("returns true when address has state", () => {
			expect(hasAddressData({ stateProvince: "TX" })).toBe(true)
		})

		it("returns true when address has postal code", () => {
			expect(hasAddressData({ postalCode: "78701" })).toBe(true)
		})

		it("returns true when address has country", () => {
			expect(hasAddressData({ countryCode: "US" })).toBe(true)
		})

		it("returns false for null or undefined", () => {
			expect(hasAddressData(null)).toBe(false)
			expect(hasAddressData(undefined)).toBe(false)
		})

		it("returns false for empty object", () => {
			expect(hasAddressData({})).toBe(false)
		})

		it("returns false for whitespace-only fields", () => {
			expect(
				hasAddressData({
					name: "   ",
					city: "  ",
					stateProvince: "",
				}),
			).toBe(false)
		})

		it("returns true if any field has data", () => {
			expect(
				hasAddressData({
					name: "",
					city: "Austin",
					stateProvince: "",
				}),
			).toBe(true)
		})
	})

	// ==========================================================================
	// formatCityLine
	// ==========================================================================

	describe("formatCityLine", () => {
		it("formats city with state", () => {
			expect(
				formatCityLine({
					city: "Austin",
					stateProvince: "TX",
				}),
			).toBe("Austin, TX")
		})

		it("formats city with country", () => {
			expect(
				formatCityLine({
					city: "London",
					countryCode: "GB",
				}),
			).toBe("London, GB")
		})

		it("prefers state over country", () => {
			expect(
				formatCityLine({
					city: "Austin",
					stateProvince: "TX",
					countryCode: "US",
				}),
			).toBe("Austin, TX")
		})

		it("returns city only if no state or country", () => {
			expect(
				formatCityLine({
					city: "Austin",
				}),
			).toBe("Austin")
		})

		it("returns null if no city", () => {
			expect(
				formatCityLine({
					stateProvince: "TX",
					countryCode: "US",
				}),
			).toBeNull()
		})

		it("returns null for null or undefined", () => {
			expect(formatCityLine(null)).toBeNull()
			expect(formatCityLine(undefined)).toBeNull()
		})

		it("trims whitespace", () => {
			expect(
				formatCityLine({
					city: "  Austin  ",
					stateProvince: "  TX  ",
				}),
			).toBe("Austin, TX")
		})

		it("returns null if city is whitespace-only", () => {
			expect(
				formatCityLine({
					city: "   ",
					stateProvince: "TX",
				}),
			).toBeNull()
		})
	})

	// ==========================================================================
	// formatFullAddress
	// ==========================================================================

	describe("formatFullAddress", () => {
		it("formats complete address with all fields", () => {
			const address: Partial<Address> = {
				name: "CrossFit Central",
				streetLine1: "123 Main St",
				streetLine2: "Suite 100",
				city: "Austin",
				stateProvince: "TX",
				postalCode: "78701",
				countryCode: "US",
			}

			expect(formatFullAddress(address)).toBe(
				"CrossFit Central\n123 Main St\nSuite 100\nAustin, TX 78701\nUnited States",
			)
		})

		it("formats address without venue name", () => {
			const address: Partial<Address> = {
				streetLine1: "123 Main St",
				city: "Austin",
				stateProvince: "TX",
				postalCode: "78701",
			}

			expect(formatFullAddress(address)).toBe("123 Main St\nAustin, TX 78701")
		})

		it("formats address with only city and state", () => {
			const address: Partial<Address> = {
				city: "Austin",
				stateProvince: "TX",
			}

			expect(formatFullAddress(address)).toBe("Austin, TX")
		})

		it("formats address with city and country", () => {
			const address: Partial<Address> = {
				city: "London",
				countryCode: "GB",
			}

			expect(formatFullAddress(address)).toBe("London\nUnited Kingdom")
		})

		it("formats address with venue name only", () => {
			const address: Partial<Address> = {
				name: "CrossFit Central",
			}

			expect(formatFullAddress(address)).toBe("CrossFit Central")
		})

		it("returns null for null or undefined", () => {
			expect(formatFullAddress(null)).toBeNull()
			expect(formatFullAddress(undefined)).toBeNull()
		})

		it("returns null for empty address", () => {
			expect(formatFullAddress({})).toBeNull()
		})

		it("returns null for whitespace-only fields", () => {
			expect(
				formatFullAddress({
					name: "   ",
					city: "",
				}),
			).toBeNull()
		})

		it("handles postal code without state", () => {
			const address: Partial<Address> = {
				city: "London",
				postalCode: "SW1A 1AA",
				countryCode: "GB",
			}

			expect(formatFullAddress(address)).toBe("London SW1A 1AA\nUnited Kingdom")
		})

		it("omits country display if code not recognized", () => {
			const address: Partial<Address> = {
				city: "Some City",
				countryCode: "XX",
			}

			// XX is not in COUNTRY_DISPLAY_NAMES, so it returns "XX"
			expect(formatFullAddress(address)).toBe("Some City\nXX")
		})
	})

	// ==========================================================================
	// formatLocationBadge
	// ==========================================================================

	describe("formatLocationBadge", () => {
		it("returns globe icon for online competitions", () => {
			const result = formatLocationBadge(null, "online", null)
			expect(result).toEqual({
				text: "Online",
				icon: "globe",
			})
		})

		it("returns globe icon for online competitions even with address data", () => {
			const address: Partial<Address> = {
				city: "Austin",
				stateProvince: "TX",
			}
			const result = formatLocationBadge(address, "online", null)
			expect(result).toEqual({
				text: "Online",
				icon: "globe",
			})
		})

		it("formats city and state for in-person competitions", () => {
			const address: Partial<Address> = {
				city: "Austin",
				stateProvince: "TX",
			}
			const result = formatLocationBadge(address, "in-person", null)
			expect(result).toEqual({
				text: "Austin, TX",
				icon: "map-pin",
			})
		})

		it("formats city and country for in-person competitions", () => {
			const address: Partial<Address> = {
				city: "London",
				countryCode: "GB",
			}
			const result = formatLocationBadge(address, "in-person", null)
			expect(result).toEqual({
				text: "London, GB",
				icon: "map-pin",
			})
		})

		it("formats city only if no state or country", () => {
			const address: Partial<Address> = {
				city: "Austin",
			}
			const result = formatLocationBadge(address, "in-person", null)
			expect(result).toEqual({
				text: "Austin",
				icon: "map-pin",
			})
		})

		it("uses venue name if no city data", () => {
			const address: Partial<Address> = {
				name: "CrossFit Central",
			}
			const result = formatLocationBadge(address, "in-person", null)
			expect(result).toEqual({
				text: "CrossFit Central",
				icon: "map-pin",
			})
		})

		it("falls back to organizing team name", () => {
			const result = formatLocationBadge(null, "in-person", "CrossFit Austin")
			expect(result).toEqual({
				text: "CrossFit Austin",
				icon: "map-pin",
			})
		})

		it("returns Location TBA if no data", () => {
			const result = formatLocationBadge(null, "in-person", null)
			expect(result).toEqual({
				text: "Location TBA",
				icon: "map-pin",
			})
		})

		it("returns Location TBA if only whitespace data", () => {
			const address: Partial<Address> = {
				name: "   ",
				city: "",
			}
			const result = formatLocationBadge(address, "in-person", null)
			expect(result).toEqual({
				text: "Location TBA",
				icon: "map-pin",
			})
		})

		it("prefers city over venue name", () => {
			const address: Partial<Address> = {
				name: "CrossFit Central",
				city: "Austin",
				stateProvince: "TX",
			}
			const result = formatLocationBadge(address, "in-person", null)
			expect(result).toEqual({
				text: "Austin, TX",
				icon: "map-pin",
			})
		})

		it("ignores organizing team name if address has data", () => {
			const address: Partial<Address> = {
				name: "CrossFit Central",
			}
			const result = formatLocationBadge(
				address,
				"in-person",
				"CrossFit Austin",
			)
			expect(result).toEqual({
				text: "CrossFit Central",
				icon: "map-pin",
			})
		})

		it("trims whitespace from organizing team name", () => {
			const result = formatLocationBadge(
				null,
				"in-person",
				"  CrossFit Austin  ",
			)
			expect(result).toEqual({
				text: "CrossFit Austin",
				icon: "map-pin",
			})
		})
	})

	// ==========================================================================
	// normalizeAddressInput
	// ==========================================================================

	describe("normalizeAddressInput", () => {
		it("normalizes state and country codes", () => {
			const input: Partial<Address> = {
				city: "Austin",
				stateProvince: "Texas",
				countryCode: "United States",
			}

			const result = normalizeAddressInput(input)

			expect(result).toEqual({
				city: "Austin",
				stateProvince: "TX",
				countryCode: "US",
			})
		})

		it("preserves all other fields", () => {
			const input: Partial<Address> = {
				name: "CrossFit Central",
				streetLine1: "123 Main St",
				streetLine2: "Suite 100",
				city: "Austin",
				stateProvince: "Texas",
				postalCode: "78701",
				countryCode: "United States",
				notes: "Back entrance",
			}

			const result = normalizeAddressInput(input)

			expect(result).toEqual({
				name: "CrossFit Central",
				streetLine1: "123 Main St",
				streetLine2: "Suite 100",
				city: "Austin",
				stateProvince: "TX",
				postalCode: "78701",
				countryCode: "US",
				notes: "Back entrance",
			})
		})

		it("handles null state and country", () => {
			const input: Partial<Address> = {
				city: "Austin",
				stateProvince: null,
				countryCode: null,
			}

			const result = normalizeAddressInput(input)

			expect(result).toEqual({
				city: "Austin",
				stateProvince: null,
				countryCode: null,
			})
		})

		it("handles already normalized codes", () => {
			const input: Partial<Address> = {
				city: "Austin",
				stateProvince: "TX",
				countryCode: "US",
			}

			const result = normalizeAddressInput(input)

			expect(result).toEqual({
				city: "Austin",
				stateProvince: "TX",
				countryCode: "US",
			})
		})

		it("handles empty object", () => {
			const result = normalizeAddressInput({})
			expect(result).toEqual({
				stateProvince: null,
				countryCode: null,
			})
		})
	})

	// ==========================================================================
	// getGoogleMapsUrl
	// ==========================================================================

	describe("getGoogleMapsUrl", () => {
		it("generates URL for complete address", () => {
			const address: Partial<Address> = {
				streetLine1: "123 Main St",
				city: "Austin",
				stateProvince: "TX",
				postalCode: "78701",
				countryCode: "US",
			}

			const result = getGoogleMapsUrl(address)

			expect(result).toBe(
				"https://www.google.com/maps/search/?api=1&query=123%20Main%20St%2C%20Austin%2C%20TX%2C%2078701%2C%20United%20States",
			)
		})

		it("generates URL for city and state only", () => {
			const address: Partial<Address> = {
				city: "Austin",
				stateProvince: "TX",
			}

			const result = getGoogleMapsUrl(address)

			expect(result).toBe(
				"https://www.google.com/maps/search/?api=1&query=Austin%2C%20TX",
			)
		})

		it("generates URL for city and country", () => {
			const address: Partial<Address> = {
				city: "London",
				countryCode: "GB",
			}

			const result = getGoogleMapsUrl(address)

			expect(result).toBe(
				"https://www.google.com/maps/search/?api=1&query=London%2C%20United%20Kingdom",
			)
		})

		it("generates URL for partial address", () => {
			const address: Partial<Address> = {
				city: "Austin",
				postalCode: "78701",
			}

			const result = getGoogleMapsUrl(address)

			expect(result).toBe(
				"https://www.google.com/maps/search/?api=1&query=Austin%2C%2078701",
			)
		})

		it("returns null for null address", () => {
			expect(getGoogleMapsUrl(null)).toBeNull()
		})

		it("returns null for undefined address", () => {
			expect(getGoogleMapsUrl(undefined)).toBeNull()
		})

		it("returns null for empty address", () => {
			expect(getGoogleMapsUrl({})).toBeNull()
		})

		it("returns null for whitespace-only fields", () => {
			const address: Partial<Address> = {
				city: "   ",
				stateProvince: "",
			}

			expect(getGoogleMapsUrl(address)).toBeNull()
		})

		it("URL-encodes special characters", () => {
			const address: Partial<Address> = {
				streetLine1: "123 Main St #5",
				city: "New York",
			}

			const result = getGoogleMapsUrl(address)

			expect(result).toBe(
				"https://www.google.com/maps/search/?api=1&query=123%20Main%20St%20%235%2C%20New%20York",
			)
		})

		it("handles street address without city", () => {
			const address: Partial<Address> = {
				streetLine1: "123 Main St",
				postalCode: "78701",
			}

			const result = getGoogleMapsUrl(address)

			expect(result).toBe(
				"https://www.google.com/maps/search/?api=1&query=123%20Main%20St%2C%2078701",
			)
		})

		it("ignores name field in URL generation", () => {
			const address: Partial<Address> = {
				name: "CrossFit Central",
				city: "Austin",
				stateProvince: "TX",
			}

			const result = getGoogleMapsUrl(address)

			// Name should not be included in the URL
			expect(result).toBe(
				"https://www.google.com/maps/search/?api=1&query=Austin%2C%20TX",
			)
		})
	})
})
