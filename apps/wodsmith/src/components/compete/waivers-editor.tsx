"use client"

import { AutoLinkNode, LinkNode } from "@lexical/link"
import { ListItemNode, ListNode } from "@lexical/list"
import type { InitialConfigType } from "@lexical/react/LexicalComposer"
import { LexicalComposer } from "@lexical/react/LexicalComposer"
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary"
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin"
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin"
import { ListPlugin } from "@lexical/react/LexicalListPlugin"

import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin"
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin"
import { HeadingNode, QuoteNode } from "@lexical/rich-text"
import type {
	Klass,
	LexicalNode,
	LexicalNodeReplacement,
	SerializedEditorState,
} from "lexical"
import { ParagraphNode, TextNode } from "lexical"

import { ContentEditable } from "@/components/editor/editor-ui/content-editable"
import { editorTheme } from "@/components/editor/themes/editor-theme"
import { TooltipProvider } from "@/components/ui/tooltip"

import { WaiversEditorToolbar } from "./waivers-editor-toolbar"

const nodes: ReadonlyArray<Klass<LexicalNode> | LexicalNodeReplacement> = [
	HeadingNode,
	ParagraphNode,
	TextNode,
	QuoteNode,
	ListNode,
	ListItemNode,
	LinkNode,
	AutoLinkNode,
]

const editorConfig: InitialConfigType = {
	namespace: "WaiversEditor",
	theme: editorTheme,
	nodes,
	onError: (error: Error) => {
		console.error("WaiversEditor error:", error)
	},
}

interface WaiversEditorProps {
	value?: SerializedEditorState
	onChange?: (value: SerializedEditorState) => void
	placeholder?: string
	/** Max height for the content area (toolbar stays fixed). Use CSS value like "50vh" or "300px" */
	maxContentHeight?: string
}

/**
 * WYSIWYG editor for creating competition waiver content.
 * Wraps Lexical editor with rich text toolbar (bold, italic, lists, links).
 *
 * @example
 * ```tsx
 * const [waiverContent, setWaiverContent] = useState<SerializedEditorState>()
 *
 * <WaiversEditor
 *   value={waiverContent}
 *   onChange={setWaiverContent}
 *   placeholder="Enter waiver terms and conditions..."
 * />
 * ```
 */
export function WaiversEditor({
	value,
	onChange,
	placeholder = "Enter waiver content...",
	maxContentHeight,
}: WaiversEditorProps) {
	return (
		<div className="overflow-hidden rounded-lg border shadow">
			<LexicalComposer
				initialConfig={{
					...editorConfig,
					...(value ? { editorState: JSON.stringify(value) } : {}),
				}}
			>
				<TooltipProvider>
					<div className="relative flex flex-col">
						<WaiversEditorToolbar />
						<div
							className="relative overflow-y-auto"
							style={
								maxContentHeight ? { maxHeight: maxContentHeight } : undefined
							}
						>
							<RichTextPlugin
								contentEditable={
									<div className="min-h-[200px]">
										<ContentEditable placeholder={placeholder} />
									</div>
								}
								ErrorBoundary={LexicalErrorBoundary}
							/>
						</div>
					</div>

					<HistoryPlugin />
					<ListPlugin />
					<LinkPlugin />
					<OnChangePlugin
						ignoreSelectionChange={true}
						onChange={(editorState) => {
							onChange?.(editorState.toJSON())
						}}
					/>
				</TooltipProvider>
			</LexicalComposer>
		</div>
	)
}
