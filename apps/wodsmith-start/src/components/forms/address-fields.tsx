"use client"

import type { UseFormReturn } from "react-hook-form"
import {
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

interface AddressFieldsProps {
	form: UseFormReturn<any>
	prefix?: string
}

export function AddressFields({ form, prefix = "" }: AddressFieldsProps) {
	const getFieldName = (fieldName: string) => {
		return prefix ? `${prefix}.${fieldName}` : fieldName
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
						<FormControl>
							<Input
								{...field}
								value={field.value ?? ""}
								placeholder="Enter country code (e.g., US, CA)"
							/>
						</FormControl>
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
