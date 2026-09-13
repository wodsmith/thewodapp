import type { WodsmithDb } from "@repo/wodsmith-db/mysql";
import {
	trainingPlanDraftsTable as drafts,
	trainingPlanReceiptsTable as receipts,
	type TrainingPlanCommitReceipt,
} from "@repo/wodsmith-db/schemas/training-plans";
import { and, eq } from "drizzle-orm";
import { ulid } from "ulid";
import { z } from "zod";
import type { TrainingPlanDocument } from "./blueprint";

export type PlanningTransaction = Parameters<
	Parameters<WodsmithDb["transaction"]>[0]
>[0];
export type PlanningActor = { userId: string };
const draftId = z
	.string()
	.min(1)
	.max(64)
	.regex(/^[a-zA-Z0-9_-]+$/);
const revision = z.number().int().positive().max(2_147_483_646);
export const planGetInputSchema = z
	.object({ trainingPlanId: draftId })
	.strict();
export const planDeleteInputSchema = planGetInputSchema
	.extend({ expectedRevision: revision })
	.strict();
export const planCommitInputSchema = planDeleteInputSchema
	.extend({
		previewDigest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
		idempotencyKey: z.string().min(1).max(255),
	})
	.strict();

/** Canonical operations are injected once by the shared service composition root. */
export interface PlanningDependencies<
	Actor extends PlanningActor,
	Item,
	Prepared,
> {
	parseDocument(input: unknown): TrainingPlanDocument<Item>;
	authorize(
		db: WodsmithDb | PlanningTransaction,
		actor: Actor,
		permission: "training:read" | "training:write",
		document: TrainingPlanDocument<Item>,
	): Promise<void>;
	prepare(
		db: WodsmithDb,
		actor: Actor,
		days: TrainingPlanDocument<Item>["days"],
	): Promise<{ prepared: Prepared; review: unknown }>;
	/** Lock/revalidate canonical baselines and sources before ANY writes. No nested transactions. */
	validate(
		tx: PlanningTransaction,
		actor: Actor,
		prepared: Prepared,
	): Promise<void>;
	/** Save the bounded batch using the same transaction, retaining performed snapshots. */
	save(
		tx: PlanningTransaction,
		actor: Actor,
		prepared: Prepared,
	): Promise<TrainingPlanCommitReceipt["sessions"]>;
}

