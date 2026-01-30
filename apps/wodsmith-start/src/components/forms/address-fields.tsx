"use client"

import type { FieldValues, Path, UseFormReturn } from "react-hook-form"
import {
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
	SearchableSelect,
	type SearchableSelectOption,
} from "@/components/ui/searchable-select"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

/**
 * Common countries for competitions, ordered by frequency of use
 */
const COUNTRY_OPTIONS = [
	{ code: "US", name: "United States" },
	{ code: "CA", name: "Canada" },
	{ code: "GB", name: "United Kingdom" },
	{ code: "AU", name: "Australia" },
	{ code: "NZ", name: "New Zealand" },
	{ code: "IE", name: "Ireland" },
	{ code: "MX", name: "Mexico" },
	{ code: "DE", name: "Germany" },
	{ code: "FR", name: "France" },
	{ code: "ES", name: "Spain" },
	{ code: "IT", name: "Italy" },
	{ code: "NL", name: "Netherlands" },
	{ code: "BE", name: "Belgium" },
	{ code: "CH", name: "Switzerland" },
	{ code: "AT", name: "Austria" },
	{ code: "DK", name: "Denmark" },
	{ code: "SE", name: "Sweden" },
	{ code: "NO", name: "Norway" },
	{ code: "FI", name: "Finland" },
	{ code: "PL", name: "Poland" },
	{ code: "PT", name: "Portugal" },
	{ code: "GR", name: "Greece" },
	{ code: "CZ", name: "Czech Republic" },
	{ code: "IS", name: "Iceland" },
	{ code: "BR", name: "Brazil" },
	{ code: "AR", name: "Argentina" },
	{ code: "CL", name: "Chile" },
	{ code: "JP", name: "Japan" },
	{ code: "CN", name: "China" },
	{ code: "KR", name: "South Korea" },
	{ code: "IN", name: "India" },
	{ code: "SG", name: "Singapore" },
	{ code: "HK", name: "Hong Kong" },
	{ code: "PH", name: "Philippines" },
	{ code: "TH", name: "Thailand" },
	{ code: "VN", name: "Vietnam" },
	{ code: "MY", name: "Malaysia" },
	{ code: "ID", name: "Indonesia" },
	{ code: "ZA", name: "South Africa" },
	{ code: "IL", name: "Israel" },
	{ code: "SA", name: "Saudi Arabia" },
	{ code: "AE", name: "United Arab Emirates" },
	{ code: "TR", name: "Turkey" },
	{ code: "RU", name: "Russia" },
	{ code: "UA", name: "Ukraine" },
] as const

/**
 * US States and territories
 */
const US_STATES = [
	{ code: "AL", name: "Alabama" },
	{ code: "AK", name: "Alaska" },
	{ code: "AZ", name: "Arizona" },
	{ code: "AR", name: "Arkansas" },
	{ code: "CA", name: "California" },
	{ code: "CO", name: "Colorado" },
	{ code: "CT", name: "Connecticut" },
	{ code: "DE", name: "Delaware" },
	{ code: "DC", name: "District of Columbia" },
	{ code: "FL", name: "Florida" },
	{ code: "GA", name: "Georgia" },
	{ code: "HI", name: "Hawaii" },
	{ code: "ID", name: "Idaho" },
	{ code: "IL", name: "Illinois" },
	{ code: "IN", name: "Indiana" },
	{ code: "IA", name: "Iowa" },
	{ code: "KS", name: "Kansas" },
	{ code: "KY", name: "Kentucky" },
	{ code: "LA", name: "Louisiana" },
	{ code: "ME", name: "Maine" },
	{ code: "MD", name: "Maryland" },
	{ code: "MA", name: "Massachusetts" },
	{ code: "MI", name: "Michigan" },
	{ code: "MN", name: "Minnesota" },
	{ code: "MS", name: "Mississippi" },
	{ code: "MO", name: "Missouri" },
	{ code: "MT", name: "Montana" },
	{ code: "NE", name: "Nebraska" },
	{ code: "NV", name: "Nevada" },
	{ code: "NH", name: "New Hampshire" },
	{ code: "NJ", name: "New Jersey" },
	{ code: "NM", name: "New Mexico" },
	{ code: "NY", name: "New York" },
	{ code: "NC", name: "North Carolina" },
	{ code: "ND", name: "North Dakota" },
	{ code: "OH", name: "Ohio" },
	{ code: "OK", name: "Oklahoma" },
	{ code: "OR", name: "Oregon" },
	{ code: "PA", name: "Pennsylvania" },
	{ code: "RI", name: "Rhode Island" },
	{ code: "SC", name: "South Carolina" },
	{ code: "SD", name: "South Dakota" },
	{ code: "TN", name: "Tennessee" },
	{ code: "TX", name: "Texas" },
	{ code: "UT", name: "Utah" },
	{ code: "VT", name: "Vermont" },
	{ code: "VA", name: "Virginia" },
	{ code: "WA", name: "Washington" },
	{ code: "WV", name: "West Virginia" },
	{ code: "WI", name: "Wisconsin" },
	{ code: "WY", name: "Wyoming" },
	{ code: "AS", name: "American Samoa" },
	{ code: "GU", name: "Guam" },
	{ code: "MP", name: "Northern Mariana Islands" },
	{ code: "PR", name: "Puerto Rico" },
	{ code: "VI", name: "U.S. Virgin Islands" },
] as const

