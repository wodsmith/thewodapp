// @lat: [[crew#Published Volunteer Schedule]]
import type { InferSelectModel } from "drizzle-orm"
import { datetime, json, mysqlTable, varchar } from "drizzle-orm/mysql-core"
import { commonColumns } from "./common"

// One public release per event. Draft source edits never mutate this snapshot.
// Its application-owned schema is validated before writes and public reads.
export const crewPublishedSchedulesTable = mysqlTable("crew_published_schedules", {
  ...commonColumns,
  competitionId: varchar({ length: 255 }).primaryKey().notNull(),
  snapshot: json().$type<unknown>().notNull(),
  publishedAt: datetime().notNull(),
})

export type CrewPublishedScheduleRow = InferSelectModel<typeof crewPublishedSchedulesTable>
