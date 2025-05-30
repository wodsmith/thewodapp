"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input"; // Assuming Input component is available
import {
	Table,
	TableBody,
	TableCaption,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { useState } from "react";

export default function SpreadsheetCalculator() {
	const [oneRepMax, setOneRepMax] = useState<number | string>("");
	const [percentages, setPercentages] = useState<{ percentage: number; weight: number }[]>([]);

	const calculatePercentages = () => {
		const max = Number.parseFloat(oneRepMax as string);
		if (Number.isNaN(max) || max <= 0) {
			setPercentages([]);
			return;
		}

		const newPercentages = [];
		for (let i = 5; i <= 100; i += 5) {
			newPercentages.push({
				percentage: i,
				weight: Number.parseFloat(((max * i) / 100).toFixed(2)),
			});
		}
		setPercentages(newPercentages.reverse()); // Show 100% at the top
	};

	return (
		<div className="container mx-auto max-w-screen-md p-4">
			<h1 className="mb-4 font-bold text-2xl">1RM Percentage Calculator</h1>
			<div className="mb-4 flex gap-2">
				<Input
					type="number"
					value={oneRepMax}
					onChange={(e) => setOneRepMax(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter") {
							calculatePercentages();
						}
					}}
					placeholder="Enter 1 Rep Max (kg/lb)"
					className="max-w-xs"
				/>
				<Button onClick={calculatePercentages}>Calculate</Button>
			</div>

			{percentages.length === 0 && (
				<div className="flex h-full flex-col items-center justify-center border-2 border-black p-4 dark:border-white">
					<p className="text-gray-500 text-sm">
						Enter your 1RM to see the percentage breakdown.
					</p>
				</div>
			)}

			{percentages.length > 0 && (
				<Table>
					<TableCaption>Percentage breakdown of your 1RM.</TableCaption>
					<TableHeader>
						<TableRow>
							<TableHead className="w-[100px]">Percentage</TableHead>
							<TableHead className="text-right">Weight</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{percentages.map((p) => (
							<TableRow key={p.percentage}>
								<TableCell className="font-medium">{p.percentage}%</TableCell>
								<TableCell className="text-right">{p.weight}</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			)}
		</div>
	);
}
