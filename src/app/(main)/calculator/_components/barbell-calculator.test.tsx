import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import Cookies from "js-cookie";
import * as nuqs from "nuqs";
import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BarbellCalculator from "./barbell-calculator";

// Helper constant from the component, ideally this would be exported or part of a shared config
const WARMUP_PERCENTAGES = [0.4, 0.55, 0.7, 0.8, 0.9];

// Mock nuqs
vi.mock("nuqs", async (importOriginal) => {
	const actual = await importOriginal<typeof nuqs>();
	return {
		...actual,
		useQueryState: vi.fn(),
		parseAsInteger: {
			...actual.parseAsInteger,
			withDefault: vi.fn((val) => val),
		},
		parseAsString: {
			...actual.parseAsString,
			withDefault: vi.fn((val) => val),
		},
	};
});

// Mock Cookies
vi.mock("js-cookie");

describe("BarbellCalculator", () => {
	const mockSetTargetWeightQuery = vi.fn();
	const mockSetUnits = vi.fn();
	const mockSetBarWeightOption = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();
		(Cookies.get as Mock).mockReturnValue(undefined); // Use imported Mock type
		(Cookies.set as Mock).mockClear(); // Use imported Mock type

		// Reset mocks for useQueryState
		(nuqs.useQueryState as Mock).mockImplementation((key: string) => {
			// Use imported Mock type
			if (key === "weight") return [135, mockSetTargetWeightQuery];
			if (key === "units") return ["lb", mockSetUnits];
			if (key === "bar") return [45, mockSetBarWeightOption];
			return [null, vi.fn()];
		});
	});

	it("renders correctly with default values", () => {
		render(<BarbellCalculator />);
		expect(screen.getByLabelText(/TARGET WEIGHT/i)).toHaveValue(135);

		const lbRadio = screen.getByLabelText("LB");
		expect(lbRadio).toBeChecked();

		const bar45Radio = screen.getByLabelText("45 lb");
		expect(bar45Radio).toBeChecked();

		// Check for the main displayed weight. Be specific if there are multiple elements with "135.0"
		expect(
			screen.getByText(
				(content, element) =>
					element?.tagName.toLowerCase() === "div" &&
					element.classList.contains("text-4xl") &&
					content.startsWith("135.0"),
			),
		).toBeInTheDocument();
	});

	it("displays default warmup percentages and allows adjustment", async () => {
		render(<BarbellCalculator />);
		const percentageInputs = WARMUP_PERCENTAGES.map(
			(
				_perc: number,
				index: number, // Add types
			) => screen.getByLabelText(`Percentage for Set ${index + 1}`),
		);

		const defaultPercentages = [40, 55, 70, 80, 90];
		percentageInputs.forEach((input: HTMLElement, index: number) => {
			// Add types
			expect(input).toHaveValue(defaultPercentages[index]);
		});

		// Change the first warmup set percentage
		fireEvent.change(percentageInputs[0], { target: { value: "50" } });
		fireEvent.blur(percentageInputs[0]);
		await waitFor(() => {
			expect(percentageInputs[0]).toHaveValue(50);
		});

		// Check console log for percentage change
		// console.log calls are harder to assert directly without more setup or spies on console.log
	});

	it("recalculates warmup sets when percentages change", async () => {
		render(<BarbellCalculator />);
		const initialSet1Weight = screen.getByText((content, element) => {
			return element?.tagName.toLowerCase() === "h4" && content.startsWith("Set 1:");
		}).textContent;
		expect(initialSet1Weight).toContain("55.0lb");

		const percentageInputSet1 = screen.getByLabelText("Percentage for Set 1");
		fireEvent.change(percentageInputSet1, { target: { value: "50" } });
		fireEvent.blur(percentageInputSet1);

		await waitFor(() => {
			const updatedSet1Weight = screen.getByText((content, element) => {
				return element?.tagName.toLowerCase() === "h4" && content.startsWith("Set 1:");
			}).textContent;
			expect(updatedSet1Weight).toContain("70.0lb");
		});
	});

	it("saves warmup percentages to cookies when changed", async () => {
		render(<BarbellCalculator />);
		const percentageInputSet1 = screen.getByLabelText("Percentage for Set 1");

		fireEvent.change(percentageInputSet1, { target: { value: "45" } });
		fireEvent.blur(percentageInputSet1);

		await waitFor(() => {
			expect(Cookies.set).toHaveBeenCalledWith(
				"warmupPercentages",
				JSON.stringify([0.45, 0.55, 0.7, 0.8, 0.9]),
				{ expires: 365 },
			);
		});
	});

	it("loads warmup percentages from cookies on mount", () => {
		const storedPercentages = [0.3, 0.4, 0.5, 0.6, 0.7];
		(Cookies.get as Mock).mockReturnValue(JSON.stringify(storedPercentages));

		render(<BarbellCalculator />);
		const percentageInputs = storedPercentages.map((_perc: number, index: number) =>
			screen.getByLabelText(`Percentage for Set ${index + 1}`),
		);
		storedPercentages.forEach((perc, index) => {
			expect(percentageInputs[index]).toHaveValue(perc * 100);
		});
	});

	it("handles invalid cookie data gracefully", () => {
		(Cookies.get as Mock).mockReturnValue("invalid-json");
		render(<BarbellCalculator />);
		const percentageInputs = WARMUP_PERCENTAGES.map((_perc: number, index: number) =>
			screen.getByLabelText(`Percentage for Set ${index + 1}`),
		);
		const defaultPercentages = [40, 55, 70, 80, 90];
		percentageInputs.forEach((input: HTMLElement, index: number) => {
			expect(input).toHaveValue(defaultPercentages[index]);
		});
	});

	it("updates target weight from input", async () => {
		render(<BarbellCalculator />);
		const weightInput = screen.getByLabelText(/TARGET WEIGHT/i);
		fireEvent.change(weightInput, { target: { value: "200" } });
		fireEvent.submit(screen.getByRole("button", { name: /Calculate/i }));

		await waitFor(() => {
			expect(mockSetTargetWeightQuery).toHaveBeenCalledWith(200);
		});
	});

	it("switches units and recalculates", async () => {
		(nuqs.useQueryState as Mock).mockImplementation((key: string) => {
			// Use imported Mock type
			if (key === "weight") return [100, mockSetTargetWeightQuery]; // 100lb
			if (key === "units") return ["lb", mockSetUnits];
			if (key === "bar") return [45, mockSetBarWeightOption];
			return [null, vi.fn()];
		});

		const { rerender } = render(<BarbellCalculator />);
		expect(
			screen.getByText(
				(content, element) =>
					element?.tagName.toLowerCase() === "div" &&
					element.classList.contains("text-4xl") &&
					content.startsWith("100.0"),
			),
		).toBeInTheDocument();

		const set1TextLb = screen.getByText(
			(content, element) =>
				element?.tagName.toLowerCase() === "h4" && content.startsWith("Set 1:"),
		).textContent;
		expect(set1TextLb).toContain("45.0lb");

		// Switch to KG
		(nuqs.useQueryState as Mock).mockImplementation((key: string) => {
			// Use imported Mock type
			if (key === "weight") return [100, mockSetTargetWeightQuery]; // Still 100 (nuqs stores it as entered)
			if (key === "units") return ["kg", mockSetUnits]; // KG selected
			if (key === "bar") return [45, mockSetBarWeightOption]; // Bar is 45lb
			return [null, vi.fn()];
		});

		// Simulate the unit change effect by re-rendering with new query state values
		rerender(<BarbellCalculator />);

		// 100lb target -> 45.3592 kg, rounded to 45kg
		// Bar 45lb -> 20.41 kg, rounded to 20kg
		// Warmup set 1: 40% of 45kg = 18kg. Bar is 20kg. So set is 20kg.
		await waitFor(() => {
			expect(
				screen.getByText(
					(content, element) =>
						element?.tagName.toLowerCase() === "div" &&
						element.classList.contains("text-4xl") &&
						content.startsWith("45.0"),
				),
			).toBeInTheDocument();
			const kgRadio = screen.getByRole("radio", { name: "KG" });
			expect(kgRadio).toBeChecked();
			const set1TextKg = screen.getByText(
				(content, element) =>
					element?.tagName.toLowerCase() === "h4" && content.startsWith("Set 1:"),
			).textContent;
			expect(set1TextKg).toContain("20.0kg");
		});
	});
});
