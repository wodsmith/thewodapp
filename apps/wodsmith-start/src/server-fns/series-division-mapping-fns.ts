/**
 * Series Division Mapping Server Functions
 *
 * CRUD for mapping competition divisions → series template divisions,
 * plus auto-mapping algorithm using fuzzy label matching.
 */

import { createServerFn } from "@tanstack/react-start"
import { and, eq, inArray } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import { competitionDivisionsTable } from "@/db/schemas/commerce"
import { createScalingGroupId, createScalingLevelId } from "@/db/schemas/common"
import {
  competitionGroupsTable,
  competitionsTable,
} from "@/db/schemas/competitions"
import { scalingGroupsTable, scalingLevelsTable } from "@/db/schemas/scaling"
import {
  seriesDivisionMappingsTable,
  seriesTemplateDivisionsTable,
} from "@/db/schemas/series"
import { TEAM_PERMISSIONS } from "@/db/schemas/teams"
import {
  parseSeriesSettings,
  stringifySeriesSettings,
} from "@/types/competitions"
import { getSessionFromCookie } from "@/utils/auth"
import { requireTeamPermission } from "@/utils/team-auth"
import { parseCompetitionSettings } from "./competition-divisions-fns"

// ============================================================================
// Types
// ============================================================================

export interface SeriesDivisionMappingData {
  competitionId: string
  competitionName: string
  mappings: Array<{
    competitionDivisionId: string
    competitionDivisionLabel: string
    seriesDivisionId: string | null
    confidence: "exact" | "fuzzy" | "none"
  }>
}

export interface SeriesTemplateDivisionData {
  id: string
  label: string
  position: number
  teamSize: number
  feeCents: number
  description: string | null
  maxSpots: number | null
}

export interface SeriesTemplateData {
  scalingGroupId: string
  scalingGroupTitle: string
  divisions: SeriesTemplateDivisionData[]
}

// ============================================================================
// Auto-mapping algorithm
// ============================================================================

/**
 * Aggressively normalize a division label for comparison.
 * Handles the real-world variations seen across MWFC competitions:
 * - "Men's Individual RX" vs "Men's Masters 35+ Individual RX (Indy)"
 * - "M35+ Men's Teams RX" vs "Masters 35+ Men's Teams RX"
 *
 * Strategy: strip noise, normalize abbreviations, sort tokens for
 * order-independent comparison. A strict match on this normalized
 * form catches ~95% of real cases without Jaccard/NLP overhead.
 */
function normalizeLabel(label: string): string {
  let n = label.toLowerCase().trim()
  // Remove all parenthesized suffixes: (Indy), (Individual), (Team), etc.
  n = n.replace(/\s*\([^)]*\)\s*/g, " ")
  // Normalize possessives: women's → women, men's → men
  n = n.replace(/\bwomen['']s\b/g, "women")
  n = n.replace(/\bmen['']s\b/g, "men")
  // Normalize masters variants: "Masters 35+", "Master 35+", "M35+" → "m35+"
  n = n.replace(/\bmasters?\s*(\d+)\+?/g, "m$1+")
  // Already-abbreviated form: "M35+" → "m35+"
  n = n.replace(/\bm(\d+)\+?/g, "m$1+")
  // Normalize "individual" → "indiv"
  n = n.replace(/\bindividual\b/g, "indiv")
  // Strip common filler words
  n = n.replace(/\b(the|and|&|of)\b/g, "")
  // Collapse whitespace, trim
  n = n.replace(/\s+/g, " ").trim()
  return n
}

/**
 * Create a sort-stable key from a label for order-independent matching.
 * "men indiv rx" and "indiv men rx" both produce "indiv men rx".
 */
function sortedKey(label: string): string {
  return normalizeLabel(label).split(" ").sort().join(" ")
}

/**
 * Auto-map competition divisions to series template divisions.
 * Uses a two-pass approach:
 *   1. Exact case-insensitive match
 *   2. Normalized + token-sorted match (catches word-order and abbreviation diffs)
 * No Jaccard / NLP — simple, fast, and right for 95%+ of real data.
 */
function autoMapDivisions(
  compDivisions: Array<{ id: string; label: string }>,
  seriesDivisions: Array<{ id: string; label: string }>,
): Array<{
  competitionDivisionId: string
  competitionDivisionLabel: string
  seriesDivisionId: string | null
  confidence: "exact" | "fuzzy" | "none"
}> {
  // Pre-compute normalized + sorted keys for series divisions
  const seriesKeys = seriesDivisions.map((sd) => ({
    ...sd,
    normalized: normalizeLabel(sd.label),
    sorted: sortedKey(sd.label),
  }))

  return compDivisions.map((compDiv) => {
    const compLower = compDiv.label.toLowerCase().trim()

    // 1. Exact match (case-insensitive)
    const exactMatch = seriesDivisions.find(
      (sd) => sd.label.toLowerCase().trim() === compLower,
    )
    if (exactMatch) {
      return {
        competitionDivisionId: compDiv.id,
        competitionDivisionLabel: compDiv.label,
        seriesDivisionId: exactMatch.id,
        confidence: "exact" as const,
      }
    }

    // 2. Normalized match (handles abbreviation/suffix differences)
    const compNormalized = normalizeLabel(compDiv.label)
    const normalizedMatch = seriesKeys.find(
      (sd) => sd.normalized === compNormalized,
    )
    if (normalizedMatch) {
      return {
        competitionDivisionId: compDiv.id,
        competitionDivisionLabel: compDiv.label,
        seriesDivisionId: normalizedMatch.id,
        confidence: "fuzzy" as const,
      }
    }

    // 3. Sorted-token match (handles word-order differences)
    const compSorted = sortedKey(compDiv.label)
    const sortedMatch = seriesKeys.find((sd) => sd.sorted === compSorted)
    if (sortedMatch) {
      return {
        competitionDivisionId: compDiv.id,
        competitionDivisionLabel: compDiv.label,
        seriesDivisionId: sortedMatch.id,
        confidence: "fuzzy" as const,
      }
    }

    // 4. No match
    return {
      competitionDivisionId: compDiv.id,
      competitionDivisionLabel: compDiv.label,
      seriesDivisionId: null,
      confidence: "none" as const,
    }
  })
}

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Get the series division template and all competition mappings.
 * This is the main data loader for the mapping configuration page.
 */
export const getSeriesDivisionMappingsFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({
        groupId: z.string().min(1),
      })
      .parse(data),
  )
  .handler(
    async ({
      data,
    }): Promise<{
      template: SeriesTemplateData | null
      competitionMappings: SeriesDivisionMappingData[]
      availableScalingGroups: Array<{
        id: string
        title: string
        levels: Array<{ id: string; label: string; teamSize: number }>
      }>
    }> => {
      const db = getDb()
      const session = await getSessionFromCookie()
      if (!session?.userId) throw new Error("Not authenticated")

      // Load group
      const [group] = await db
        .select()
        .from(competitionGroupsTable)
        .where(eq(competitionGroupsTable.id, data.groupId))
      if (!group) throw new Error("Series group not found")

      await requireTeamPermission(
        group.organizingTeamId,
        TEAM_PERMISSIONS.ACCESS_DASHBOARD,
      )

      const seriesSettings = parseSeriesSettings(group.settings)
      const templateGroupId = seriesSettings?.scalingGroupId

      // Load template if it exists
      let template: SeriesTemplateData | null = null
      if (templateGroupId) {
        const [scalingGroup] = await db
          .select()
          .from(scalingGroupsTable)
          .where(eq(scalingGroupsTable.id, templateGroupId))

        if (scalingGroup) {
          const [levels, templateDivConfigs] = await Promise.all([
            db
              .select()
              .from(scalingLevelsTable)
              .where(eq(scalingLevelsTable.scalingGroupId, templateGroupId))
              .orderBy(scalingLevelsTable.position),
            db
              .select()
              .from(seriesTemplateDivisionsTable)
              .where(eq(seriesTemplateDivisionsTable.groupId, data.groupId)),
          ])

          const configMap = new Map(
            templateDivConfigs.map((c) => [c.divisionId, c]),
          )

          template = {
            scalingGroupId: scalingGroup.id,
            scalingGroupTitle: scalingGroup.title,
            divisions: levels.map((l) => {
              const config = configMap.get(l.id)
              return {
                id: l.id,
                label: l.label,
                position: l.position,
                teamSize: l.teamSize,
                feeCents: config?.feeCents ?? 0,
                description: config?.description ?? null,
                maxSpots: config?.maxSpots ?? null,
              }
            }),
          }
        }
      }

      // Load all competitions in this series
      const comps = await db
        .select({
          id: competitionsTable.id,
          name: competitionsTable.name,
          settings: competitionsTable.settings,
        })
        .from(competitionsTable)
        .where(eq(competitionsTable.groupId, data.groupId))

      // Load existing mappings
      const existingMappings =
        comps.length > 0
          ? await db
              .select()
              .from(seriesDivisionMappingsTable)
              .where(eq(seriesDivisionMappingsTable.groupId, data.groupId))
          : []

      // Build mapping data per competition
      const competitionMappings: SeriesDivisionMappingData[] = []

      for (const comp of comps) {
        const compSettings = parseCompetitionSettings(comp.settings)
        const compScalingGroupId = compSettings?.divisions?.scalingGroupId
        if (!compScalingGroupId) {
          // Competition has no divisions configured
          competitionMappings.push({
            competitionId: comp.id,
            competitionName: comp.name,
            mappings: [],
          })
          continue
        }

        // Load competition's divisions
        const compDivisions = await db
          .select({
            id: scalingLevelsTable.id,
            label: scalingLevelsTable.label,
          })
          .from(scalingLevelsTable)
          .where(eq(scalingLevelsTable.scalingGroupId, compScalingGroupId))
          .orderBy(scalingLevelsTable.position)

        // Check for existing mappings for this competition
        const compExistingMappings = existingMappings.filter(
          (m) => m.competitionId === comp.id,
        )

        if (compExistingMappings.length > 0) {
          // Use existing saved mappings
          const mappings = compDivisions.map((div) => {
            const existing = compExistingMappings.find(
              (m) => m.competitionDivisionId === div.id,
            )
            return {
              competitionDivisionId: div.id,
              competitionDivisionLabel: div.label,
              seriesDivisionId: existing?.seriesDivisionId ?? null,
              confidence: existing ? ("exact" as const) : ("none" as const),
            }
          })
          competitionMappings.push({
            competitionId: comp.id,
            competitionName: comp.name,
            mappings,
          })
        } else if (template) {
          // Auto-map using fuzzy matching
          const autoMapped = autoMapDivisions(compDivisions, template.divisions)
          competitionMappings.push({
            competitionId: comp.id,
            competitionName: comp.name,
            mappings: autoMapped,
          })
        } else {
          // No template, no mappings
          competitionMappings.push({
            competitionId: comp.id,
            competitionName: comp.name,
            mappings: compDivisions.map((div) => ({
              competitionDivisionId: div.id,
              competitionDivisionLabel: div.label,
              seriesDivisionId: null,
              confidence: "none" as const,
            })),
          })
        }
      }

      // Load available scaling groups for template selection
      // Include all team scaling groups + the ones used by competitions
      const allScalingGroupIds = new Set<string>()
      for (const comp of comps) {
        const compSettings = parseCompetitionSettings(comp.settings)
        const sgId = compSettings?.divisions?.scalingGroupId
        if (sgId) allScalingGroupIds.add(sgId)
      }

      const teamScalingGroups = await db
        .select()
        .from(scalingGroupsTable)
        .where(eq(scalingGroupsTable.teamId, group.organizingTeamId))

      for (const sg of teamScalingGroups) {
        allScalingGroupIds.add(sg.id)
      }

      // Load levels for all groups
      const allGroupIds = Array.from(allScalingGroupIds)
      const allLevels =
        allGroupIds.length > 0
          ? await db
              .select()
              .from(scalingLevelsTable)
              .where(inArray(scalingLevelsTable.scalingGroupId, allGroupIds))
              .orderBy(scalingLevelsTable.position)
          : []

      // Build all scaling groups (team groups + groups referenced by comps)
      const allGroups = new Map<string, { id: string; title: string }>()
      for (const sg of teamScalingGroups) {
        allGroups.set(sg.id, { id: sg.id, title: sg.title })
      }
      // Add any groups from comps not already present
      for (const sgId of allScalingGroupIds) {
        if (!allGroups.has(sgId)) {
          const [sg] = await db
            .select()
            .from(scalingGroupsTable)
            .where(eq(scalingGroupsTable.id, sgId))
          if (sg) allGroups.set(sg.id, { id: sg.id, title: sg.title })
        }
      }

      const availableScalingGroups = Array.from(allGroups.values()).map(
        (sg) => ({
          ...sg,
          levels: allLevels
            .filter((l) => l.scalingGroupId === sg.id)
            .map((l) => ({
              id: l.id,
              label: l.label,
              teamSize: l.teamSize,
            })),
        }),
      )

      return {
        template,
        competitionMappings,
        availableScalingGroups,
      }
    },
  )

