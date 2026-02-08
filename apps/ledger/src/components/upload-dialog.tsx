import { useServerFn } from "@tanstack/react-start"
import { Sparkles, Upload, X } from "lucide-react"
import { useRef, useState } from "react"
import {
	DOCUMENT_CATEGORIES,
	PAYMENT_STATUSES,
	SUBSCRIPTION_TERMS,
} from "@/db/schema"
import { analyzeDocumentFn } from "@/server-fns/analyzer"
import { uploadDocumentFn } from "@/server-fns/documents"

interface UploadDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	onUploadComplete: () => void
}

export function UploadDialog({
	open,
	onOpenChange,
	onUploadComplete,
}: UploadDialogProps) {
	const uploadFn = useServerFn(uploadDocumentFn)
	const analyzeFn = useServerFn(analyzeDocumentFn)
	const fileInputRef = useRef<HTMLInputElement>(null)
	const [uploading, setUploading] = useState(false)
	const [analyzing, setAnalyzing] = useState(false)
	const [error, setError] = useState("")
	const [selectedFile, setSelectedFile] = useState<File | null>(null)

	const [vendor, setVendor] = useState("")
	const [description, setDescription] = useState("")
	const [amount, setAmount] = useState("")
	const [currency, setCurrency] = useState("USD")
	const [subscriptionTerm, setSubscriptionTerm] = useState("")
	const [category, setCategory] = useState("")
	const [invoiceDate, setInvoiceDate] = useState("")
	const [dueDate, setDueDate] = useState("")
	const [status, setStatus] = useState("unpaid")

	const resetForm = () => {
		setSelectedFile(null)
		setVendor("")
		setDescription("")
		setAmount("")
		setCurrency("USD")
		setSubscriptionTerm("")
		setCategory("")
		setInvoiceDate("")
		setDueDate("")
		setStatus("unpaid")
		setError("")
		if (fileInputRef.current) fileInputRef.current.value = ""
	}

	const handleClose = () => {
		resetForm()
		onOpenChange(false)
	}

	const readFileAsBase64 = async (file: File): Promise<string> => {
		const arrayBuffer = await file.arrayBuffer()
		const bytes = new Uint8Array(arrayBuffer)
		let binary = ""
		for (let i = 0; i < bytes.length; i++) {
			binary += String.fromCharCode(bytes[i])
		}
		return btoa(binary)
	}

	const handleAnalyze = async () => {
		if (!selectedFile) {
			setError("Please select a file first")
			return
		}

		setError("")
		setAnalyzing(true)

		try {
			const fileBase64 = await readFileAsBase64(selectedFile)
			const result = await analyzeFn({
				data: {
					fileBase64,
					fileName: selectedFile.name,
					contentType: selectedFile.type || "application/octet-stream",
				},
			})

			if (result) {
				if (result.vendor) setVendor(result.vendor)
				if (result.description) setDescription(result.description)
				if (result.amountCents)
					setAmount((result.amountCents / 100).toFixed(2))
				if (result.currency) setCurrency(result.currency)
				if (result.subscriptionTerm)
					setSubscriptionTerm(result.subscriptionTerm)
				if (result.category) setCategory(result.category)
				if (result.invoiceDate) setInvoiceDate(result.invoiceDate)
				if (result.dueDate) setDueDate(result.dueDate)
				if (result.status) setStatus(result.status)
			}
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Analysis failed",
			)
		} finally {
			setAnalyzing(false)
		}
	}

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!selectedFile) {
			setError("Please select a file")
			return
		}
		if (!vendor.trim()) {
			setError("Vendor is required")
			return
		}

		setError("")
		setUploading(true)

		try {
			const fileBase64 = await readFileAsBase64(selectedFile)

			await uploadFn({
				data: {
					fileName: selectedFile.name,
					vendor: vendor.trim(),
					description: description.trim() || undefined,
					amountCents: amount
						? Math.round(Number.parseFloat(amount) * 100)
						: undefined,
					currency,
					subscriptionTerm: (subscriptionTerm || undefined) as
						| (typeof SUBSCRIPTION_TERMS)[number]
						| undefined,
					category: (category || undefined) as
						| (typeof DOCUMENT_CATEGORIES)[number]
						| undefined,
					invoiceDate: invoiceDate || undefined,
					dueDate: dueDate || undefined,
					status: status as (typeof PAYMENT_STATUSES)[number],
					contentType: selectedFile.type || undefined,
					fileSize: selectedFile.size,
					fileBase64,
				},
			})

			resetForm()
			onUploadComplete()
		} catch (err) {
			setError(err instanceof Error ? err.message : "Upload failed")
		} finally {
			setUploading(false)
		}
	}

	if (!open) return null

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center">
			{/* biome-ignore lint/a11y/useKeyWithClickEvents: backdrop click to close */}
			{/* biome-ignore lint/a11y/noStaticElementInteractions: backdrop overlay */}
			<div
				className="fixed inset-0 bg-black/50"
				onClick={handleClose}
			/>
			<div className="relative z-50 w-full max-w-lg rounded-lg border bg-background p-6 shadow-lg max-h-[90vh] overflow-y-auto">
				<div className="flex items-center justify-between mb-4">
					<h2 className="text-lg font-semibold">Upload Document</h2>
					<button
						type="button"
						onClick={handleClose}
						className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent"
					>
						<X className="h-4 w-4" />
					</button>
				</div>

				<form onSubmit={handleSubmit} className="space-y-4">
					{/* File Input */}
					<div className="space-y-2">
						<label htmlFor="file" className="text-sm font-medium">
							File *
						</label>
						<button
							type="button"
							className="flex items-center justify-center w-full h-24 border-2 border-dashed rounded-md cursor-pointer hover:bg-muted/50 transition-colors"
							onClick={() => fileInputRef.current?.click()}
						>
							{selectedFile ? (
								<span className="text-sm">{selectedFile.name}</span>
							) : (
								<div className="flex flex-col items-center gap-1 text-muted-foreground">
									<Upload className="h-5 w-5" />
									<span className="text-sm">
										Click to select a file
									</span>
								</div>
							)}
						</button>
						<input
							ref={fileInputRef}
							id="file"
							type="file"
							className="hidden"
							accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.csv"
							onChange={(e) =>
								setSelectedFile(e.target.files?.[0] || null)
							}
						/>
						{selectedFile && (
							<button
								type="button"
								onClick={handleAnalyze}
								disabled={analyzing}
								className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 text-sm font-medium text-primary hover:bg-primary/10 disabled:opacity-50 transition-colors"
							>
								<Sparkles className="h-4 w-4" />
								{analyzing
									? "Analyzing document..."
									: "Auto-fill with AI"}
							</button>
						)}
					</div>

					{/* Vendor */}
					<div className="space-y-2">
						<label htmlFor="vendor" className="text-sm font-medium">
							Vendor *
						</label>
						<input
							id="vendor"
							type="text"
							value={vendor}
							onChange={(e) => setVendor(e.target.value)}
							placeholder="e.g., Cloudflare, Stripe, AWS"
							className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							required
						/>
					</div>

					{/* Amount + Currency */}
					<div className="grid grid-cols-3 gap-3">
						<div className="col-span-2 space-y-2">
							<label htmlFor="amount" className="text-sm font-medium">
								Amount
							</label>
							<input
								id="amount"
								type="number"
								step="0.01"
								min="0"
								value={amount}
								onChange={(e) => setAmount(e.target.value)}
								placeholder="0.00"
								className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							/>
						</div>
						<div className="space-y-2">
							<label htmlFor="currency" className="text-sm font-medium">
								Currency
							</label>
							<select
								id="currency"
								value={currency}
								onChange={(e) => setCurrency(e.target.value)}
								className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							>
								<option value="USD">USD</option>
								<option value="EUR">EUR</option>
								<option value="GBP">GBP</option>
								<option value="CAD">CAD</option>
								<option value="AUD">AUD</option>
							</select>
						</div>
					</div>

					{/* Category + Term */}
					<div className="grid grid-cols-2 gap-3">
						<div className="space-y-2">
							<label htmlFor="category" className="text-sm font-medium">
								Category
							</label>
							<select
								id="category"
								value={category}
								onChange={(e) => setCategory(e.target.value)}
								className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							>
								<option value="">Select...</option>
								{DOCUMENT_CATEGORIES.map((cat) => (
									<option key={cat} value={cat}>
										{cat.charAt(0).toUpperCase() + cat.slice(1)}
									</option>
								))}
							</select>
						</div>
						<div className="space-y-2">
							<label htmlFor="term" className="text-sm font-medium">
								Subscription Term
							</label>
							<select
								id="term"
								value={subscriptionTerm}
								onChange={(e) => setSubscriptionTerm(e.target.value)}
								className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							>
								<option value="">Select...</option>
								{SUBSCRIPTION_TERMS.map((term) => (
									<option key={term} value={term}>
										{term.charAt(0).toUpperCase() + term.slice(1)}
									</option>
								))}
							</select>
						</div>
					</div>

					{/* Dates */}
					<div className="grid grid-cols-2 gap-3">
						<div className="space-y-2">
							<label
								htmlFor="invoiceDate"
								className="text-sm font-medium"
							>
								Invoice Date
							</label>
							<input
								id="invoiceDate"
								type="date"
								value={invoiceDate}
								onChange={(e) => setInvoiceDate(e.target.value)}
								className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							/>
						</div>
						<div className="space-y-2">
							<label htmlFor="dueDate" className="text-sm font-medium">
								Due Date
							</label>
							<input
								id="dueDate"
								type="date"
								value={dueDate}
								onChange={(e) => setDueDate(e.target.value)}
								className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							/>
						</div>
					</div>

					{/* Status */}
					<div className="space-y-2">
						<label htmlFor="status" className="text-sm font-medium">
							Status
						</label>
						<select
							id="status"
							value={status}
							onChange={(e) => setStatus(e.target.value)}
							className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						>
							{PAYMENT_STATUSES.map((s) => (
								<option key={s} value={s}>
									{s.charAt(0).toUpperCase() + s.slice(1)}
								</option>
							))}
						</select>
					</div>

					{/* Description */}
					<div className="space-y-2">
						<label
							htmlFor="description"
							className="text-sm font-medium"
						>
							Description
						</label>
						<textarea
							id="description"
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							placeholder="Optional notes about this document"
							rows={2}
							className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
						/>
					</div>

					{error && (
						<p className="text-sm text-destructive">{error}</p>
					)}

					<div className="flex justify-end gap-2 pt-2">
						<button
							type="button"
							onClick={handleClose}
							className="inline-flex h-10 items-center rounded-md border px-4 text-sm font-medium hover:bg-accent"
						>
							Cancel
						</button>
						<button
							type="submit"
							disabled={uploading}
							className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
						>
							{uploading ? "Uploading..." : "Upload"}
						</button>
					</div>
				</form>
			</div>
		</div>
	)
}
