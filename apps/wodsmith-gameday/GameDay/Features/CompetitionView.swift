import SwiftUI

struct CompetitionView: View {
    @Environment(GameDayStore.self) private var store
    let competitionID: String
    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 24) {
                SyncStatus(resource: .competition(competitionID))
                if let detail = store.details[competitionID] {
                    if !detail.registrations.isEmpty {
                        VStack(alignment: .leading, spacing: 6) {
                            Text(detail.competition.name).font(.title.bold())
                            Text(detail.competition.dateLabel + " · " + detail.competition.location).font(.subheadline).foregroundStyle(.secondary)
                        }
                        AthleteSchedule(detail: detail)
                    } else {
                        CompetitionCard(competition: detail.competition)
                    }
                    SectionEyebrow(title: "Competition hub")
                    VStack(spacing: 0) {
                        hubLink("Full schedule", subtitle: "Every event and heat", icon: "calendar.badge.clock") { FullScheduleView(detail: detail) }
                        Divider().padding(.leading, 56)
                        hubLink("Workouts", subtitle: "The tests ahead", icon: "dumbbell") { WorkoutsView(detail: detail) }
                        Divider().padding(.leading, 56)
                        hubLink("Leaderboard", subtitle: "Standings by division", icon: "list.number") { LeaderboardView(competitionID: competitionID) }
                        Divider().padding(.leading, 56)
                        hubLink("Announcements", subtitle: "Updates from your organizer", icon: "megaphone") { AnnouncementsView(detail: detail) }
                        if !detail.registrations.isEmpty {
                            Divider().padding(.leading, 56)
                            hubLink("My registration", subtitle: "Division, team, and check-in", icon: "ticket") { RegistrationView(detail: detail) }
                        }
                    }.background(Color(uiColor: .secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 20))
                    VStack(alignment: .leading, spacing: 12) {
                        Text("About the competition").font(.headline)
                        if let description = detail.competition.description { MarkdownText(text: description) }
                        if !detail.competition.location.isEmpty {
                            Label(detail.competition.location, systemImage: "mappin.and.ellipse").font(.subheadline)
                        }
                        if let address = detail.competition.address { Text(address).font(.subheadline).foregroundStyle(.secondary) }
                        Label(detail.competition.timezone ?? "America/Denver", systemImage: "globe").font(.caption).foregroundStyle(.secondary)
                        Link("Open on WODsmith", destination: detail.competition.webURL).font(.subheadline.bold())
                    }.gameDayCard()
                } else if store.status(.competition(competitionID)).error == nil { ProgressView("Loading competition…").frame(maxWidth: .infinity).padding(40) }
                else { EmptyState(title: "Competition unavailable", message: "Reconnect and try again. The organizer may also have unpublished this competition.") }
            }.padding(20)
        }.background(Color.gameDayPaper)
            .navigationTitle("Competition").navigationBarTitleDisplayMode(.inline)
            .task { await store.loadCompetition(competitionID) }
            .refreshable { await store.loadCompetition(competitionID) }
    }
    private func hubLink<Destination: View>(_ title: String, subtitle: String, icon: String, @ViewBuilder destination: () -> Destination) -> some View {
        NavigationLink(destination: destination) {
            HStack(spacing: 14) {
                Image(systemName: icon).font(.title3).foregroundStyle(Color.gameDayOrange).frame(width: 28)
                VStack(alignment: .leading, spacing: 4) { Text(title).font(.headline); Text(subtitle).font(.caption).foregroundStyle(.secondary) }
                Spacer()
                Image(systemName: "chevron.right").font(.caption.bold()).foregroundStyle(.tertiary)
            }.padding(18)
        }.buttonStyle(.plain)
    }
}

struct AthleteSchedule: View {
    let detail: CompetitionDetail
    var body: some View {
        TimelineView(.periodic(from: .now, by: 30)) { timeline in
            let next = detail.nextHeat(at: timeline.date)
            let later = detail.myHeats.filter { $0.id != next?.id && ($0.endsAt ?? .distantFuture) > timeline.date }
            let earlier = detail.myHeats.filter { ($0.endsAt ?? .distantFuture) <= timeline.date }
            VStack(alignment: .leading, spacing: 16) {
                if let next { NextHeatCard(heat: next, detail: detail) }
                else if detail.myHeats.isEmpty {
                    Text("Your schedule will appear when the organizer publishes your heat assignments.")
                        .foregroundStyle(.secondary).padding(.vertical, 12)
                } else {
                    Label("All scheduled heats have ended", systemImage: "flag.checkered").font(.headline).padding(.vertical, 12)
                }
                if !later.isEmpty {
                    Text("After this").font(.headline).accessibilityAddTraits(.isHeader)
                    ForEach(later) { heat in
                        HeatRow(heat: heat, competition: detail.competition, lane: detail.lane(for: heat))
                        Divider()
                    }
                }
                if !earlier.isEmpty {
                    DisclosureGroup("Earlier heats") {
                        ForEach(earlier) { heat in HeatRow(heat: heat, competition: detail.competition, lane: detail.lane(for: heat)) }
                    }.font(.subheadline)
                }
                NavigationLink { ReminderSettingsView() } label: {
                    Label("Heat reminders", systemImage: "bell").font(.subheadline.weight(.semibold)).frame(minHeight: 44)
                }
            }
        }
    }
}