/**
 * Create or update the series template from an existing scaling group.
 * Clones the scaling group levels as the series template, and copies any
 * competition_divisions metadata (description, feeCents, maxSpots) into
 * series_template_divisions.
 */
export const setSeriesTemplateFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        groupId: z.string().min(1),
        sourceScalingGroupId: z.string().min(1),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const db = getDb()
    const session = await getSessionFromCookie()
    if (!session?.userId) throw new Error("Not authenticated")

    const [group] = await db
      .select()
      .from(competitionGroupsTable)
      .where(eq(competitionGroupsTable.id, data.groupId))
    if (!group) throw new Error("Series group not found")

    await requireTeamPermission(
      group.organizingTeamId,
      TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
    )

    // Load source scaling group, levels, and any competition_divisions metadata
    const [sourceGroup] = await db
      .select()
      .from(scalingGroupsTable)
      .where(eq(scalingGroupsTable.id, data.sourceScalingGroupId))
    if (!sourceGroup) throw new Error("Source scaling group not found")

    const sourceLevels = await db
      .select()
      .from(scalingLevelsTable)
      .where(eq(scalingLevelsTable.scalingGroupId, data.sourceScalingGroupId))
      .orderBy(scalingLevelsTable.position)

    // Try to find competition_divisions metadata for the source levels
    const sourceLevelIds = sourceLevels.map((l) => l.id)
    const sourceDivConfigs =
      sourceLevelIds.length > 0
        ? await db
            .select()
            .from(competitionDivisionsTable)
            .where(
              inArray(competitionDivisionsTable.divisionId, sourceLevelIds),
            )
        : []
    // Use first config found per division (multiple comps may have configs)
    const sourceConfigMap = new Map<
      string,
      { feeCents: number; description: string | null; maxSpots: number | null }
    >()
    for (const c of sourceDivConfigs) {
      if (!sourceConfigMap.has(c.divisionId)) {
        sourceConfigMap.set(c.divisionId, {
          feeCents: c.feeCents,
          description: c.description,
          maxSpots: c.maxSpots,
        })
      }
    }

    const seriesSettings = parseSeriesSettings(group.settings)
    const existingTemplateId = seriesSettings?.scalingGroupId

    // Helper to clone levels + metadata into a template group
    const cloneLevels = async (tx: typeof db, templateGroupId: string) => {
      for (const level of sourceLevels) {
        const newLevelId = createScalingLevelId()
        await tx.insert(scalingLevelsTable).values({
          id: newLevelId,
          scalingGroupId: templateGroupId,
          label: level.label,
          position: level.position,
          teamSize: level.teamSize,
        })

        // Copy metadata if available
        const config = sourceConfigMap.get(level.id)
        if (config) {
          await tx.insert(seriesTemplateDivisionsTable).values({
            groupId: data.groupId,
            divisionId: newLevelId,
            feeCents: config.feeCents,
            description: config.description,
            maxSpots: config.maxSpots,
          })
        }
      }
    }

    if (existingTemplateId) {
      await db.transaction(async (tx) => {
        // Clear old data
        await tx
          .delete(seriesTemplateDivisionsTable)
          .where(eq(seriesTemplateDivisionsTable.groupId, data.groupId))
        await tx
          .delete(scalingLevelsTable)
          .where(eq(scalingLevelsTable.scalingGroupId, existingTemplateId))
        await tx
          .delete(seriesDivisionMappingsTable)
          .where(eq(seriesDivisionMappingsTable.groupId, data.groupId))

        await tx
          .update(scalingGroupsTable)
          .set({
            title: `${group.name} Series Divisions`,
            updatedAt: new Date(),
          })
          .where(eq(scalingGroupsTable.id, existingTemplateId))

        await cloneLevels(tx, existingTemplateId)
      })
      return { scalingGroupId: existingTemplateId }
    }

    // Create new template scaling group
    const newGroupId = createScalingGroupId()
    await db.transaction(async (tx) => {
      await tx.insert(scalingGroupsTable).values({
        id: newGroupId,
        title: `${group.name} Series Divisions`,
        teamId: group.organizingTeamId,
        isDefault: false,
        isSystem: false,
      })

      await cloneLevels(tx, newGroupId)

      // Save to series settings
      const newSettings = stringifySeriesSettings({
        ...seriesSettings,
        scalingGroupId: newGroupId,
      })
      await tx
        .update(competitionGroupsTable)
        .set({ settings: newSettings, updatedAt: new Date() })
        .where(eq(competitionGroupsTable.id, data.groupId))
    })

    return { scalingGroupId: newGroupId }
  })

