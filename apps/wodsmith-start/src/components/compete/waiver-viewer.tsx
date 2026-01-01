"use client"

import type { SerializedEditorState } from "lexical"
import { useMemo } from "react"
import Markdown from "react-markdown"

/**
 * Safely parse JSON string to Lexical editor state.
 * Returns null if parsing fails.
 */
function parseWaiverContent(content: string): SerializedEditorState | null {
	try {
		return JSON.parse(content) as SerializedEditorState
	} catch {
		return null
	}
}

/**
 * Extract plain text content from Lexical JSON, preserving markdown syntax.
 * Converts Lexical's structured format back to readable text with paragraphs.
 */
function extractTextFromLexical(content: SerializedEditorState): string {
	function processNode(node: Record<string, unknown>): string {
		// Text node - return the text with formatting
		if (node.type === "text" && typeof node.text === "string") {
			let text = node.text

			// Apply formatting as markdown
			if (typeof node.format === "number") {
				const format = node.format as number
				// Bold = 1, Italic = 2, Underline = 8
				if (format & 1) text = `**${text}**`
				if (format & 2) text = `*${text}*`
			}

			return text
		}

		// Nodes with children - process recursively
		if (Array.isArray(node.children)) {
			const childTexts = (node.children as Record<string, unknown>[])
				.map((child) => processNode(child))
				.join("")

			// Handle different node types
			switch (node.type) {
				case "paragraph":
					return `${childTexts}\n\n`
				case "heading": {
					const level = (node.tag as string)?.replace("h", "") || "1"
					const hashes = "#".repeat(Number.parseInt(level, 10))
					return `${hashes} ${childTexts}\n\n`
				}
				case "list": {
					return `${childTexts}\n`
				}
				case "listitem": {
					const listType = node.listType as string
					const prefix = listType === "number" ? "1." : "-"
					return `${prefix} ${childTexts.trim()}\n`
				}
				case "quote":
					return `> ${childTexts.trim()}\n\n`
				case "link":
					return `[${childTexts}](${node.url})`
				default:
					return childTexts
			}
		}

		return ""
	}

	if (content.root && typeof content.root === "object") {
		const result = processNode(content.root as Record<string, unknown>)
		return result.trim()
	}

	return ""
}

interface WaiverViewerProps {
	/** Raw JSON string from the database (Lexical editor state) */
	content: string
	className?: string
}

/**
 * Read-only display component for competition waiver content.
 * Accepts raw JSON string and handles parsing internally with error handling.
 * Extracts text from Lexical JSON and renders as markdown.
 * Supports links, bold, italic, lists, headings, and quotes.
 *
 * @example
 * ```tsx
 * <WaiverViewer
 *   content={waiver.content}
 *   className="border rounded-lg p-4"
 * />
 * ```
 */
export function WaiverViewer({ content, className }: WaiverViewerProps) {
	const markdown = useMemo(() => {
		const parsed = parseWaiverContent(content)
		if (!parsed) {
			return "*Unable to display waiver content*"
		}
		return extractTextFromLexical(parsed)
	}, [content])

	return (
		<div className={className}>
			<Markdown
				components={{
					// Open links in new tab
					a: ({ children, href }) => (
						<a
							href={href}
							target="_blank"
							rel="noopener noreferrer"
							className="text-primary underline hover:text-primary/80"
						>
							{children}
						</a>
					),
				}}
			>
				{markdown}
			</Markdown>
		</div>
	)
}
