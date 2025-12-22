"use client"

import { AutoLinkNode, LinkNode } from "@lexical/link"
import { ListItemNode, ListNode } from "@lexical/list"
import type { InitialConfigType } from "@lexical/react/LexicalComposer"
import { LexicalComposer } from "@lexical/react/LexicalComposer"
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary"
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

const viewerConfig: InitialConfigType = {
	namespace: "WaiverViewer",
	theme: editorTheme,
	nodes,
	editable: false,
	onError: (error: Error) => {
		console.error("WaiverViewer error:", error)
	},
}

interface WaiverViewerProps {
	content: SerializedEditorState
	className?: string
}

/**
 * Read-only display component for competition waiver content.
 * Used by athletes when viewing/signing waivers.
 *
 * @example
 * ```tsx
 * <WaiverViewer
 *   content={competition.waiverContent}
 *   className="border rounded-lg p-4"
 * />
 * ```
 */
export function WaiverViewer({ content, className }: WaiverViewerProps) {
	return (
		<div className={className}>
			<LexicalComposer
				initialConfig={{
					...viewerConfig,
					editorState: JSON.stringify(content),
				}}
			>
				<RichTextPlugin
					contentEditable={
						<div className="prose prose-sm max-w-none dark:prose-invert">
							<ContentEditable placeholder="" />
						</div>
					}
					ErrorBoundary={LexicalErrorBoundary}
				/>
			</LexicalComposer>
		</div>
	)
}