/**
 * Create a series template from scratch with custom divisions.
 * Stores structural data (label, teamSize, position) on scaling_levels,
 * and metadata (description, feeCents, maxSpots) on series_template_divisions.
 */
export const createSeriesTemplateFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        groupId: z.string().min(1),
        divisions: z
          .array(
            z.object({
              label: z.string().min(1),
              teamSize: z.number().int().min(1).default(1),
              feeCents: z.number().int().min(0).default(0),
              description: z.string().nullable().optional(),
              maxSpots: z.number().int().min(1).nullable().optional(),
            }),
          )
          .min(1),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const db = getDb()
    const session = await getSessionFromCookie()
    if (!session?.userId) throw new Error("Not authenticated")

    const [group] = await db
      .select()
      .from(competitionGroupsTable)
      .where(eq(competitionGroupsTable.id, data.groupId))
    if (!group) throw new Error("Series group not found")

    await requireTeamPermission(
      group.organizingTeamId,
      TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
    )

    const seriesSettings = parseSeriesSettings(group.settings)
    const existingTemplateId = seriesSettings?.scalingGroupId

    let templateGroupId: string

    await db.transaction(async (tx) => {
      if (existingTemplateId) {
        templateGroupId = existingTemplateId

        // Clear old levels, template configs, and mappings
        await tx
          .delete(seriesTemplateDivisionsTable)
          .where(eq(seriesTemplateDivisionsTable.groupId, data.groupId))
        await tx
          .delete(scalingLevelsTable)
          .where(eq(scalingLevelsTable.scalingGroupId, existingTemplateId))
        await tx
          .delete(seriesDivisionMappingsTable)
          .where(eq(seriesDivisionMappingsTable.groupId, data.groupId))

        await tx
          .update(scalingGroupsTable)
          .set({
            title: `${group.name} Series Divisions`,
            updatedAt: new Date(),
          })
          .where(eq(scalingGroupsTable.id, existingTemplateId))
      } else {
        templateGroupId = createScalingGroupId()
        await tx.insert(scalingGroupsTable).values({
          id: templateGroupId,
          title: `${group.name} Series Divisions`,
          teamId: group.organizingTeamId,
          isDefault: false,
          isSystem: false,
        })

        const newSettings = stringifySeriesSettings({
          ...seriesSettings,
          scalingGroupId: templateGroupId,
        })
        await tx
          .update(competitionGroupsTable)
          .set({ settings: newSettings, updatedAt: new Date() })
          .where(eq(competitionGroupsTable.id, data.groupId))
      }

      // Create scaling levels + template division configs
      for (let i = 0; i < data.divisions.length; i++) {
        const div = data.divisions[i]
        const levelId = createScalingLevelId()

        await tx.insert(scalingLevelsTable).values({
          id: levelId,
          scalingGroupId: templateGroupId,
          label: div.label,
          position: i,
          teamSize: div.teamSize,
        })

        // Store metadata on series_template_divisions
        if (div.feeCents || div.description || div.maxSpots) {
          await tx.insert(seriesTemplateDivisionsTable).values({
            groupId: data.groupId,
            divisionId: levelId,
            feeCents: div.feeCents ?? 0,
            description: div.description ?? null,
            maxSpots: div.maxSpots ?? null,
          })
        }
      }
    })

    return { scalingGroupId: templateGroupId! }
  })

/**
 * Save all division mappings for a series.
 * Replaces all existing mappings with the provided ones.
 */
