import { describe, it, expect } from "vitest"
import {
	convertLegacyToNew,
	convertNewToLegacy,
	convertLegacyFractionalRoundsReps,
	convertNewToFractionalRoundsReps,
} from "@/utils/score-adapter"

describe("score-adapter", () => {
	describe("convertLegacyToNew", () => {
		it("converts time from seconds to milliseconds", () => {
			expect(convertLegacyToNew(754, "time")).toBe(754000) // 12:34
			expect(convertLegacyToNew(60, "time")).toBe(60000) // 1:00
			expect(convertLegacyToNew(3661, "time")).toBe(3661000) // 1:01:01
		})

		it("converts rounds-reps from *1000 to *100000", () => {
			expect(convertLegacyToNew(5012, "rounds-reps")).toBe(500012) // 5+12
			expect(convertLegacyToNew(3000, "rounds-reps")).toBe(300000) // 3+0
			expect(convertLegacyToNew(150, "rounds-reps")).toBe(150) // 0+150 (just reps, no conversion needed)
		})

		it("converts load from lbs to grams", () => {
			expect(convertLegacyToNew(225, "load")).toBe(102058) // 225 lbs
			expect(convertLegacyToNew(100, "load")).toBe(45359) // 100 lbs
		})

		it("converts distance from meters to millimeters", () => {
			expect(convertLegacyToNew(5000, "meters")).toBe(5000000) // 5000m
			expect(convertLegacyToNew(100, "feet")).toBe(30480) // 100ft
		})

		it("passes through count-based schemes unchanged", () => {
			expect(convertLegacyToNew(150, "reps")).toBe(150)
			expect(convertLegacyToNew(50, "calories")).toBe(50)
			expect(convertLegacyToNew(100, "points")).toBe(100)
			expect(convertLegacyToNew(1, "pass-fail")).toBe(1)
		})
	})

	describe("convertNewToLegacy", () => {
		it("converts time from milliseconds to seconds", () => {
			expect(convertNewToLegacy(754000, "time")).toBe(754) // 12:34
			expect(convertNewToLegacy(60000, "time")).toBe(60) // 1:00
		})

		it("converts rounds-reps from *100000 to *1000", () => {
			expect(convertNewToLegacy(500012, "rounds-reps")).toBe(5012) // 5+12
			expect(convertNewToLegacy(300000, "rounds-reps")).toBe(3000) // 3+0
		})

		it("converts load from grams to lbs", () => {
			expect(convertNewToLegacy(102058, "load")).toBe(225) // 225 lbs
			expect(convertNewToLegacy(45359, "load")).toBe(100) // 100 lbs
		})

		it("converts distance from millimeters to original units", () => {
			expect(convertNewToLegacy(5000000, "meters")).toBe(5000) // 5000m
			expect(convertNewToLegacy(30480, "feet")).toBe(100) // 100ft
		})
	})

	describe("fractional rounds-reps conversion", () => {
		it("converts fractional format to new encoding", () => {
			expect(convertLegacyFractionalRoundsReps(5.12)).toBe(500012) // 5+12
			expect(convertLegacyFractionalRoundsReps(3.0)).toBe(300000) // 3+0
			expect(convertLegacyFractionalRoundsReps(0.5)).toBe(50) // 0+50
		})

		it("converts new encoding to fractional format", () => {
			expect(convertNewToFractionalRoundsReps(500012)).toBe(5.12) // 5+12
			expect(convertNewToFractionalRoundsReps(300000)).toBe(3.0) // 3+0
			expect(convertNewToFractionalRoundsReps(50)).toBe(0.5) // 0+50
		})
	})

	describe("round-trip conversions", () => {
		it("maintains accuracy for time", () => {
			const original = 754
			const converted = convertLegacyToNew(original, "time")
			const backToOriginal = convertNewToLegacy(converted, "time")
			expect(backToOriginal).toBe(original)
		})

		it("maintains accuracy for rounds-reps", () => {
			const original = 5012
			const converted = convertLegacyToNew(original, "rounds-reps")
			const backToOriginal = convertNewToLegacy(converted, "rounds-reps")
			expect(backToOriginal).toBe(original)
		})

		it("maintains accuracy for load", () => {
			const original = 225
			const converted = convertLegacyToNew(original, "load")
			const backToOriginal = convertNewToLegacy(converted, "load")
			expect(backToOriginal).toBe(original)
		})
	})
})
