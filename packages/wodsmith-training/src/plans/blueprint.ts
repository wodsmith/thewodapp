import { z } from "zod";

export const PLAN_BLUEPRINT_VERSION = "general-functional-fitness@1" as const;
export const PLAN_ROLES = [
	"warmup",
	"strength",
	"skill",
	"conditioning",
	"cooldown",
	"mobility",
	"other",
] as const;
const id = z
	.string()
	.min(1)
	.max(64)
	.regex(/^[a-zA-Z0-9_-]+$/);
const text = z.string().trim().min(1).max(2000);
export const planDateSchema = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/)
	.refine((value) => {
		const date = new Date(`${value}T00:00:00Z`);
		return (
			Number.isFinite(date.getTime()) &&
			date.toISOString().slice(0, 10) === value &&
			value >= "2000-01-01" &&
			value <= "2100-12-31"
		);
	}, "Use a valid calendar date between 2000 and 2100");

const questionSchema = z
	.object({
		id,
		prompt: text,
		field: z.string().min(1).max(255),
		required: z.boolean(),
		choices: z.array(text).max(20).default([]),
		answer: text.optional(),
	})
	.strict();
const constraintSchema = z
	.object({
		id,
		kind: z.enum([
			"availability",
			"duration",
			"equipment",
			"source",
			"substitution",
			"other",
		]),
		description: text,
		trainingDate: planDateSchema.optional(),
		status: z.enum(["unresolved", "satisfied", "waived"]),
		resolution: text.optional(),
	})
	.strict()
	.refine(
		(v) => v.status === "unresolved" || !!v.resolution,
		"Resolved constraints need an explanation",
	);

/** The canonical service supplies its item validator; plans do not redefine scoring. */
export function createTrainingPlanSchema<Item extends { id: string }>(
	itemSchema: z.ZodType<Item>,
) {
	return z
		.object({
			blueprintVersion: z.literal(PLAN_BLUEPRINT_VERSION),
			weekStart: planDateSchema,
			title: z.string().trim().min(1).max(160),
			days: z
				.array(
					z
						.object({
							trainingDate: planDateSchema,
							intent: z.enum(["train", "rest", "leave_open"]),
							accessTeamId: z.string().min(1).max(255),
							items: z
								.array(
									z
										.object({
											item: itemSchema,
											role: z.enum(PLAN_ROLES).optional(),
											estimatedDurationMinutes: z
												.number()
												.int()
												.min(1)
												.max(1440)
												.optional(),
										})
										.strict(),
								)
								.max(40),
						})
						.strict(),
				)
				.max(7),
			questions: z.array(questionSchema).max(50),
			constraints: z.array(constraintSchema).max(50),
			warnings: z.array(text).max(50),
		})
		.strict()
		.superRefine((plan, ctx) => {
			const end =
				new Date(`${plan.weekStart}T00:00:00Z`).getTime() + 7 * 86400000;
			const inWeek = (date: string) =>
				date >= plan.weekStart && new Date(`${date}T00:00:00Z`).getTime() < end;
			for (const [index, day] of plan.days.entries()) {
				if (!inWeek(day.trainingDate))
					ctx.addIssue({
						code: "custom",
						path: ["days", index, "trainingDate"],
						message: "Day must be inside this seven-day plan",
					});
				if ((day.intent === "train") !== day.items.length > 0)
					ctx.addIssue({
						code: "custom",
						path: ["days", index, "items"],
						message: "Training needs items; rest and open days must be empty",
					});
				const ids = day.items.map((v) =>
					String((v.item as { id: string }).id).toLowerCase(),
				);
				if (new Set(ids).size !== ids.length)
					ctx.addIssue({
						code: "custom",
						path: ["days", index, "items"],
						message: "Item IDs must be unique within the day",
					});
			}
			if (
				new Set(plan.days.map((d) => d.trainingDate)).size !== plan.days.length
			)
				ctx.addIssue({
					code: "custom",
					path: ["days"],
					message: "Only one personal session per athlete and date",
				});
			for (const key of ["questions", "constraints"] as const) {
				if (
					new Set(plan[key].map((v) => v.id.toLowerCase())).size !==
					plan[key].length
				)
					ctx.addIssue({
						code: "custom",
						path: [key],
						message: "IDs must be unique",
					});
			}
			for (const [index, constraint] of plan.constraints.entries()) {
				if (constraint.trainingDate && !inWeek(constraint.trainingDate))
					ctx.addIssue({
						code: "custom",
						path: ["constraints", index, "trainingDate"],
						message: "Constraint date must be inside this plan",
					});
			}
		});
}

export type TrainingPlanDocument<Item = unknown> = {
	blueprintVersion: typeof PLAN_BLUEPRINT_VERSION;
	weekStart: string;
	title: string;
	days: {
		trainingDate: string;
		intent: "train" | "rest" | "leave_open";
		accessTeamId: string;
		items: {
			item: Item;
			role?: (typeof PLAN_ROLES)[number];
			estimatedDurationMinutes?: number;
		}[];
	}[];
	questions: z.infer<typeof questionSchema>[];
	constraints: z.infer<typeof constraintSchema>[];
	warnings: string[];
};

export function getSessionBlueprint(version: string = PLAN_BLUEPRINT_VERSION) {
	if (version !== PLAN_BLUEPRINT_VERSION)
		throw new Error(
			"UNSUPPORTED_BLUEPRINT: Request general-functional-fitness@1",
		);
	return {
		version: PLAN_BLUEPRINT_VERSION,
		roles: PLAN_ROLES,
		limits: {
			days: 7,
			itemsPerDay: 40,
			questions: 50,
			constraints: 50,
			documentBytes: 256_000,
		},
		defaults: { questions: [], constraints: [], warnings: [], days: [] },
		intents: {
			train: "Replace the personal composition with these items",
			rest: "Save an explicit empty personal composition",
			leave_open: "Leave the canonical day unchanged",
		},
		itemKinds: {
			source:
				"Use a published sourceSessionId, sourceBlockId and sourcePublishedVersion accessible through the day's accessTeamId",
			personal:
				"Supply a complete canonical block; retain remixedFrom when adapting a source",
			library:
				"Use a workoutId accessible through the day's accessTeamId; the service resolves the definition",
		},
		guidance:
			"Roles are optional organization, never scoring rules. Ask about availability, duration, equipment, sources or substitutions only when the answer changes the plan. Unpublished days stay open unless the athlete chooses personal work. Draft constraints do not save athlete preferences.",
		nextActions: ["create_training_plan", "get_training_plan"],
	};
}