export const saveSeriesDivisionMappingsFn = createServerFn({
  method: "POST",
})
  .inputValidator((data: unknown) =>
    z
      .object({
        groupId: z.string().min(1),
        mappings: z.array(
          z.object({
            competitionId: z.string().min(1),
            competitionDivisionId: z.string().min(1),
            seriesDivisionId: z.string().min(1),
          }),
        ),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const db = getDb()
    const session = await getSessionFromCookie()
    if (!session?.userId) throw new Error("Not authenticated")

    const [group] = await db
      .select()
      .from(competitionGroupsTable)
      .where(eq(competitionGroupsTable.id, data.groupId))
    if (!group) throw new Error("Series group not found")

    await requireTeamPermission(
      group.organizingTeamId,
      TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
    )

    // Delete all existing mappings and insert new ones atomically
    await db.transaction(async (tx) => {
      await tx
        .delete(seriesDivisionMappingsTable)
        .where(eq(seriesDivisionMappingsTable.groupId, data.groupId))

      if (data.mappings.length > 0) {
        await tx.insert(seriesDivisionMappingsTable).values(
          data.mappings.map((m) => ({
            groupId: data.groupId,
            competitionId: m.competitionId,
            competitionDivisionId: m.competitionDivisionId,
            seriesDivisionId: m.seriesDivisionId,
          })),
        )
      }
    })

    return { success: true, mappingCount: data.mappings.length }
  })

/**
 * Auto-map all competition divisions to the series template.
 * Does not save — returns proposed mappings for the UI to display.
 */
export const autoMapSeriesDivisionsFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({
        groupId: z.string().min(1),
      })
      .parse(data),
  )
  .handler(
    async ({
      data,
    }): Promise<{
      competitionMappings: SeriesDivisionMappingData[]
    }> => {
      const db = getDb()
      const session = await getSessionFromCookie()
      if (!session?.userId) throw new Error("Not authenticated")

      const [group] = await db
        .select()
        .from(competitionGroupsTable)
        .where(eq(competitionGroupsTable.id, data.groupId))
      if (!group) throw new Error("Series group not found")

      await requireTeamPermission(
        group.organizingTeamId,
        TEAM_PERMISSIONS.ACCESS_DASHBOARD,
      )

      const seriesSettings = parseSeriesSettings(group.settings)
      const templateGroupId = seriesSettings?.scalingGroupId
      if (!templateGroupId) {
        return { competitionMappings: [] }
      }

      // Load series template divisions
      const seriesDivisions = await db
        .select({
          id: scalingLevelsTable.id,
          label: scalingLevelsTable.label,
        })
        .from(scalingLevelsTable)
        .where(eq(scalingLevelsTable.scalingGroupId, templateGroupId))
        .orderBy(scalingLevelsTable.position)

      // Load competitions
      const comps = await db
        .select({
          id: competitionsTable.id,
          name: competitionsTable.name,
          settings: competitionsTable.settings,
        })
        .from(competitionsTable)
        .where(eq(competitionsTable.groupId, data.groupId))

      // Load existing saved mappings so we don't overwrite them
      const existingMappings = await db
        .select()
        .from(seriesDivisionMappingsTable)
        .where(eq(seriesDivisionMappingsTable.groupId, data.groupId))

      const competitionMappings: SeriesDivisionMappingData[] = []

      for (const comp of comps) {
        const compSettings = parseCompetitionSettings(comp.settings)
        const compScalingGroupId = compSettings?.divisions?.scalingGroupId
        if (!compScalingGroupId) {
          competitionMappings.push({
            competitionId: comp.id,
            competitionName: comp.name,
            mappings: [],
          })
          continue
        }

        const compDivisions = await db
          .select({
            id: scalingLevelsTable.id,
            label: scalingLevelsTable.label,
          })
          .from(scalingLevelsTable)
          .where(eq(scalingLevelsTable.scalingGroupId, compScalingGroupId))
          .orderBy(scalingLevelsTable.position)

        // Check for existing saved mappings for this competition
        const compExistingMappings = existingMappings.filter(
          (m) => m.competitionId === comp.id,
        )
        const existingLookup = new Map(
          compExistingMappings.map((m) => [
            m.competitionDivisionId,
            m.seriesDivisionId,
          ]),
        )

        // Auto-map only unmapped divisions; preserve existing mappings
        const autoMapped = autoMapDivisions(compDivisions, seriesDivisions)
        const merged = autoMapped.map((m) => {
          const existingSeriesDivId = existingLookup.get(
            m.competitionDivisionId,
          )
          if (existingSeriesDivId) {
            // Keep existing mapping
            return {
              ...m,
              seriesDivisionId: existingSeriesDivId,
              confidence: "exact" as const,
            }
          }
          return m
        })

        competitionMappings.push({
          competitionId: comp.id,
          competitionName: comp.name,
          mappings: merged,
        })
      }

      return { competitionMappings }
    },
  )

/**
 * Get the series mapping status for a single competition's divisions.
 * Used on the per-competition divisions page to show which divisions
 * are mapped/unmapped to the series template.
 */