function canonicalJson(value: unknown): string {
	if (value instanceof Date) return JSON.stringify(value.toISOString());
	if (value === null || typeof value !== "object") return JSON.stringify(value);
	if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
	return `{${Object.entries(value)
		.filter(([, v]) => v !== undefined)
		.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
		.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`)
		.join(",")}}`;
}

export async function trainingPlanDigest(value: unknown): Promise<string> {
	const bytes = new TextEncoder().encode(canonicalJson(value));
	const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
	return [...new Uint8Array(digest)]
		.map((v) => v.toString(16).padStart(2, "0"))
		.join("");
}

function unresolved(document: TrainingPlanDocument) {
	return [
		...document.questions
			.filter((q) => q.required && !q.answer)
			.map((q) => ({ kind: "question", id: q.id, message: q.prompt })),
		...document.constraints
			.filter((c) => c.status === "unresolved")
			.map((c) => ({ kind: "constraint", id: c.id, message: c.description })),
	];
}

// @lat: [[training-plans#Durable Drafts]]
export function createTrainingPlanService<
	Actor extends PlanningActor,
	Item,
	Prepared,
>(db: WodsmithDb, dependencies: PlanningDependencies<Actor, Item, Prepared>) {
	const parse = (input: unknown) => {
		if (new TextEncoder().encode(JSON.stringify(input)).length > 256_000)
			throw new Error("INVALID_INPUT: Plan exceeds 256000 bytes");
		return dependencies.parseDocument(input);
	};
	const owner = (actor: Actor, id: string) =>
		and(eq(drafts.id, id), eq(drafts.userId, actor.userId));
	const read = async (
		connection: WodsmithDb | PlanningTransaction,
		actor: Actor,
		id: string,
		lock = false,
	) => {
		const query = connection.select().from(drafts).where(owner(actor, id));
		const [row] = await (lock ? query.for("update") : query);
		if (!row) throw new Error("NOT_FOUND: Training plan not found");
		return { ...row, document: parse(row.document) };
	};
	const response = (row: {
		id: string;
		revision: number;
		status: "draft" | "committed";
		document: TrainingPlanDocument<Item>;
	}) => {
		const missingInputs = unresolved(row.document);
		return {
			trainingPlanId: row.id,
			revision: row.revision,
			status: row.status,
			document: row.document,
			missingInputs,
			questions: row.document.questions,
			warnings: row.document.warnings,
			nextActions:
				row.status === "committed"
					? ["get_training_plan"]
					: missingInputs.length
						? ["update_training_plan", "delete_training_plan"]
						: [
								"preview_training_plan",
								"update_training_plan",
								"delete_training_plan",
							],
			summary: `${row.document.title}: ${row.document.days.filter((d) => d.intent !== "leave_open").length} proposed days, ${missingInputs.length} unresolved decisions`,
		};
	};
	const assertEditable = (
		row: { revision: number; status: string },
		expectedRevision: number,
	) => {
		if (row.revision !== expectedRevision)
			throw new Error(
				"REVISION_CONFLICT: Reload the training plan before editing",
			);
		if (row.status !== "draft")
			throw new Error(
				"PLAN_COMMITTED: Create a new draft to plan further changes",
			);
	};
	const prepare = async (
		actor: Actor,
		row: Awaited<ReturnType<typeof read>>,
	) => {
		await dependencies.authorize(db, actor, "training:read", row.document);
		const { prepared, review } = await dependencies.prepare(
			db,
			actor,
			row.document.days
				.filter((d) => d.intent !== "leave_open")
				.sort((a, b) => a.trainingDate.localeCompare(b.trainingDate)),
		);
		const digest = `sha256:${await trainingPlanDigest({ trainingPlanId: row.id, revision: row.revision, document: row.document, review })}`;
		return { prepared, review, digest };
	};

	return {
		async create(actor: Actor, input: unknown) {
			const document = parse(input);
			await dependencies.authorize(db, actor, "training:write", document);
			const row = {
				id: ulid(),
				userId: actor.userId,
				revision: 1,
				status: "draft" as const,
				document,
			};
			await db.insert(drafts).values(row);
			return response(row);
		},
		async get(actor: Actor, input: z.input<typeof planGetInputSchema>) {
			const { trainingPlanId } = planGetInputSchema.parse(input);
			const row = await read(db, actor, trainingPlanId);
			await dependencies.authorize(db, actor, "training:read", row.document);
			return response(row);
		},
		async update(
			actor: Actor,
			input: {
				trainingPlanId: string;
				expectedRevision: number;
				document: unknown;
			},
		) {
			const data = planDeleteInputSchema
				.extend({ document: z.unknown() })
				.parse(input);
			const document = parse(data.document);
			return db.transaction(async (tx) => {
				const row = await read(tx, actor, data.trainingPlanId, true);
				await dependencies.authorize(tx, actor, "training:write", row.document);
				await dependencies.authorize(tx, actor, "training:write", document);
				assertEditable(row, data.expectedRevision);
				await tx
					.update(drafts)
					.set({ document, revision: row.revision + 1 })
					.where(owner(actor, row.id));
				return response({ ...row, document, revision: row.revision + 1 });
			});
		},
		async delete(actor: Actor, input: z.input<typeof planDeleteInputSchema>) {
			const data = planDeleteInputSchema.parse(input);
			return db.transaction(async (tx) => {
				const row = await read(tx, actor, data.trainingPlanId, true);
				await dependencies.authorize(tx, actor, "training:write", row.document);
				assertEditable(row, data.expectedRevision);
				await tx.delete(drafts).where(owner(actor, row.id));
				return { trainingPlanId: row.id, deleted: true as const };
			});
		},
		async preview(actor: Actor, input: z.input<typeof planGetInputSchema>) {
			const { trainingPlanId } = planGetInputSchema.parse(input);
			const row = await read(db, actor, trainingPlanId);
			const { review, digest } = await prepare(actor, row);
			return {
				...response(row),
				previewDigest: digest,
				changes: review,
				canCommit:
					row.status === "draft" &&
					unresolved(row.document).length === 0 &&
					row.document.days.some((d) => d.intent !== "leave_open"),
			};
		},
		async commit(
			actor: Actor,
			input: z.input<typeof planCommitInputSchema>,
		): Promise<TrainingPlanCommitReceipt> {
			const data = planCommitInputSchema.parse(input);
			const row = await read(db, actor, data.trainingPlanId);
			await dependencies.authorize(db, actor, "training:write", row.document);
			const keyHash = await trainingPlanDigest(data.idempotencyKey);
			const payloadHash = await trainingPlanDigest({
				...data,
				idempotencyKey: undefined,
			});
			const receiptWhere = and(
				eq(receipts.userId, actor.userId),
				eq(receipts.operation, "commit_training_plan"),
				eq(receipts.keyHash, keyHash),
			);
			const retry = async (connection: WodsmithDb | PlanningTransaction) => {
				const [stored] = await connection
					.select()
					.from(receipts)
					.where(receiptWhere);
				if (!stored) return null;
				if (stored.payloadHash !== payloadHash)
					throw new Error(
						"IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_INPUT: Use a new key",
					);
				return stored.receipt;
			};
			const existing = await retry(db);
			if (existing) return existing;
			assertEditable(row, data.expectedRevision);
			if (unresolved(row.document).length)
				throw new Error(
					"MISSING_INPUTS: Resolve required questions and constraints",
				);
			if (!row.document.days.some((d) => d.intent !== "leave_open"))
				throw new Error("EMPTY_PLAN: No proposed changes");
			const prepared = await prepare(actor, row);
			if (prepared.digest !== data.previewDigest)
				throw new Error("PREVIEW_STALE: Preview the plan again");
			return db.transaction(async (tx) => {
				const locked = await read(tx, actor, data.trainingPlanId, true);
				await dependencies.authorize(
					tx,
					actor,
					"training:write",
					locked.document,
				);
				const concurrent = await retry(tx);
				if (concurrent) return concurrent;
				assertEditable(locked, data.expectedRevision);
				await dependencies.validate(tx, actor, prepared.prepared);
				const sessions = await dependencies.save(tx, actor, prepared.prepared);
				const receipt = {
					trainingPlanId: row.id,
					revision: row.revision,
					previewDigest: data.previewDigest,
					sessions,
				};
				await tx
					.insert(receipts)
					.values({
						id: ulid(),
						userId: actor.userId,
						operation: "commit_training_plan",
						keyHash,
						payloadHash,
						receipt,
					});
				await tx
					.update(drafts)
					.set({ status: "committed" })
					.where(owner(actor, row.id));
				return receipt;
			});
		},
	};
}
