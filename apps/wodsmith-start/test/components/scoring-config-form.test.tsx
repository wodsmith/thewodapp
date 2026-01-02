import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ScoringConfigForm } from "@/components/compete/scoring-config-form"
import type { ScoringConfig } from "@/types/scoring"

/**
 * Creates a default ScoringConfig for testing
 */
function createDefaultConfig(
	overrides: Partial<ScoringConfig> = {},
): ScoringConfig {
	return {
		algorithm: "traditional",
		traditional: { step: 5, firstPlacePoints: 100 },
		tiebreaker: { primary: "countback" },
		statusHandling: { dnf: "last_place", dns: "zero", withdrawn: "exclude" },
		...overrides,
	}
}

describe("ScoringConfigForm", () => {
	let onChange: ReturnType<typeof vi.fn>

	beforeEach(() => {
		onChange = vi.fn()
	})

	describe("Rendering", () => {
		it("renders with traditional algorithm selected by default", () => {
			render(
				<ScoringConfigForm value={createDefaultConfig()} onChange={onChange} />,
			)

			expect(screen.getByText("Scoring Configuration")).toBeInTheDocument()
			expect(screen.getByLabelText(/traditional/i)).toBeChecked()
		})

		it("renders all three algorithm options", () => {
			render(
				<ScoringConfigForm value={createDefaultConfig()} onChange={onChange} />,
			)

			expect(screen.getByLabelText(/traditional/i)).toBeInTheDocument()
			expect(screen.getByLabelText(/p-score/i)).toBeInTheDocument()
			expect(screen.getByLabelText(/custom/i)).toBeInTheDocument()
		})

		it("renders tiebreaker section", () => {
			render(
				<ScoringConfigForm value={createDefaultConfig()} onChange={onChange} />,
			)

			expect(screen.getByText("Tiebreakers")).toBeInTheDocument()
			expect(screen.getByText(/countback/i)).toBeInTheDocument()
		})

		it("renders DNF/DNS handling section", () => {
			render(
				<ScoringConfigForm value={createDefaultConfig()} onChange={onChange} />,
			)

			expect(screen.getByText("DNF/DNS Handling")).toBeInTheDocument()
			expect(screen.getByLabelText(/dnf/i)).toBeInTheDocument()
			expect(screen.getByLabelText(/dns/i)).toBeInTheDocument()
			expect(screen.getByLabelText(/wd/i)).toBeInTheDocument()
		})

		it("disables all inputs when disabled prop is true", () => {
			render(
				<ScoringConfigForm
					value={createDefaultConfig()}
					onChange={onChange}
					disabled
				/>,
			)

			const radios = screen.getAllByRole("radio")
			for (const radio of radios) {
				expect(radio).toBeDisabled()
			}
		})
	})

	describe("Traditional Algorithm", () => {
		it("shows step input when traditional is selected", () => {
			render(
				<ScoringConfigForm value={createDefaultConfig()} onChange={onChange} />,
			)

			expect(screen.getByLabelText(/step/i)).toBeInTheDocument()
			expect(screen.getByLabelText(/step/i)).toHaveValue(5)
		})

		it("calls onChange when step value changes", () => {
			render(
				<ScoringConfigForm value={createDefaultConfig()} onChange={onChange} />,
			)

			const stepInput = screen.getByLabelText(/step/i)
			fireEvent.change(stepInput, { target: { value: "10" } })

			expect(onChange).toHaveBeenCalledWith(
				expect.objectContaining({
					traditional: expect.objectContaining({ step: 10 }),
				}),
			)
		})
	})

	describe("P-Score Algorithm", () => {
		it("shows P-Score options when selected", () => {
			const config = createDefaultConfig({ algorithm: "p_score" })

			render(<ScoringConfigForm value={config} onChange={onChange} />)

			expect(screen.getByLabelText(/allow negative/i)).toBeInTheDocument()
			expect(screen.getByLabelText(/median/i)).toBeInTheDocument()
		})

		it("calls onChange when algorithm changes to p_score", () => {
			render(
				<ScoringConfigForm value={createDefaultConfig()} onChange={onChange} />,
			)

			fireEvent.click(screen.getByLabelText(/p-score/i))

			expect(onChange).toHaveBeenCalledWith(
				expect.objectContaining({
					algorithm: "p_score",
				}),
			)
		})

		it("toggles allow negative scores checkbox", () => {
			const config = createDefaultConfig({
				algorithm: "p_score",
				pScore: { allowNegatives: true, medianField: "top_half" },
			})

			render(<ScoringConfigForm value={config} onChange={onChange} />)

			const checkbox = screen.getByLabelText(/allow negative/i)
			fireEvent.click(checkbox)

			expect(onChange).toHaveBeenCalledWith(
				expect.objectContaining({
					pScore: expect.objectContaining({ allowNegatives: false }),
				}),
			)
		})
	})

	describe("Custom Algorithm", () => {
		it("shows custom options when selected", () => {
			const config = createDefaultConfig({
				algorithm: "custom",
				customTable: { baseTemplate: "traditional", overrides: {} },
			})

			render(<ScoringConfigForm value={config} onChange={onChange} />)

			expect(screen.getByLabelText(/based on/i)).toBeInTheDocument()
			expect(
				screen.getByRole("button", { name: /edit points/i }),
			).toBeInTheDocument()
		})

		it("changes base template selection", () => {
			const config = createDefaultConfig({
				algorithm: "custom",
				customTable: { baseTemplate: "traditional", overrides: {} },
			})

			render(<ScoringConfigForm value={config} onChange={onChange} />)

			const select = screen.getByLabelText(/based on/i)
			fireEvent.click(select)
			fireEvent.click(screen.getByRole("option", { name: /p.score/i }))

			expect(onChange).toHaveBeenCalledWith(
				expect.objectContaining({
					customTable: expect.objectContaining({ baseTemplate: "p_score" }),
				}),
			)
		})
	})

	describe("Tiebreaker Configuration", () => {
		it("shows secondary tiebreaker options", () => {
			render(
				<ScoringConfigForm value={createDefaultConfig()} onChange={onChange} />,
			)

			// Check for "Secondary:" text and the radio options
			expect(screen.getByText(/secondary/i)).toBeInTheDocument()
			expect(screen.getByLabelText(/^none$/i)).toBeInTheDocument()
			expect(screen.getByLabelText(/head-to-head/i)).toBeInTheDocument()
		})

		it("shows event select when head-to-head is chosen and events provided", () => {
			const config = createDefaultConfig({
				tiebreaker: { primary: "countback", secondary: "head_to_head" },
			})
			const events = [
				{ id: "event-1", name: "Fran" },
				{ id: "event-2", name: "Grace" },
			]

			render(
				<ScoringConfigForm
					value={config}
					onChange={onChange}
					events={events}
				/>,
			)

			expect(screen.getByLabelText(/event/i)).toBeInTheDocument()
		})

		it("does not show event select when no events provided", () => {
			const config = createDefaultConfig({
				tiebreaker: { primary: "countback", secondary: "head_to_head" },
			})

			render(<ScoringConfigForm value={config} onChange={onChange} />)

			expect(screen.queryByLabelText(/event/i)).not.toBeInTheDocument()
		})
	})

	describe("Status Handling", () => {
		it("changes DNF handling option", () => {
			render(
				<ScoringConfigForm value={createDefaultConfig()} onChange={onChange} />,
			)

			const dnfSelect = screen.getByLabelText(/dnf/i)
			fireEvent.click(dnfSelect)
			fireEvent.click(screen.getByRole("option", { name: /zero points/i }))

			expect(onChange).toHaveBeenCalledWith(
				expect.objectContaining({
					statusHandling: expect.objectContaining({ dnf: "zero" }),
				}),
			)
		})

		it("changes DNS handling option", () => {
			render(
				<ScoringConfigForm value={createDefaultConfig()} onChange={onChange} />,
			)

			const dnsSelect = screen.getByLabelText(/dns/i)
			fireEvent.click(dnsSelect)
			fireEvent.click(screen.getByRole("option", { name: /exclude/i }))

			expect(onChange).toHaveBeenCalledWith(
				expect.objectContaining({
					statusHandling: expect.objectContaining({ dns: "exclude" }),
				}),
			)
		})

		it("changes withdrawn handling option", () => {
			render(
				<ScoringConfigForm value={createDefaultConfig()} onChange={onChange} />,
			)

			const wdSelect = screen.getByLabelText(/wd/i)
			fireEvent.click(wdSelect)
			fireEvent.click(screen.getByRole("option", { name: /zero points/i }))

			expect(onChange).toHaveBeenCalledWith(
				expect.objectContaining({
					statusHandling: expect.objectContaining({ withdrawn: "zero" }),
				}),
			)
		})
	})

	describe("Controlled Component Behavior", () => {
		it("reflects external value changes", () => {
			const { rerender } = render(
				<ScoringConfigForm value={createDefaultConfig()} onChange={onChange} />,
			)

			expect(screen.getByLabelText(/traditional/i)).toBeChecked()

			rerender(
				<ScoringConfigForm
					value={createDefaultConfig({ algorithm: "p_score" })}
					onChange={onChange}
				/>,
			)

			expect(screen.getByLabelText(/p-score/i)).toBeChecked()
		})
	})
})
