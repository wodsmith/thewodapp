/**
 * Seed script for entitlement system (types, features, limits, and plans)
 * Run with: pnpm tsx scripts/seed-entitlements.ts
 */

import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import {
  entitlementTypeTable,
  featureTable,
  limitTable,
  planTable,
  planFeatureTable,
  planLimitTable,
} from "../src/db/schema";
import {
  FEATURE_SEED_DATA,
  LIMIT_SEED_DATA,
  PLAN_SEED_DATA,
} from "../src/config/seed-data";

// Entitlement type constants (matching what's in the schema)
const ENTITLEMENT_TYPES = {
  PROGRAMMING_TRACK_ACCESS: "programming_track_access",
  AI_MESSAGE_CREDITS: "ai_message_credits",
  FEATURE_TRIAL: "feature_trial",
  MANUAL_FEATURE_GRANT: "manual_feature_grant",
  SUBSCRIPTION_SEAT: "subscription_seat",
  ADDON_ACCESS: "addon_access",
} as const;

// Helper to get D1 database (you'll need to adjust this based on your setup)
async function getD1Database() {
  // For local development
  if (process.env.NODE_ENV !== "production") {
    // This assumes you're using wrangler dev or similar
    // You might need to adjust this based on your setup
    const { unstable_dev } = await import("wrangler");
    const worker = await unstable_dev("src/index.ts", {
      experimental: { disableExperimentalWarning: true },
    });
    // @ts-expect-error - accessing internal API
    return worker.db;
  }

  throw new Error(
    "Production seeding not implemented yet. Use wrangler d1 execute instead."
  );
}

async function seedEntitlementTypes(db: ReturnType<typeof drizzle>) {
  console.log("Seeding entitlement types...");

  const entitlementTypesToSeed = [
    {
      name: ENTITLEMENT_TYPES.PROGRAMMING_TRACK_ACCESS,
      description: "Access to individual programming tracks via purchase",
    },
    {
      name: ENTITLEMENT_TYPES.AI_MESSAGE_CREDITS,
      description: "AI message credits for workout generation and suggestions",
    },
    {
      name: ENTITLEMENT_TYPES.FEATURE_TRIAL,
      description: "Time-limited trial access to premium features",
    },
    {
      name: ENTITLEMENT_TYPES.MANUAL_FEATURE_GRANT,
      description: "Manual feature grants by administrators",
    },
    {
      name: ENTITLEMENT_TYPES.SUBSCRIPTION_SEAT,
      description: "Subscription seat tracking for team plans",
    },
    {
      name: ENTITLEMENT_TYPES.ADDON_ACCESS,
      description: "Access via purchased add-ons",
    },
  ];

  for (const type of entitlementTypesToSeed) {
    try {
      await db.insert(entitlementTypeTable).values(type);
      console.log(`✓ Created entitlement type: ${type.name}`);
    } catch (error) {
      console.log(
        `✗ Entitlement type ${type.name} already exists or error:`,
        error
      );
    }
  }
}

async function seedFeatures(db: ReturnType<typeof drizzle>) {
  console.log("\nSeeding features...");

  for (const feature of FEATURE_SEED_DATA) {
    try {
      await db.insert(featureTable).values({
        key: feature.key,
        name: feature.name,
        description: feature.description,
        category: feature.category,
        isActive: 1,
      });
      console.log(`✓ Created feature: ${feature.name} (${feature.key})`);
    } catch (error) {
      console.log(`✗ Feature ${feature.name} already exists or error:`, error);
    }
  }
}

async function seedLimits(db: ReturnType<typeof drizzle>) {
  console.log("\nSeeding limits...");

  for (const limit of LIMIT_SEED_DATA) {
    try {
      await db.insert(limitTable).values({
        key: limit.key,
        name: limit.name,
        description: limit.description,
        unit: limit.unit,
        resetPeriod: limit.resetPeriod,
        isActive: 1,
      });
      console.log(`✓ Created limit: ${limit.name} (${limit.key})`);
    } catch (error) {
      console.log(`✗ Limit ${limit.name} already exists or error:`, error);
    }
  }
}

async function seedPlans(db: ReturnType<typeof drizzle>) {
  console.log("\nSeeding plans...");

  for (const plan of PLAN_SEED_DATA) {
    try {
      await db.insert(planTable).values({
        id: plan.id,
        name: plan.name,
        description: plan.description,
        price: plan.price,
        interval: plan.interval,
        isActive: plan.isActive ? 1 : 0,
        isPublic: plan.isPublic ? 1 : 0,
        sortOrder: plan.sortOrder,
        stripePriceId: plan.stripePriceId,
        stripeProductId: plan.stripeProductId,
        // Don't set entitlements JSON - we use junction tables instead
        entitlements: undefined,
      });
      console.log(`✓ Created plan: ${plan.name} (${plan.id})`);
    } catch (error) {
      console.log(`✗ Plan ${plan.name} already exists or error:`, error);
    }
  }
}

async function seedPlanFeatures(db: ReturnType<typeof drizzle>) {
  console.log("\nSeeding plan features...");

  // Get all features from DB to map keys to IDs
  const allFeatures = await db.select().from(featureTable);
  const featureKeyToId = new Map(allFeatures.map((f) => [f.key, f.id]));

  for (const plan of PLAN_SEED_DATA) {
    console.log(`\nProcessing features for plan: ${plan.name}`);

    for (const featureKey of plan.features) {
      const featureId = featureKeyToId.get(featureKey);

      if (!featureId) {
        console.log(`✗ Feature key not found: ${featureKey}`);
        continue;
      }

      try {
        await db.insert(planFeatureTable).values({
          planId: plan.id,
          featureId: featureId,
        });
        console.log(`  ✓ Added feature: ${featureKey}`);
      } catch (error) {
        console.log(`  ✗ Feature ${featureKey} already linked or error:`, error);
      }
    }
  }
}

async function seedPlanLimits(db: ReturnType<typeof drizzle>) {
  console.log("\nSeeding plan limits...");

  // Get all limits from DB to map keys to IDs
  const allLimits = await db.select().from(limitTable);
  const limitKeyToId = new Map(allLimits.map((l) => [l.key, l.id]));

  for (const plan of PLAN_SEED_DATA) {
    console.log(`\nProcessing limits for plan: ${plan.name}`);

    for (const [limitKey, value] of Object.entries(plan.limits)) {
      const limitId = limitKeyToId.get(limitKey);

      if (!limitId) {
        console.log(`✗ Limit key not found: ${limitKey}`);
        continue;
      }

      try {
        await db.insert(planLimitTable).values({
          planId: plan.id,
          limitId: limitId,
          value: value,
        });
        console.log(`  ✓ Added limit: ${limitKey} = ${value}`);
      } catch (error) {
        console.log(`  ✗ Limit ${limitKey} already linked or error:`, error);
      }
    }
  }
}

async function main() {
  console.log("Starting entitlements seed script...\n");

  try {
    const db = await getD1Database();

    // Seed in order: entitlement types, features, limits, plans, then junction tables
    await seedEntitlementTypes(db);
    await seedFeatures(db);
    await seedLimits(db);
    await seedPlans(db);
    await seedPlanFeatures(db);
    await seedPlanLimits(db);

    console.log("\n✓ Seeding completed successfully!");
  } catch (error) {
    console.error("\n✗ Seeding failed:", error);
    process.exit(1);
  }
}

// Run the script
main();
