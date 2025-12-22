"use client"

import {
	INSERT_ORDERED_LIST_COMMAND,
	INSERT_UNORDERED_LIST_COMMAND,
} from "@lexical/list"
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import { $getSelection, $isRangeSelection, FORMAT_TEXT_COMMAND } from "lexical"
import {
	Bold,
	Italic,
	Link as LinkIcon,
	List,
	ListOrdered,
	Underline,
} from "lucide-react"
import { useCallback, useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip"

/**
 * Toolbar for the waivers editor with formatting controls.
 * Includes: bold, italic, underline, ordered/unordered lists, links.
 */
export function WaiversEditorToolbar() {
	const [editor] = useLexicalComposerContext()
	const [isBold, setIsBold] = useState(false)
	const [isItalic, setIsItalic] = useState(false)
	const [isUnderline, setIsUnderline] = useState(false)

	// Update toolbar state when selection changes
	const updateToolbar = useCallback(() => {
		const selection = $getSelection()
		if ($isRangeSelection(selection)) {
			setIsBold(selection.hasFormat("bold"))
			setIsItalic(selection.hasFormat("italic"))
			setIsUnderline(selection.hasFormat("underline"))
		}
	}, [])

	useEffect(() => {
		return editor.registerUpdateListener(({ editorState }) => {
			editorState.read(() => {
				updateToolbar()
			})
		})
	}, [editor, updateToolbar])

	const formatText = (format: "bold" | "italic" | "underline") => {
		editor.dispatchCommand(FORMAT_TEXT_COMMAND, format)
	}

	const insertList = (listType: "bullet" | "number") => {
		if (listType === "bullet") {
			editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)
		} else {
			editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)
		}
	}

	const insertLink = () => {
		// Basic link insertion - could be enhanced with a dialog for URL input
		const url = window.prompt("Enter URL:")
		if (url) {
			editor.dispatchCommand("INSERT_LINK" as never, { url } as never)
		}
	}

	return (
		<div className="flex items-center gap-1 border-b p-2">
			{/* Text formatting */}
			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						variant={isBold ? "secondary" : "ghost"}
						size="sm"
						onClick={() => formatText("bold")}
						type="button"
					>
						<Bold className="h-4 w-4" />
					</Button>
				</TooltipTrigger>
				<TooltipContent>Bold</TooltipContent>
			</Tooltip>

			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						variant={isItalic ? "secondary" : "ghost"}
						size="sm"
						onClick={() => formatText("italic")}
						type="button"
					>
						<Italic className="h-4 w-4" />
					</Button>
				</TooltipTrigger>
				<TooltipContent>Italic</TooltipContent>
			</Tooltip>

			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						variant={isUnderline ? "secondary" : "ghost"}
						size="sm"
						onClick={() => formatText("underline")}
						type="button"
					>
						<Underline className="h-4 w-4" />
					</Button>
				</TooltipTrigger>
				<TooltipContent>Underline</TooltipContent>
			</Tooltip>

			<Separator orientation="vertical" className="mx-1 h-6" />

			{/* Lists */}
			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						variant="ghost"
						size="sm"
						onClick={() => insertList("bullet")}
						type="button"
					>
						<List className="h-4 w-4" />
					</Button>
				</TooltipTrigger>
				<TooltipContent>Bullet List</TooltipContent>
			</Tooltip>

			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						variant="ghost"
						size="sm"
						onClick={() => insertList("number")}
						type="button"
					>
						<ListOrdered className="h-4 w-4" />
					</Button>
				</TooltipTrigger>
				<TooltipContent>Numbered List</TooltipContent>
			</Tooltip>

			<Separator orientation="vertical" className="mx-1 h-6" />

			{/* Links */}
			<Tooltip>
				<TooltipTrigger asChild>
					<Button variant="ghost" size="sm" onClick={insertLink} type="button">
						<LinkIcon className="h-4 w-4" />
					</Button>
				</TooltipTrigger>
				<TooltipContent>Insert Link</TooltipContent>
			</Tooltip>
		</div>
	)
}
