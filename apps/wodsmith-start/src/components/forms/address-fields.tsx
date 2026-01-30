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

interface AddressFieldsProps<T extends FieldValues> {
	form: UseFormReturn<T>
	prefix?: string
}

export function AddressFields<T extends FieldValues>({ form, prefix = "" }: AddressFieldsProps<T>) {
	const getFieldName = (fieldName: string): Path<T> => {
		return (prefix ? `${prefix}.${fieldName}` : fieldName) as Path<T>
	}

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

			<div className="grid grid-cols-6 gap-4">
				<FormField
					control={form.control}
					name={getFieldName("city")}
					render={({ field }) => (
						<FormItem className="col-span-3">
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
						<FormItem className="col-span-1">
							<FormLabel>State</FormLabel>
							<FormControl>
								<Input
									{...field}
									value={field.value ?? ""}
									placeholder="State"
								/>
							</FormControl>
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
				name={getFieldName("countryCode")}
				render={({ field }) => (
					<FormItem>
						<FormLabel>Country</FormLabel>
						<Select
							onValueChange={field.onChange}
							value={field.value ?? ""}
						>
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
