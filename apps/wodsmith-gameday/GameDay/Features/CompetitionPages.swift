import SwiftUI

struct FullScheduleView: View {
    let detail: CompetitionDetail
    @State private var division = "All divisions"
    @State private var event = "All events"
    @State private var onlyMine: Bool?
    private var isAthlete: Bool { !AthleteCompetitionDefaults.registrations(detail.registrations, competitionID: detail.competition.id).isEmpty }
    private var showingMine: Bool { onlyMine ?? isAthlete }
    var divisions: [String] { Array(Set(detail.heats.compactMap(\.division))).sorted() }
    var filtered: [Heat] { AthleteCompetitionDefaults.scheduleHeats(detail: detail, onlyMine: onlyMine).filter { (showingMine || division == "All divisions" || $0.division == division) && (event == "All events" || $0.eventName == event) } }
    var body: some View {
        List {
            Section {
                if isAthlete {
                    Toggle("My heats only", isOn: Binding(get: { showingMine }, set: { onlyMine = $0 }))
                }
                if !showingMine {
                    Picker("Division", selection: $division) { Text("All divisions").tag("All divisions"); ForEach(divisions, id: \.self) { Text($0).tag($0) } }
                }
                Picker("Event", selection: $event) { Text("All events").tag("All events"); ForEach(detail.workouts) { Text($0.name).tag($0.name) } }
            }
            Section {
                if filtered.isEmpty { EmptyState(title: "No published heats", message: "Check back when the organizer publishes the schedule, or try another filter.") }
                ForEach(filtered) { heat in HeatRow(heat: heat, competition: detail.competition, lane: detail.lane(for: heat)) }
            } footer: { Text("Times shown in \(detail.competition.timezone ?? "America/Denver").") }
        }.navigationTitle("Full schedule").navigationBarTitleDisplayMode(.inline)
    }
}

struct WorkoutsView: View {
    let detail: CompetitionDetail
    var body: some View {
        List {
            if detail.workouts.isEmpty { EmptyState(title: "No published workouts", message: "Workouts appear when the organizer publishes them.", symbol: "dumbbell") }
            ForEach(detail.workouts) { workout in
                NavigationLink {
                    WorkoutDetailView(workout: workout, detail: detail)
                } label: {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(workout.name).font(.title3.bold())
                        Text(workout.scheme.capitalized).font(.caption).foregroundStyle(.secondary)
                    }.padding(.vertical, 10)
                }
            }
        }.navigationTitle("Workouts")
    }
}

struct AnnouncementsView: View {
    let detail: CompetitionDetail
    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 18) {
                if detail.announcements.isEmpty { EmptyState(title: "No announcements", message: "Updates from the organizer appear here.", symbol: "megaphone") }
                ForEach(detail.announcements) { announcement in
                    VStack(alignment: .leading, spacing: 12) {
                        if let date = announcement.sentAt { Text(date.formatted(date: .abbreviated, time: .shortened)).font(.caption).foregroundStyle(.secondary) }
                        Text(announcement.title).font(.title3.bold())
                        MarkdownText(text: announcement.body)
                    }.gameDayCard()
                }
            }.padding(20)
        }.background(Color.gameDayPaper).navigationTitle("Announcements").navigationBarTitleDisplayMode(.inline)
    }
}

struct RegistrationView: View {
    let detail: CompetitionDetail
    var body: some View {
        List {
            ForEach(detail.registrations) { registration in
                Section(registration.teamName ?? "Athlete registration") {
                    LabeledContent("Competition", value: detail.competition.name)
                    LabeledContent("Division", value: registration.division ?? "Not assigned")
                    LabeledContent("Status", value: registration.status.capitalized)
                    LabeledContent("Check-in", value: registration.checkedInAt == nil ? "Not checked in" : "Checked in")
                    if let payment = registration.paymentStatus { LabeledContent("Payment", value: payment.replacingOccurrences(of: "_", with: " ").capitalized) }
                    LabeledContent("Registered", value: registration.registeredAt.formatted(date: .abbreviated, time: .omitted))
                    Text(registration.id).font(.caption.monospaced()).textSelection(.enabled).foregroundStyle(.secondary)
                }
            }
            Section { Link("Manage registration on WODsmith", destination: detail.competition.webURL) }
        }.navigationTitle("My registration").navigationBarTitleDisplayMode(.inline)
    }
}

