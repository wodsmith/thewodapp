import ActivityKit
import SwiftUI
import WidgetKit

@main
struct GameDayWidgetBundle: WidgetBundle {
    var body: some Widget { HeatLiveActivity() }
}

struct HeatLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: HeatActivityAttributes.self) { context in
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Label("WODsmith · Game Day", systemImage: "flame.fill").font(.caption.bold()).foregroundStyle(.orange)
                    Spacer()
                    Text(context.attributes.competitionName).font(.caption).lineLimit(1)
                }
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(context.state.eventName).font(.headline)
                        Text("Heat \(context.state.heatNumber) · \(context.state.venue)").font(.caption)
                        if let lane = context.state.lane { Text("Lane \(lane)").font(.caption.bold()) }
                    }
                    Spacer()
                    VStack(alignment: .trailing) {
                        Text(context.isStale ? "CHECK SCHEDULE" : "HEAT START").font(.caption2)
                        Text(timerInterval: Date.distantPast...context.state.startsAt, countsDown: true)
                            .font(.title.monospacedDigit().bold()).multilineTextAlignment(.trailing)
                    }.frame(maxWidth: 130)
                }
            }
            .padding(18).activityBackgroundTint(Color.black).activitySystemActionForegroundColor(.orange)
            .foregroundStyle(.white)
            .widgetURL(URL(string: "wodsmith-gameday://competition/\(context.attributes.competitionID)"))
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Label("Heat \(context.state.heatNumber)", systemImage: "flame.fill").foregroundStyle(.orange)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    if let lane = context.state.lane { Text("Lane \(lane)").bold() }
                }
                DynamicIslandExpandedRegion(.bottom) {
                    HStack {
                        VStack(alignment: .leading) {
                            Text(context.state.eventName).font(.headline)
                            Text(context.state.venue).font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer()
                        Text(timerInterval: Date.distantPast...context.state.startsAt, countsDown: true)
                            .monospacedDigit().frame(maxWidth: 100)
                    }
                }
            } compactLeading: {
                Image(systemName: "flame.fill").foregroundStyle(.orange)
            } compactTrailing: {
                Text(timerInterval: Date.distantPast...context.state.startsAt, countsDown: true)
                    .monospacedDigit().frame(width: 54)
            } minimal: {
                Image(systemName: "timer").foregroundStyle(.orange)
            }
            .widgetURL(URL(string: "wodsmith-gameday://competition/\(context.attributes.competitionID)"))
            .keylineTint(.orange)
        }
    }
}