struct NextHeatCard: View {
    @Environment(GameDayStore.self) private var store
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    let heat: Heat
    let detail: CompetitionDetail
    @State private var activityError: String?
    @State private var starting = false
    private var isActive: Bool { store.activities.activeHeatID == heat.id }
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(heat.eventName).font(.title2.bold()).accessibilityAddTraits(.isHeader)
            Text("Heat \(heat.heatNumber) · \(heat.venue ?? "Venue to be announced")")
                .font(.subheadline).foregroundStyle(.white.opacity(0.85))
            let layout = dynamicTypeSize.isAccessibilitySize ? AnyLayout(VStackLayout(alignment: .leading, spacing: 12)) : AnyLayout(HStackLayout(alignment: .top, spacing: 24))
            layout {
                VStack(alignment: .leading, spacing: 5) {
                    Text(heat.timeLabel(in: detail.competition.timeZone)).font(.title.bold()).monospacedDigit()
                    Text(heat.dayLabel(in: detail.competition.timeZone)).font(.subheadline)
                }
                Spacer(minLength: 0)
                if let lane = detail.lane(for: heat) {
                    VStack(alignment: .leading, spacing: 5) {
                        Text("Lane \(lane)").font(.title.bold())
                        Text(detail.competition.timeZone.abbreviation() ?? "Venue time").font(.subheadline)
                    }
                }
            }
            if let start = heat.startsAt {
                if start > .now {
                    HStack(spacing: 8) {
                        Text("Starts in").font(.subheadline)
                        Text(timerInterval: Date.now...start, countsDown: true)
                            .font(.title3.monospacedDigit().weight(.semibold)).frame(maxWidth: .infinity, alignment: .leading)
                            .accessibilityLabel("Time until your heat starts")
                    }
                } else { Text("Heat in progress").font(.subheadline.weight(.semibold)) }
            }
            Button {
                starting = true
                Task {
                    defer { starting = false }
                    do {
                        if isActive { await store.activities.end() }
                        else { try await store.activities.start(heat: heat, detail: detail) }
                    } catch { activityError = error.localizedDescription }
                }
            } label: {
                Label(starting ? "Updating…" : isActive ? "End Lock Screen countdown" : "Show on Lock Screen",
                      systemImage: isActive ? "stop.circle" : "platter.filled.bottom.iphone")
                    .font(.subheadline.weight(.semibold)).frame(maxWidth: .infinity, minHeight: 32)
            }.buttonStyle(.bordered).tint(.white).controlSize(.regular).disabled(starting)
        }.padding(20).foregroundStyle(.white).background(Color.gameDayInk, in: RoundedRectangle(cornerRadius: 16))
            .alert("Lock Screen countdown", isPresented: Binding(get: { activityError != nil }, set: { if !$0 { activityError = nil } })) {
                Button("OK") { activityError = nil }
            } message: { Text(activityError ?? "") }
    }
}

struct HeatRow: View {
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    let heat: Heat
    let competition: Competition
    var lane: Int?
    var body: some View {
        let layout = dynamicTypeSize.isAccessibilitySize ? AnyLayout(VStackLayout(alignment: .leading, spacing: 8)) : AnyLayout(HStackLayout(alignment: .top, spacing: 16))
        layout {
            VStack(alignment: .leading, spacing: 4) {
                Text(heat.timeLabel(in: competition.timeZone)).font(.headline).monospacedDigit()
                Text(heat.dayLabel(in: competition.timeZone)).font(.caption).foregroundStyle(.secondary)
            }.frame(minWidth: dynamicTypeSize.isAccessibilitySize ? nil : 80, alignment: .leading)
            VStack(alignment: .leading, spacing: 5) {
                Text(heat.eventName).font(.headline)
                Text(["Heat \(heat.heatNumber)", lane.map { "Lane \($0)" }, heat.venue].compactMap { $0 }.joined(separator: " · "))
                    .font(.subheadline).foregroundStyle(.secondary)
                if let division = heat.division { Text(division).font(.caption).foregroundStyle(.secondary) }
            }.frame(maxWidth: .infinity, alignment: .leading)
        }.padding(.vertical, 10).accessibilityElement(children: .combine)
    }
}

struct MarkdownText: View {
    let text: String
    var body: some View {
        Text((try? AttributedString(markdown: text, options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace))) ?? AttributedString(text))
            .font(.body).textSelection(.enabled)
    }
}