export const getCompetitionSeriesMappingStatusFn = createServerFn({
  method: "GET",
})
  .inputValidator((data: unknown) =>
    z
      .object({
        competitionId: z.string().min(1),
        groupId: z.string().min(1),
      })
      .parse(data),
  )
  .handler(
    async ({
      data,
    }): Promise<{
      seriesName: string
      groupId: string
      hasTemplate: boolean
      divisions: Array<{
        divisionId: string
        divisionLabel: string
        mappedToSeriesLabel: string | null
      }>
    }> => {
      const db = getDb()

      // Load series group
      const [group] = await db
        .select({
          id: competitionGroupsTable.id,
          name: competitionGroupsTable.name,
          settings: competitionGroupsTable.settings,
        })
        .from(competitionGroupsTable)
        .where(eq(competitionGroupsTable.id, data.groupId))
      if (!group) {
        return {
          seriesName: "",
          groupId: data.groupId,
          hasTemplate: false,
          divisions: [],
        }
      }

      const seriesSettings = parseSeriesSettings(group.settings)
      const templateGroupId = seriesSettings?.scalingGroupId

      if (!templateGroupId) {
        return {
          seriesName: group.name,
          groupId: group.id,
          hasTemplate: false,
          divisions: [],
        }
      }

      // Load series template divisions
      const templateLevels = await db
        .select({
          id: scalingLevelsTable.id,
          label: scalingLevelsTable.label,
        })
        .from(scalingLevelsTable)
        .where(eq(scalingLevelsTable.scalingGroupId, templateGroupId))
      const templateLabelMap = new Map(
        templateLevels.map((l) => [l.id, l.label]),
      )

      // Load competition's scaling group
      const [comp] = await db
        .select({ settings: competitionsTable.settings })
        .from(competitionsTable)
        .where(eq(competitionsTable.id, data.competitionId))
      if (!comp) {
        return {
          seriesName: group.name,
          groupId: group.id,
          hasTemplate: true,
          divisions: [],
        }
      }

      const compSettings = parseCompetitionSettings(comp.settings)
      const compScalingGroupId = compSettings?.divisions?.scalingGroupId
      if (!compScalingGroupId) {
        return {
          seriesName: group.name,
          groupId: group.id,
          hasTemplate: true,
          divisions: [],
        }
      }

      // Load competition's divisions
      const compDivisions = await db
        .select({
          id: scalingLevelsTable.id,
          label: scalingLevelsTable.label,
        })
        .from(scalingLevelsTable)
        .where(eq(scalingLevelsTable.scalingGroupId, compScalingGroupId))
        .orderBy(scalingLevelsTable.position)

      // Load existing mappings for this competition
      const mappings = await db
        .select()
        .from(seriesDivisionMappingsTable)
        .where(
          and(
            eq(seriesDivisionMappingsTable.groupId, data.groupId),
            eq(seriesDivisionMappingsTable.competitionId, data.competitionId),
          ),
        )

      const mappingLookup = new Map(
        mappings.map((m) => [m.competitionDivisionId, m.seriesDivisionId]),
      )

      const divisions = compDivisions.map((div) => {
        const seriesDivId = mappingLookup.get(div.id)
        return {
          divisionId: div.id,
          divisionLabel: div.label,
          mappedToSeriesLabel: seriesDivId
            ? (templateLabelMap.get(seriesDivId) ?? null)
            : null,
        }
      })

      return {
        seriesName: group.name,
        groupId: group.id,
        hasTemplate: true,
        divisions,
      }
    },
  )

/**
 * Update the series template divisions (label, teamSize, fee, description, maxSpots).
 * Accepts the full list of divisions — replaces scaling levels + template configs.
 */
export const updateSeriesTemplateFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        groupId: z.string().min(1),
        divisions: z
          .array(
            z.object({
              id: z.string().min(1),
              label: z.string().min(1),
              teamSize: z.number().int().min(1),
              feeCents: z.number().int().min(0).default(0),
              description: z.string().nullable().optional(),
              maxSpots: z.number().int().min(1).nullable().optional(),
            }),
          )
          .min(1),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const db = getDb()
    const session = await getSessionFromCookie()
    if (!session?.userId) throw new Error("Not authenticated")

    const [group] = await db
      .select()
      .from(competitionGroupsTable)
      .where(eq(competitionGroupsTable.id, data.groupId))
    if (!group) throw new Error("Series group not found")

    await requireTeamPermission(
      group.organizingTeamId,
      TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
    )

    const seriesSettings = parseSeriesSettings(group.settings)
    const templateGroupId = seriesSettings?.scalingGroupId
    if (!templateGroupId) throw new Error("No template configured")

    // Update each scaling level and its template config
    for (let i = 0; i < data.divisions.length; i++) {
      const div = data.divisions[i]

      // Update scaling level (label, teamSize, position) — scoped to template group
      await db
        .update(scalingLevelsTable)
        .set({
          label: div.label,
          teamSize: div.teamSize,
          position: i,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(scalingLevelsTable.id, div.id),
            eq(scalingLevelsTable.scalingGroupId, templateGroupId),
          ),
        )

      // Upsert template division config
      const [existing] = await db
        .select({ id: seriesTemplateDivisionsTable.id })
        .from(seriesTemplateDivisionsTable)
        .where(
          and(
            eq(seriesTemplateDivisionsTable.groupId, data.groupId),
            eq(seriesTemplateDivisionsTable.divisionId, div.id),
          ),
        )

      if (existing) {
        await db
          .update(seriesTemplateDivisionsTable)
          .set({
            feeCents: div.feeCents ?? 0,
            description: div.description ?? null,
            maxSpots: div.maxSpots ?? null,
            updatedAt: new Date(),
          })
          .where(eq(seriesTemplateDivisionsTable.id, existing.id))
      } else {
        await db.insert(seriesTemplateDivisionsTable).values({
          groupId: data.groupId,
          divisionId: div.id,
          feeCents: div.feeCents ?? 0,
          description: div.description ?? null,
          maxSpots: div.maxSpots ?? null,
        })
      }
    }

    return { success: true }
  })