/**
 * Canadian provinces and territories
 */
const CA_PROVINCES = [
	{ code: "AB", name: "Alberta" },
	{ code: "BC", name: "British Columbia" },
	{ code: "MB", name: "Manitoba" },
	{ code: "NB", name: "New Brunswick" },
	{ code: "NL", name: "Newfoundland and Labrador" },
	{ code: "NS", name: "Nova Scotia" },
	{ code: "NT", name: "Northwest Territories" },
	{ code: "NU", name: "Nunavut" },
	{ code: "ON", name: "Ontario" },
	{ code: "PE", name: "Prince Edward Island" },
	{ code: "QC", name: "Quebec" },
	{ code: "SK", name: "Saskatchewan" },
	{ code: "YT", name: "Yukon" },
] as const

interface AddressFieldsProps<T extends FieldValues> {
	form: UseFormReturn<T>
	prefix?: string
}

export function AddressFields<T extends FieldValues>({
	form,
	prefix = "",
}: AddressFieldsProps<T>) {
	const getFieldName = (fieldName: string): Path<T> => {
		return (prefix ? `${prefix}.${fieldName}` : fieldName) as Path<T>
	}

	// Watch country to determine state/province options
	const countryCode = form.watch(getFieldName("countryCode"))

	// Get state/province options based on country (formatted for SearchableSelect)
	const getStateOptions = (): SearchableSelectOption[] | null => {
		if (countryCode === "US") {
			return US_STATES.map((s) => ({ value: s.code, label: s.name }))
		}
		if (countryCode === "CA") {
			return CA_PROVINCES.map((s) => ({ value: s.code, label: s.name }))
		}
		return null // Use text input for other countries
	}

	const stateOptions = getStateOptions()

	return (
		<div className="space-y-4">
			<FormField
				control={form.control}
				name={getFieldName("name")}
				render={({ field }) => (
					<FormItem>
						<FormLabel>Venue/Location Name</FormLabel>
						<FormControl>
							<Input
								{...field}
								value={field.value ?? ""}
								placeholder="Enter venue or location name"
							/>
						</FormControl>
						<FormMessage />
					</FormItem>
				)}
			/>

			<FormField
				control={form.control}
				name={getFieldName("streetLine1")}
				render={({ field }) => (
					<FormItem>
						<FormLabel>Street Address</FormLabel>
						<FormControl>
							<Input
								{...field}
								value={field.value ?? ""}
								placeholder="Enter street address"
							/>
						</FormControl>
						<FormMessage />
					</FormItem>
				)}
			/>

			<FormField
				control={form.control}
				name={getFieldName("streetLine2")}
				render={({ field }) => (
					<FormItem>
						<FormLabel>Address Line 2</FormLabel>
						<FormControl>
							<Input
								{...field}
								value={field.value ?? ""}
								placeholder="Apartment, suite, unit, etc. (optional)"
							/>
						</FormControl>
						<FormMessage />
					</FormItem>
				)}
			/>

			<FormField
				control={form.control}
				name={getFieldName("countryCode")}
				render={({ field }) => (
					<FormItem>
						<FormLabel>Country</FormLabel>
						<Select onValueChange={field.onChange} value={field.value ?? ""}>
							<FormControl>
								<SelectTrigger>
									<SelectValue placeholder="Select country" />
								</SelectTrigger>
							</FormControl>
							<SelectContent>
								{COUNTRY_OPTIONS.map((country) => (
									<SelectItem key={country.code} value={country.code}>
										{country.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<FormMessage />
					</FormItem>
				)}
			/>

			<div className="grid grid-cols-6 gap-4">
				<FormField
					control={form.control}
					name={getFieldName("city")}
					render={({ field }) => (
						<FormItem className="col-span-2">
							<FormLabel>City</FormLabel>
							<FormControl>
								<Input
									{...field}
									value={field.value ?? ""}
									placeholder="Enter city"
								/>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name={getFieldName("stateProvince")}
					render={({ field }) => (
						<FormItem className="col-span-2">
							<FormLabel>
								{countryCode === "CA" ? "Province" : "State"}
							</FormLabel>
							{stateOptions ? (
								<SearchableSelect
									options={stateOptions}
									value={field.value ?? ""}
									onValueChange={field.onChange}
									placeholder={`Select ${countryCode === "CA" ? "province" : "state"}`}
									searchPlaceholder="Search..."
								/>
							) : (
								<FormControl>
									<Input
										{...field}
										value={field.value ?? ""}
										placeholder="State/Province"
									/>
								</FormControl>
							)}
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name={getFieldName("postalCode")}
					render={({ field }) => (
						<FormItem className="col-span-2">
							<FormLabel>Postal Code</FormLabel>
							<FormControl>
								<Input
									{...field}
									value={field.value ?? ""}
									placeholder="Postal code"
								/>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
			</div>

			<FormField
				control={form.control}
				name={getFieldName("notes")}
				render={({ field }) => (
					<FormItem>
						<FormLabel>Additional Directions/Notes</FormLabel>
						<FormControl>
							<Textarea
								{...field}
								value={field.value ?? ""}
								placeholder="Enter any additional directions or notes (optional)"
							/>
						</FormControl>
						<FormMessage />
					</FormItem>
				)}
			/>
		</div>
	)
}
