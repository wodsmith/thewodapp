"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FeaturesManagement } from "./features-management"
import { LimitsManagement } from "./limits-management"
import { PlansConfiguration } from "./plans-configuration"

export function ConfigManagementClient() {
	const [activeTab, setActiveTab] = useState("features")

	return (
		<Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
			<TabsList className="grid w-full grid-cols-3">
				<TabsTrigger value="features">Features</TabsTrigger>
				<TabsTrigger value="limits">Limits</TabsTrigger>
				<TabsTrigger value="plans">Plans</TabsTrigger>
			</TabsList>

			<TabsContent value="features" className="space-y-4">
				<FeaturesManagement />
			</TabsContent>

			<TabsContent value="limits" className="space-y-4">
				<LimitsManagement />
			</TabsContent>

			<TabsContent value="plans" className="space-y-4">
				<PlansConfiguration />
			</TabsContent>
		</Tabs>
	)
}