// ============================================================================
// Preview / Sync types
// ============================================================================

export interface SyncPreviewDivisionChange {
  divisionLabel: string
  isNew: boolean
  changes: string[]
  currentFeeCents: number
  newFeeCents: number
  currentDescription: string | null
  newDescription: string | null
  currentMaxSpots: number | null
  newMaxSpots: number | null
}

export interface SyncPreviewCompetition {
  competitionId: string
  competitionName: string
  divisions: SyncPreviewDivisionChange[]
}

export interface SyncPreviewResult {
  competitions: SyncPreviewCompetition[]
  totalDivisions: number
}

/**
 * Preview what syncTemplateToCompetitions would change WITHOUT making changes.
 * Returns a diff for each competition/division that would be created or updated.
 */
export const previewSyncToCompetitionsFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({
        groupId: z.string().min(1),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<SyncPreviewResult> => {
    const db = getDb()
    const session = await getSessionFromCookie()
    if (!session?.userId) throw new Error("Not authenticated")

    const [group] = await db
      .select()
      .from(competitionGroupsTable)
      .where(eq(competitionGroupsTable.id, data.groupId))
    if (!group) throw new Error("Series group not found")

    await requireTeamPermission(
      group.organizingTeamId,
      TEAM_PERMISSIONS.ACCESS_DASHBOARD,
    )

    // Load template division configs
    const templateConfigs = await db
      .select()
      .from(seriesTemplateDivisionsTable)
      .where(eq(seriesTemplateDivisionsTable.groupId, data.groupId))

    if (templateConfigs.length === 0) {
      return { competitions: [], totalDivisions: 0 }
    }

    const templateConfigMap = new Map(
      templateConfigs.map((c) => [c.divisionId, c]),
    )

    // Load all mappings for this series
    const mappings = await db
      .select()
      .from(seriesDivisionMappingsTable)
      .where(eq(seriesDivisionMappingsTable.groupId, data.groupId))

    if (mappings.length === 0) {
      return { competitions: [], totalDivisions: 0 }
    }

    // Load competition names
    const compIds = [...new Set(mappings.map((m) => m.competitionId))]
    const comps = await db
      .select({ id: competitionsTable.id, name: competitionsTable.name })
      .from(competitionsTable)
      .where(inArray(competitionsTable.id, compIds))
    const compNameMap = new Map(comps.map((c) => [c.id, c.name]))

    // Load competition division labels (scaling levels)
    const compDivIds = mappings.map((m) => m.competitionDivisionId)
    const compDivLabels =
      compDivIds.length > 0
        ? await db
            .select({
              id: scalingLevelsTable.id,
              label: scalingLevelsTable.label,
            })
            .from(scalingLevelsTable)
            .where(inArray(scalingLevelsTable.id, compDivIds))
        : []
    const compDivLabelMap = new Map(compDivLabels.map((l) => [l.id, l.label]))

    // Group mappings by competition
    const mappingsByComp = new Map<string, typeof mappings>()
    for (const m of mappings) {
      const arr = mappingsByComp.get(m.competitionId) ?? []
      arr.push(m)
      mappingsByComp.set(m.competitionId, arr)
    }

    const competitions: SyncPreviewCompetition[] = []
    let totalDivisions = 0

    for (const [compId, compMappings] of mappingsByComp) {
      const divisions: SyncPreviewDivisionChange[] = []

      for (const mapping of compMappings) {
        const templateConfig = templateConfigMap.get(mapping.seriesDivisionId)
        if (!templateConfig) continue

        // Check if competition_divisions row already exists
        const [existing] = await db
          .select()
          .from(competitionDivisionsTable)
          .where(
            and(
              eq(
                competitionDivisionsTable.competitionId,
                mapping.competitionId,
              ),
              eq(
                competitionDivisionsTable.divisionId,
                mapping.competitionDivisionId,
              ),
            ),
          )

        const divLabel =
          compDivLabelMap.get(mapping.competitionDivisionId) ??
          "Unknown Division"
        const isNew = !existing

        const currentFee = existing?.feeCents ?? 0
        const currentDesc = existing?.description ?? null
        const currentMaxSpots = existing?.maxSpots ?? null

        const newFee = templateConfig.feeCents
        const newDesc = templateConfig.description
        const newMaxSpots = templateConfig.maxSpots

        // Build human-readable change descriptions
        const changes: string[] = []

        if (isNew) {
          if (newFee > 0) {
            changes.push(`fee $${(newFee / 100).toFixed(2)}`)
          }
          if (newDesc) {
            changes.push("description set")
          }
          if (newMaxSpots) {
            changes.push(`max spots ${newMaxSpots}`)
          }
          if (changes.length === 0) {
            changes.push("new row (default values)")
          }
        } else {
          if (currentFee !== newFee) {
            changes.push(
              `fee $${(currentFee / 100).toFixed(2)} \u2192 $${(newFee / 100).toFixed(2)}`,
            )
          }
          if ((currentDesc ?? "") !== (newDesc ?? "")) {
            changes.push("description updated")
          }
          if (currentMaxSpots !== newMaxSpots) {
            const fromStr =
              currentMaxSpots != null ? String(currentMaxSpots) : "unlimited"
            const toStr =
              newMaxSpots != null ? String(newMaxSpots) : "unlimited"
            changes.push(`max spots ${fromStr} \u2192 ${toStr}`)
          }
        }

        // Only include divisions that actually have changes
        if (changes.length > 0) {
          divisions.push({
            divisionLabel: divLabel,
            isNew,
            changes,
            currentFeeCents: currentFee,
            newFeeCents: newFee,
            currentDescription: currentDesc,
            newDescription: newDesc,
            currentMaxSpots: currentMaxSpots,
            newMaxSpots: newMaxSpots,
          })
          totalDivisions++
        }
      }

      if (divisions.length > 0) {
        competitions.push({
          competitionId: compId,
          competitionName: compNameMap.get(compId) ?? "Unknown Competition",
          divisions,
        })
      }
    }

    return { competitions, totalDivisions }
  })

/**
 * Sync series template division settings downstream to all mapped competitions.
 * For each mapping, copies the template's feeCents, description, and maxSpots
 * into the competition's competition_divisions row.
 */
export const syncTemplateToCompetitionsFn = createServerFn({
  method: "POST",
})
  .inputValidator((data: unknown) =>
    z
      .object({
        groupId: z.string().min(1),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const db = getDb()
    const session = await getSessionFromCookie()
    if (!session?.userId) throw new Error("Not authenticated")

    const [group] = await db
      .select()
      .from(competitionGroupsTable)
      .where(eq(competitionGroupsTable.id, data.groupId))
    if (!group) throw new Error("Series group not found")

    await requireTeamPermission(
      group.organizingTeamId,
      TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
    )

    // Load template division configs
    const templateConfigs = await db
      .select()
      .from(seriesTemplateDivisionsTable)
      .where(eq(seriesTemplateDivisionsTable.groupId, data.groupId))

    if (templateConfigs.length === 0) {
      return { synced: 0 }
    }

    const templateConfigMap = new Map(
      templateConfigs.map((c) => [c.divisionId, c]),
    )

    // Load all mappings for this series
    const mappings = await db
      .select()
      .from(seriesDivisionMappingsTable)
      .where(eq(seriesDivisionMappingsTable.groupId, data.groupId))

    let synced = 0

    for (const mapping of mappings) {
      const templateConfig = templateConfigMap.get(mapping.seriesDivisionId)
      if (!templateConfig) continue

      // Check if a competition_divisions row exists
      const [existing] = await db
        .select({ id: competitionDivisionsTable.id })
        .from(competitionDivisionsTable)
        .where(
          and(
            eq(competitionDivisionsTable.competitionId, mapping.competitionId),
            eq(
              competitionDivisionsTable.divisionId,
              mapping.competitionDivisionId,
            ),
          ),
        )

      if (existing) {
        await db
          .update(competitionDivisionsTable)
          .set({
            feeCents: templateConfig.feeCents,
            description: templateConfig.description,
            maxSpots: templateConfig.maxSpots,
            updatedAt: new Date(),
          })
          .where(eq(competitionDivisionsTable.id, existing.id))
      } else {
        await db.insert(competitionDivisionsTable).values({
          competitionId: mapping.competitionId,
          divisionId: mapping.competitionDivisionId,
          feeCents: templateConfig.feeCents,
          description: templateConfig.description,
          maxSpots: templateConfig.maxSpots,
        })
      }
      synced++
    }

    return { synced }
  })

/**
 * Get template divisions for a series group.
 * Lightweight query for the competition creation form.
 */
export const getSeriesTemplateDivisionsFn = createServerFn({
  method: "GET",
})
  .inputValidator((data: unknown) =>
    z
      .object({
        groupId: z.string().min(1),
      })
      .parse(data),
  )
  .handler(
    async ({
      data,
    }): Promise<{
      scalingGroupId: string | null
      divisions: Array<{
        id: string
        label: string
        teamSize: number
      }>
    }> => {
      const db = getDb()
      const session = await getSessionFromCookie()
      if (!session?.userId) throw new Error("Not authenticated")

      const [group] = await db
        .select({ settings: competitionGroupsTable.settings })
        .from(competitionGroupsTable)
        .where(eq(competitionGroupsTable.id, data.groupId))
      if (!group) return { scalingGroupId: null, divisions: [] }

      const seriesSettings = parseSeriesSettings(group.settings)
      const templateGroupId = seriesSettings?.scalingGroupId
      if (!templateGroupId) return { scalingGroupId: null, divisions: [] }

      const levels = await db
        .select({
          id: scalingLevelsTable.id,
          label: scalingLevelsTable.label,
          teamSize: scalingLevelsTable.teamSize,
        })
        .from(scalingLevelsTable)
        .where(eq(scalingLevelsTable.scalingGroupId, templateGroupId))
        .orderBy(scalingLevelsTable.position)

      return { scalingGroupId: templateGroupId, divisions: levels }
    },
  )
