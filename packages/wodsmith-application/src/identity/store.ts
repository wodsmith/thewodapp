import { err, type Result } from "../core/result"
import type { CompetitionId } from "./ids"
import {
  type IdentityCorruption,
  resolveLegacyCompetitionTopology,
} from "./legacy-adapter"
import type { LegacyCompetitionIdentitySnapshot } from "./legacy-types"
import type { CompetitionTopology } from "./model"

export interface CompetitionNotFound {
  readonly kind: "CompetitionNotFound"
  readonly competitionId: CompetitionId
}

export interface IdentityReadFailure {
  readonly kind: "IdentityReadFailure"
  readonly competitionId: CompetitionId
  readonly cause: unknown
}

export type CompetitionTopologyLoadError =
  | CompetitionNotFound
  | IdentityCorruption
  | IdentityReadFailure

export interface CompetitionTopologyStore {
  load(
    competitionId: CompetitionId,
  ): Promise<Result<CompetitionTopology, CompetitionTopologyLoadError>>
}

export interface LegacyCompetitionIdentityReader {
  readSnapshot(
    competitionId: CompetitionId,
  ): Promise<LegacyCompetitionIdentitySnapshot | null>
}

/**
 * Keeps legacy storage knowledge behind one deep seam. The reader performs
 * joins; this adapter validates their meaning before granting domain authority.
 */
export function createLegacyCompetitionIdentityAdapter(
  reader: LegacyCompetitionIdentityReader,
): CompetitionTopologyStore {
  return {
    async load(competitionId) {
      try {
        const snapshot = await reader.readSnapshot(competitionId)
        if (snapshot === null) {
          return err({ kind: "CompetitionNotFound", competitionId })
        }
        if (snapshot.competition.id !== competitionId) {
          return err({
            kind: "IdentityCorruption",
            code: "SNAPSHOT_COMPETITION_MISMATCH",
            source: {
              table: "competitions",
              rowId: snapshot.competition.id,
            },
            invariant:
              "The legacy reader must return the competition requested by the caller",
            relatedIds: [competitionId, snapshot.competition.id],
          })
        }
        return resolveLegacyCompetitionTopology(snapshot)
      } catch (cause) {
        return err({ kind: "IdentityReadFailure", competitionId, cause })
      }
    },
  }
}
