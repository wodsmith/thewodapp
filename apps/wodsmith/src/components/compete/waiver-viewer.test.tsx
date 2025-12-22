import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"
import type { SerializedEditorState } from "lexical"
import { describe, expect, it } from "vitest"
import { WaiverViewer } from "./waiver-viewer"

describe("WaiverViewer", () => {
	it("renders markdown content from Lexical JSON", () => {
		const content: SerializedEditorState = {
			root: {
				children: [
					{
						children: [
							{
								type: "text",
								text: "This is a waiver agreement.",
							},
						],
						type: "paragraph",
					},
				],
				type: "root",
			},
		}

		render(<WaiverViewer content={content} />)

		expect(screen.getByText("This is a waiver agreement.")).toBeInTheDocument()
	})

	it("renders bold text with markdown formatting", () => {
		const content: SerializedEditorState = {
			root: {
				children: [
					{
						children: [
							{
								type: "text",
								text: "Important",
								format: 1, // Bold
							},
						],
						type: "paragraph",
					},
				],
				type: "root",
			},
		}

		render(<WaiverViewer content={content} />)

		const boldText = screen.getByText("Important")
		expect(boldText).toBeInTheDocument()
		// react-markdown renders **text** as <strong>
		expect(boldText.tagName.toLowerCase()).toBe("strong")
	})

	it("renders italic text with markdown formatting", () => {
		const content: SerializedEditorState = {
			root: {
				children: [
					{
						children: [
							{
								type: "text",
								text: "Note",
								format: 2, // Italic
							},
						],
						type: "paragraph",
					},
				],
				type: "root",
			},
		}

		render(<WaiverViewer content={content} />)

		const italicText = screen.getByText("Note")
		expect(italicText).toBeInTheDocument()
		// react-markdown renders *text* as <em>
		expect(italicText.tagName.toLowerCase()).toBe("em")
	})

	it("renders links with target=_blank and noopener noreferrer", () => {
		const content: SerializedEditorState = {
			root: {
				children: [
					{
						children: [
							{
								type: "text",
								text: "Read our ",
							},
							{
								type: "link",
								url: "https://example.com/policy",
								children: [
									{
										type: "text",
										text: "privacy policy",
									},
								],
							},
						],
						type: "paragraph",
					},
				],
				type: "root",
			},
		}

		render(<WaiverViewer content={content} />)

		const link = screen.getByRole("link", { name: "privacy policy" })
		expect(link).toBeInTheDocument()
		expect(link).toHaveAttribute("href", "https://example.com/policy")
		expect(link).toHaveAttribute("target", "_blank")
		expect(link).toHaveAttribute("rel", "noopener noreferrer")
	})

	it("renders headings with correct levels", () => {
		const content: SerializedEditorState = {
			root: {
				children: [
					{
						type: "heading",
						tag: "h1",
						children: [
							{
								type: "text",
								text: "Waiver Title",
							},
						],
					},
					{
						type: "heading",
						tag: "h2",
						children: [
							{
								type: "text",
								text: "Section 1",
							},
						],
					},
				],
				type: "root",
			},
		}

		render(<WaiverViewer content={content} />)

		const h1 = screen.getByRole("heading", { level: 1, name: "Waiver Title" })
		expect(h1).toBeInTheDocument()

		const h2 = screen.getByRole("heading", { level: 2, name: "Section 1" })
		expect(h2).toBeInTheDocument()
	})

	it("renders bullet lists", () => {
		const content: SerializedEditorState = {
			root: {
				children: [
					{
						type: "list",
						listType: "bullet",
						children: [
							{
								type: "listitem",
								children: [
									{
										type: "text",
										text: "Item 1",
									},
								],
							},
							{
								type: "listitem",
								children: [
									{
										type: "text",
										text: "Item 2",
									},
								],
							},
						],
					},
				],
				type: "root",
			},
		}

		render(<WaiverViewer content={content} />)

		expect(screen.getByText("Item 1")).toBeInTheDocument()
		expect(screen.getByText("Item 2")).toBeInTheDocument()
	})

	it("renders numbered lists", () => {
		const content: SerializedEditorState = {
			root: {
				children: [
					{
						type: "list",
						listType: "number",
						children: [
							{
								type: "listitem",
								children: [
									{
										type: "text",
										text: "First step",
									},
								],
							},
							{
								type: "listitem",
								children: [
									{
										type: "text",
										text: "Second step",
									},
								],
							},
						],
					},
				],
				type: "root",
			},
		}

		render(<WaiverViewer content={content} />)

		expect(screen.getByText("First step")).toBeInTheDocument()
		expect(screen.getByText("Second step")).toBeInTheDocument()
	})

	it("renders quotes with blockquote styling", () => {
		const content: SerializedEditorState = {
			root: {
				children: [
					{
						type: "quote",
						children: [
							{
								type: "text",
								text: "This is an important quote.",
							},
						],
					},
				],
				type: "root",
			},
		}

		render(<WaiverViewer content={content} />)

		const quote = screen.getByText("This is an important quote.")
		expect(quote).toBeInTheDocument()
		// react-markdown renders > text as <blockquote>
		const blockquote = quote.closest("blockquote")
		expect(blockquote).toBeInTheDocument()
	})

	it("handles empty content gracefully", () => {
		const content: SerializedEditorState = {
			root: {
				children: [],
				type: "root",
			},
		}

		const { container } = render(<WaiverViewer content={content} />)

		// Should render div wrapper but with empty markdown content
		expect(container.querySelector("div")).toBeInTheDocument()
	})

	it("handles content with missing root", () => {
		const content = {} as SerializedEditorState

		const { container } = render(<WaiverViewer content={content} />)

		// Should render wrapper but with empty content
		expect(container.querySelector("div")).toBeInTheDocument()
	})

	it("applies custom className to wrapper", () => {
		const content: SerializedEditorState = {
			root: {
				children: [
					{
						children: [
							{
								type: "text",
								text: "Test content",
							},
						],
						type: "paragraph",
					},
				],
				type: "root",
			},
		}

		const { container } = render(
			<WaiverViewer content={content} className="border rounded-lg p-4" />,
		)

		const wrapper = container.firstChild as HTMLElement
		expect(wrapper).toHaveClass("border", "rounded-lg", "p-4")
	})

	it("renders complex nested content correctly", () => {
		const content: SerializedEditorState = {
			root: {
				children: [
					{
						type: "heading",
						tag: "h1",
						children: [
							{
								type: "text",
								text: "Competition Waiver",
							},
						],
					},
					{
						children: [
							{
								type: "text",
								text: "By participating in this event, you agree to:",
							},
						],
						type: "paragraph",
					},
					{
						type: "list",
						listType: "bullet",
						children: [
							{
								type: "listitem",
								children: [
									{
										type: "text",
										text: "Follow all safety protocols",
										format: 1, // Bold
									},
								],
							},
							{
								type: "listitem",
								children: [
									{
										type: "text",
										text: "Accept all risks",
									},
								],
							},
						],
					},
					{
						children: [
							{
								type: "text",
								text: "For more information, visit ",
							},
							{
								type: "link",
								url: "https://example.com/terms",
								children: [
									{
										type: "text",
										text: "our terms page",
									},
								],
							},
						],
						type: "paragraph",
					},
				],
				type: "root",
			},
		}

		render(<WaiverViewer content={content} />)

		// Check heading
		expect(
			screen.getByRole("heading", { level: 1, name: "Competition Waiver" }),
		).toBeInTheDocument()

		// Check paragraph
		expect(
			screen.getByText(/By participating in this event, you agree to:/),
		).toBeInTheDocument()

		// Check list items with bold formatting
		const boldItem = screen.getByText("Follow all safety protocols")
		expect(boldItem.tagName.toLowerCase()).toBe("strong")
		expect(screen.getByText("Accept all risks")).toBeInTheDocument()

		// Check link
		const link = screen.getByRole("link", { name: "our terms page" })
		expect(link).toHaveAttribute("href", "https://example.com/terms")
		expect(link).toHaveAttribute("target", "_blank")
		expect(link).toHaveAttribute("rel", "noopener noreferrer")
	})

	it("renders multiple links correctly", () => {
		const content: SerializedEditorState = {
			root: {
				children: [
					{
						children: [
							{
								type: "text",
								text: "Check our ",
							},
							{
								type: "link",
								url: "https://example.com/privacy",
								children: [
									{
										type: "text",
										text: "privacy policy",
									},
								],
							},
							{
								type: "text",
								text: " and ",
							},
							{
								type: "link",
								url: "https://example.com/terms",
								children: [
									{
										type: "text",
										text: "terms of service",
									},
								],
							},
						],
						type: "paragraph",
					},
				],
				type: "root",
			},
		}

		render(<WaiverViewer content={content} />)

		const privacyLink = screen.getByRole("link", { name: "privacy policy" })
		expect(privacyLink).toHaveAttribute("href", "https://example.com/privacy")
		expect(privacyLink).toHaveAttribute("target", "_blank")

		const termsLink = screen.getByRole("link", { name: "terms of service" })
		expect(termsLink).toHaveAttribute("href", "https://example.com/terms")
		expect(termsLink).toHaveAttribute("target", "_blank")
	})

	it("link has correct CSS classes for styling", () => {
		const content: SerializedEditorState = {
			root: {
				children: [
					{
						children: [
							{
								type: "link",
								url: "https://example.com",
								children: [
									{
										type: "text",
										text: "Click here",
									},
								],
							},
						],
						type: "paragraph",
					},
				],
				type: "root",
			},
		}

		render(<WaiverViewer content={content} />)

		const link = screen.getByRole("link", { name: "Click here" })
		expect(link).toHaveClass(
			"text-primary",
			"underline",
			"hover:text-primary/80",
		)
	})
})
