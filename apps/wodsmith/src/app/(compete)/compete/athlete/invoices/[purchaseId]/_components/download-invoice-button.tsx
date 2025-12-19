"use client"

import { Download, Loader2 } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import type { InvoiceDetails } from "@/server/commerce"

type DownloadInvoiceButtonProps = {
	invoice: InvoiceDetails
}

export function DownloadInvoiceButton({ invoice }: DownloadInvoiceButtonProps) {
	const [isGenerating, setIsGenerating] = useState(false)

	const handleDownload = async () => {
		setIsGenerating(true)
		try {
			// Dynamically import PDF libraries to avoid SSR issues
			const { pdf } = await import("@react-pdf/renderer")
			const { InvoicePDF } = await import("./invoice-pdf")

			const blob = await pdf(<InvoicePDF invoice={invoice} />).toBlob()
			const url = URL.createObjectURL(blob)
			const link = document.createElement("a")
			link.href = url
			link.download = `invoice-${invoice.id}.pdf`
			document.body.appendChild(link)
			link.click()
			document.body.removeChild(link)
			URL.revokeObjectURL(url)
		} catch (error) {
			console.error("Failed to generate PDF:", error)
		} finally {
			setIsGenerating(false)
		}
	}

	return (
		<Button
			variant="outline"
			size="sm"
			onClick={handleDownload}
			disabled={isGenerating}
		>
			{isGenerating ? (
				<Loader2 className="mr-2 h-4 w-4 animate-spin" />
			) : (
				<Download className="mr-2 h-4 w-4" />
			)}
			Download PDF
		</Button>
	)
}
