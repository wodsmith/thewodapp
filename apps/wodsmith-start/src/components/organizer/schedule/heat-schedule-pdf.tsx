import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer"
import type {
  HeatExportEventGroup,
  HeatExportRow,
} from "@/lib/heat-schedule-export"

const styles = StyleSheet.create({
  page: {
    padding: 32,
    fontSize: 9,
    fontFamily: "Helvetica",
  },
  header: {
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: "bold",
  },
  subtitle: {
    fontSize: 10,
    color: "#6b7280",
    marginTop: 2,
  },
  groupBlock: {
    marginBottom: 14,
  },
  parentLabel: {
    fontSize: 11,
    fontWeight: "bold",
    textTransform: "uppercase",
    color: "#374151",
    backgroundColor: "#f3f4f6",
    paddingVertical: 4,
    paddingHorizontal: 6,
    marginBottom: 4,
  },
  eventLabel: {
    fontSize: 11,
    fontWeight: "bold",
    marginTop: 6,
    marginBottom: 4,
  },
  subEventLabel: {
    fontSize: 10,
    fontWeight: "bold",
    marginTop: 6,
    marginBottom: 4,
    marginLeft: 8,
    color: "#1f2937",
  },
  table: {
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingVertical: 3,
  },
  tableHeaderRow: {
    backgroundColor: "#f9fafb",
  },
  cellHeat: { width: "8%" },
  cellTime: { width: "16%" },
  cellVenue: { width: "14%" },
  cellHeatDiv: { width: "12%" },
  cellLane: { width: "6%" },
  cellAthlete: { width: "20%" },
  cellAthDiv: { width: "12%" },
  cellAffiliate: { width: "12%" },
  th: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#6b7280",
    textTransform: "uppercase",
    paddingHorizontal: 3,
  },
  td: {
    fontSize: 9,
    paddingHorizontal: 3,
  },
  unpublished: {
    color: "#92400e",
  },
  emptyHeatNote: {
    fontStyle: "italic",
    color: "#9ca3af",
  },
  footer: {
    position: "absolute",
    bottom: 16,
    left: 32,
    right: 32,
    textAlign: "center",
    color: "#9ca3af",
    fontSize: 8,
  },
})

interface HeatSchedulePdfProps {
  competitionName: string
  generatedAt: Date
  groups: HeatExportEventGroup[]
}

function formatHeatTime(d: Date | null): string {
  if (!d) return "Unscheduled"
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
}

function HeatTable({ heats }: { heats: HeatExportRow[] }) {
  if (heats.length === 0) {
    return <Text style={styles.emptyHeatNote}>No heats scheduled.</Text>
  }
  return (
    <View style={styles.table}>
      <View style={[styles.tableRow, styles.tableHeaderRow]}>
        <Text style={[styles.th, styles.cellHeat]}>Heat</Text>
        <Text style={[styles.th, styles.cellTime]}>Time</Text>
        <Text style={[styles.th, styles.cellVenue]}>Venue</Text>
        <Text style={[styles.th, styles.cellHeatDiv]}>Heat Div.</Text>
        <Text style={[styles.th, styles.cellLane]}>Lane</Text>
        <Text style={[styles.th, styles.cellAthlete]}>Athlete / Team</Text>
        <Text style={[styles.th, styles.cellAthDiv]}>Division</Text>
        <Text style={[styles.th, styles.cellAffiliate]}>Affiliate</Text>
      </View>
      {heats.flatMap((heat) => {
        const baseTime = formatHeatTime(heat.scheduledTime)
        const venue = heat.venueName ?? "—"
        const heatDiv = heat.heatDivision ?? "Mixed"
        const heatLabel = `#${heat.heatNumber}${heat.isPublished ? "" : " (draft)"}`
        if (heat.assignments.length === 0) {
          return [
            <View key={heat.heatId} style={styles.tableRow} wrap={false}>
              <Text
                style={
                  heat.isPublished
                    ? [styles.td, styles.cellHeat]
                    : [styles.td, styles.cellHeat, styles.unpublished]
                }
              >
                {heatLabel}
              </Text>
              <Text style={[styles.td, styles.cellTime]}>{baseTime}</Text>
              <Text style={[styles.td, styles.cellVenue]}>{venue}</Text>
              <Text style={[styles.td, styles.cellHeatDiv]}>{heatDiv}</Text>
              <Text style={[styles.td, styles.cellLane]}>—</Text>
              <Text
                style={[styles.td, styles.cellAthlete, styles.emptyHeatNote]}
              >
                No assignments
              </Text>
              <Text style={[styles.td, styles.cellAthDiv]}>—</Text>
              <Text style={[styles.td, styles.cellAffiliate]}>—</Text>
            </View>,
          ]
        }
        return heat.assignments.map((a, i) => (
          <View key={`${heat.heatId}-${a.laneNumber}`} style={styles.tableRow} wrap={false}>
            <Text
              style={
                heat.isPublished
                  ? [styles.td, styles.cellHeat]
                  : [styles.td, styles.cellHeat, styles.unpublished]
              }
            >
              {i === 0 ? heatLabel : ""}
            </Text>
            <Text style={[styles.td, styles.cellTime]}>
              {i === 0 ? baseTime : ""}
            </Text>
            <Text style={[styles.td, styles.cellVenue]}>
              {i === 0 ? venue : ""}
            </Text>
            <Text style={[styles.td, styles.cellHeatDiv]}>
              {i === 0 ? heatDiv : ""}
            </Text>
            <Text style={[styles.td, styles.cellLane]}>{a.laneNumber}</Text>
            <Text style={[styles.td, styles.cellAthlete]}>
              {a.teamName ?? a.athleteName}
            </Text>
            <Text style={[styles.td, styles.cellAthDiv]}>
              {a.athleteDivision ?? "—"}
            </Text>
            <Text style={[styles.td, styles.cellAffiliate]}>
              {a.affiliate ?? "—"}
            </Text>
          </View>
        ))
      })}
    </View>
  )
}

export function HeatSchedulePdf({
  competitionName,
  generatedAt,
  groups,
}: HeatSchedulePdfProps) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.header} fixed>
          <Text style={styles.title}>Heat Schedule — {competitionName}</Text>
          <Text style={styles.subtitle}>
            Generated {generatedAt.toLocaleString("en-US", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </Text>
        </View>

        {groups.length === 0 ? (
          <Text style={styles.emptyHeatNote}>No heats have been created.</Text>
        ) : (
          groups.map((group) => {
            const isParentGroup =
              group.events.length > 1 ||
              group.events.some((e) => e.parentEventId)
            return (
              <View key={group.key} style={styles.groupBlock} wrap>
                {isParentGroup ? (
                  <>
                    <Text style={styles.parentLabel}>{group.label}</Text>
                    {group.events.map((event) => (
                      <View key={event.id} wrap>
                        <Text style={styles.subEventLabel}>{event.name}</Text>
                        <HeatTable heats={event.heats} />
                      </View>
                    ))}
                  </>
                ) : (
                  group.events.map((event) => (
                    <View key={event.id} wrap>
                      <Text style={styles.eventLabel}>{event.name}</Text>
                      <HeatTable heats={event.heats} />
                    </View>
                  ))
                )}
              </View>
            )
          })
        )}

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `Page ${pageNumber} of ${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  )
}