struct LeaderboardView: View {
    @Environment(GameDayStore.self) private var store
    let competitionID: String
    @State private var division: String?
    @State private var search = ""
    private var entries: [LeaderboardEntry] { store.leaderboards[competitionID]?.entries ?? [] }
    private var registrations: [Registration] { store.details[competitionID]?.registrations ?? store.home.registrations }
    private var divisions: [AthleteCompetitionDefaults.Division] {
        AthleteCompetitionDefaults.leaderboardDivisions(entries: entries, registrations: registrations, competitionID: competitionID)
    }
    private var selectedDivision: String? { AthleteCompetitionDefaults.selectedDivisionID(division, divisions: divisions) }
    private var filtered: [LeaderboardEntry] {
        entries.filter { ($0.divisionId == selectedDivision) && (search.isEmpty || $0.name.localizedCaseInsensitiveContains(search)) }
            .sorted { $0.divisionLabel == $1.divisionLabel ? $0.overallRank < $1.overallRank : $0.divisionLabel < $1.divisionLabel }
    }
    var body: some View {
        List {
            if !divisions.isEmpty {
                Section {
                    Picker("Division", selection: Binding(get: { selectedDivision }, set: { division = $0 })) {
                        ForEach(divisions) { Text($0.label).tag(Optional($0.id)) }
                    }
                }
            }
            Section { SyncStatus(resource: .leaderboard(competitionID)) }
            if store.leaderboards[competitionID] == nil {
                if store.status(.leaderboard(competitionID)).error == nil { ProgressView("Loading standings…") }
            } else if entries.isEmpty {
                EmptyState(title: "No published results", message: "Standings appear after the organizer publishes scores.", symbol: "list.number")
            } else if filtered.isEmpty {
                EmptyState(title: search.isEmpty ? "No published results in this division" : "No matching athletes", message: "Try another name or division, or check back after scores are published.", symbol: "magnifyingglass")
                Button("Clear filters") { search = ""; division = nil }
            }
            ForEach(filtered) { entry in
                NavigationLink {
                    List {
                        Section { LabeledContent("Division", value: entry.divisionLabel); LabeledContent("Rank", value: "\(entry.overallRank)"); LabeledContent("Points", value: entry.totalPoints.formatted()) }
                        Section("Event results") {
                            ForEach(entry.eventResults) { result in
                                VStack(alignment: .leading, spacing: 8) {
                                    Text(result.eventName).font(.headline)
                                    HStack { Text(result.formattedScore); Spacer(); Text("Rank \(result.rank)").foregroundStyle(.secondary) }
                                }.padding(.vertical, 4)
                            }
                        }
                    }.navigationTitle(entry.name)
                } label: {
                    HStack(spacing: 14) {
                        Text("\(entry.overallRank)").font(.title2.monospaced().bold()).frame(width: 32).foregroundStyle(entry.overallRank <= 3 ? Color.gameDayOrange : .primary)
                        VStack(alignment: .leading, spacing: 4) {
                            Text(entry.name).font(.headline)
                            Text(entry.divisionLabel).font(.caption).foregroundStyle(.secondary)
                            if AthleteCompetitionDefaults.registrations(registrations, competitionID: competitionID).contains(where: { $0.id == entry.id }) { Text("YOU").font(.caption2.bold()).foregroundStyle(Color.gameDayOrange) }
                        }
                        Spacer()
                        Text(entry.totalPoints.formatted()).font(.headline.monospacedDigit())
                    }.padding(.vertical, 7)
                }
            }
        }.navigationTitle("Leaderboard").searchable(text: $search, prompt: "Athlete or team")
            .task { await store.loadLeaderboard(competitionID) }
            .refreshable { await store.loadLeaderboard(competitionID) }
    }
}
