import type { Connection } from "mysql2/promise"
import { batchInsert, now } from "../helpers"

export async function seed(client: Connection): Promise<void> {
	console.log("Seeding global defaults...")

	const ts = now()

	await batchInsert(client, "scaling_groups", [
		{
			id: "sgrp_global_default",
			title: "Standard Scaling",
			description:
				"Default Rx+, Rx, and Scaled levels for backward compatibility",
			team_id: null,
			is_default: 1,
			is_system: 1,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
	])

	await batchInsert(client, "scaling_levels", [
		{
			id: "slvl_global_rxplus",
			scaling_group_id: "sgrp_global_default",
			label: "Rx+",
			position: 0,
			team_size: 1,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: "slvl_global_rx",
			scaling_group_id: "sgrp_global_default",
			label: "Rx",
			position: 1,
			team_size: 1,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
		{
			id: "slvl_global_scaled",
			scaling_group_id: "sgrp_global_default",
			label: "Scaled",
			position: 2,
			team_size: 1,
			created_at: ts,
			updated_at: ts,
			update_counter: 0,
		},
	])
}
