import SwiftUI

struct FullScheduleView: View {
    @Environment(GameDayStore.self) private var store
    let detail: CompetitionDetail
    @State private var scope: String?
    @State private var divisionIDs: Set<String> = []
    @State private var event = "All events"
    private var isAthlete: Bool { !AthleteCompetitionDefaults.registrations(detail.registrations, competitionID: detail.competition.id).isEmpty }
    private var ids: Set<String> { store.spectator.followedIDs(detail.competition.id) }
    private var selectedScope: String { scope ?? (isAthlete ? "mine" : ids.isEmpty ? "all" : "following") }
    private var divisions: [AthleteCompetitionDefaults.Division] {
        var seen: Set<String> = []
        return (detail.participants ?? []).sorted { ($0.division ?? "") < ($1.division ?? "") }.compactMap {
            guard let id = $0.divisionId, seen.insert(id).inserted else { return nil }
            return .init(id: id, label: $0.division ?? "Division")
        }
    }
    private var filtered: [Heat] {
        let source = selectedScope == "mine" ? detail.myHeats : detail.spectatorHeats(followedIDs: selectedScope == "following" ? ids : nil, divisionIDs: divisionIDs)
        return source.filter { event == "All events" || $0.eventId == event }
    }
    var body: some View {
        List {
            Section {
                Picker("Heats", selection: Binding(get: { selectedScope }, set: { scope = $0 })) {
                    if isAthlete { Text("My heats").tag("mine") }
                    Text("Following").tag("following")
                    Text("All heats").tag("all")
                }
                if selectedScope != "mine" { DivisionFilter(divisions: divisions, selected: $divisionIDs) }
                Picker("Event", selection: $event) { Text("All events").tag("All events"); ForEach(detail.workouts) { Text($0.name).tag($0.id) } }
                NavigationLink("Manage follows") { ParticipantsView(competitionID: detail.competition.id) }
            }
            Section {
                if filtered.isEmpty {
                    EmptyState(title: selectedScope == "following" ? "No published heats for these follows" : "No published heats", message: detail.publicAssignments == nil && selectedScope == "following" ? "Public lane assignments aren’t available yet. Browse all heats or check back later." : "Follow athletes or teams, try another filter, or check back when assignments are published.")
                    Button("Show all heats") { scope = "all"; divisionIDs = []; event = "All events" }
                }
                TimelineView(.periodic(from: .now, by: 30)) { timeline in
                    let upcoming = filtered.filter { ($0.endsAt ?? .distantFuture) > timeline.date }
                    let earlier = filtered.filter { ($0.endsAt ?? .distantFuture) <= timeline.date }
                    ForEach(upcoming) { heat in
                        if selectedScope == "mine" { HeatRow(heat: heat, competition: detail.competition, lane: detail.lane(for: heat)) }
                        else { SpectatorHeatRow(heat: heat, detail: detail) }
                    }
                    if !earlier.isEmpty {
                        DisclosureGroup("Earlier heats") {
                            ForEach(earlier) { heat in
                                if selectedScope == "mine" { HeatRow(heat: heat, competition: detail.competition, lane: detail.lane(for: heat)) }
                                else { SpectatorHeatRow(heat: heat, detail: detail) }
                            }
                        }
                    }
                }
            } footer: { Text("Times shown in \(detail.competition.timezone ?? "America/Denver").").font(.footnote) }
        }.listStyle(.plain).navigationTitle("Full schedule").navigationBarTitleDisplayMode(.inline)
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
    @State private var onlyFollowing = false
    @State private var division: String?
    @State private var search = ""
    private var entries: [LeaderboardEntry] { store.leaderboards[competitionID]?.entries ?? [] }
    private var registrations: [Registration] { store.details[competitionID]?.registrations ?? store.home.registrations }
    private var divisions: [AthleteCompetitionDefaults.Division] {
        let divisions = AthleteCompetitionDefaults.leaderboardDivisions(entries: entries, registrations: registrations, competitionID: competitionID)
        if !AthleteCompetitionDefaults.registrations(registrations, competitionID: competitionID).isEmpty { return divisions }
        let followedDivisions = Set(entries.filter { store.spectator.followedIDs(competitionID).contains($0.id) }.map(\.divisionId))
        return divisions.filter { followedDivisions.contains($0.id) } + divisions.filter { !followedDivisions.contains($0.id) }
    }
    private var selectedDivision: String? { AthleteCompetitionDefaults.selectedDivisionID(division, divisions: divisions) }
    private var filtered: [LeaderboardEntry] {
        entries.filter { ($0.divisionId == selectedDivision) && (!onlyFollowing || store.spectator.followedIDs(competitionID).contains($0.id)) && (search.isEmpty || $0.name.localizedCaseInsensitiveContains(search)) }
            .sorted { $0.divisionLabel == $1.divisionLabel ? $0.overallRank < $1.overallRank : $0.divisionLabel < $1.divisionLabel }
    }
    var body: some View {
        List {
            Section {
                Picker("Participants", selection: $onlyFollowing) {
                    Text("All participants").tag(false)
                    Text("Following").tag(true)
                }.pickerStyle(.segmented)
                NavigationLink("Manage follows") { ParticipantsView(competitionID: competitionID) }
            }
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
                Button("Clear filters") { search = ""; division = nil; onlyFollowing = false }
            }
            ForEach(filtered) { entry in
                NavigationLink {
                    List {
                        Section { LabeledContent("Division", value: entry.divisionLabel); LabeledContent("Rank", value: "\(entry.overallRank)"); LabeledContent("Points", value: entry.totalPoints.formatted()) }
                        Section {
                            Button(store.spectator.followedIDs(competitionID).contains(entry.id) ? "Unfollow" : "Follow") {
                                store.spectator.toggleFollow(entry.id, competitionID: competitionID)
                            }
                        }
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
        }.listStyle(.plain).navigationBarTitleDisplayMode(.inline).navigationTitle("Leaderboard").searchable(text: $search, prompt: "Athlete or team")
            .task { await store.loadLeaderboard(competitionID) }
            .refreshable { await store.loadLeaderboard(competitionID) }
    }
}
