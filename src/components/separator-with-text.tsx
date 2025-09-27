type SeparatorWithTextProps = {
	leftBorderProps?: React.HTMLAttributes<HTMLDivElement>
	rightBorderProps?: React.HTMLAttributes<HTMLDivElement>
} & React.HTMLAttributes<HTMLDivElement>

export default function SeparatorWithText({
	children,
	leftBorderProps,
	rightBorderProps,
	...props
}: SeparatorWithTextProps) {
	return (
		<div className="relative flex items-center" {...props}>
			<div
				className="flex-grow border-t-4 border-black dark:border-primary"
				{...leftBorderProps}
			/>
			<span className="flex-shrink mx-4">{children}</span>
			<div
				className="flex-grow border-t-4 border-black dark:border-primary"
				{...rightBorderProps}
			/>
		</div>
	)
}
