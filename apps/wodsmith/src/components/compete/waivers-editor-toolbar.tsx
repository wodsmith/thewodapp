"use client"

import {
	INSERT_ORDERED_LIST_COMMAND,
	INSERT_UNORDERED_LIST_COMMAND,
} from "@lexical/list"
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import {
	$createTextNode,
	$getSelection,
	$isRangeSelection,
	FORMAT_TEXT_COMMAND,
} from "lexical"
import {
	Bold,
	Italic,
	Link as LinkIcon,
	List,
	ListOrdered,
	Underline,
} from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover"
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
	const [linkPopoverOpen, setLinkPopoverOpen] = useState(false)
	const [linkText, setLinkText] = useState("")
	const [linkUrl, setLinkUrl] = useState("")
	const urlInputRef = useRef<HTMLInputElement>(null)

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

	const handleLinkPopoverOpen = (open: boolean) => {
		setLinkPopoverOpen(open)
		if (open) {
			// Check if there's selected text to use as link text
			editor.getEditorState().read(() => {
				const selection = $getSelection()
				if ($isRangeSelection(selection)) {
					const selectedText = selection.getTextContent()
					if (selectedText) {
						setLinkText(selectedText)
					}
				}
			})
			// Focus URL input after popover opens
			setTimeout(() => urlInputRef.current?.focus(), 0)
		} else {
			// Reset form when closing
			setLinkText("")
			setLinkUrl("")
		}
	}

	const insertMarkdownLink = () => {
		if (!linkUrl.trim()) return

		const text = linkText.trim() || linkUrl.trim()
		const markdownLink = `[${text}](${linkUrl.trim()})`

		editor.update(() => {
			const selection = $getSelection()
			if ($isRangeSelection(selection)) {
				// If there was selected text, replace it with the link
				selection.insertNodes([$createTextNode(markdownLink)])
			}
		})

		setLinkPopoverOpen(false)
		setLinkText("")
		setLinkUrl("")
	}

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			e.preventDefault()
			insertMarkdownLink()
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
			<Popover open={linkPopoverOpen} onOpenChange={handleLinkPopoverOpen}>
				<Tooltip>
					<TooltipTrigger asChild>
						<PopoverTrigger asChild>
							<Button variant="ghost" size="sm" type="button">
								<LinkIcon className="h-4 w-4" />
							</Button>
						</PopoverTrigger>
					</TooltipTrigger>
					<TooltipContent>Insert Link</TooltipContent>
				</Tooltip>
				<PopoverContent className="w-80" align="start">
					<div className="grid gap-4">
						<div className="space-y-2">
							<h4 className="font-medium leading-none">Insert Link</h4>
							<p className="text-muted-foreground text-sm">
								Add a markdown-style link to your waiver.
							</p>
						</div>
						<div className="grid gap-3">
							<div className="grid gap-2">
								<Label htmlFor="link-text">Link Text</Label>
								<Input
									id="link-text"
									placeholder="Click here"
									value={linkText}
									onChange={(e) => setLinkText(e.target.value)}
									onKeyDown={handleKeyDown}
								/>
							</div>
							<div className="grid gap-2">
								<Label htmlFor="link-url">URL</Label>
								<Input
									ref={urlInputRef}
									id="link-url"
									placeholder="https://example.com"
									value={linkUrl}
									onChange={(e) => setLinkUrl(e.target.value)}
									onKeyDown={handleKeyDown}
								/>
							</div>
							<Button
								type="button"
								size="sm"
								onClick={insertMarkdownLink}
								disabled={!linkUrl.trim()}
							>
								Insert Link
							</Button>
						</div>
					</div>
				</PopoverContent>
			</Popover>
		</div>
	)
}
