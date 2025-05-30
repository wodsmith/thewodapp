"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import * as React from "react";

import { Button } from "@/components/ui/button"; // Assuming a Button component exists

export function DarkModeToggle() {
	const { setTheme, theme } = useTheme();

	const isDarkMode = theme === "dark";

	const toggleTheme = () => {
		if (process.env.LOG_LEVEL === "debug") {
			console.log(`Theme changed to ${isDarkMode ? "light" : "dark"}`);
		}
		setTheme(isDarkMode ? "light" : "dark");
	};

	return (
		<Button variant="outline" size="icon" onClick={toggleTheme}>
			{isDarkMode ? (
				<Sun className="h-[1.2rem] w-[1.2rem]" />
			) : (
				<Moon className="h-[1.2rem] w-[1.2rem]" />
			)}
			<span className="sr-only">Toggle theme</span>
		</Button>
	);
}
