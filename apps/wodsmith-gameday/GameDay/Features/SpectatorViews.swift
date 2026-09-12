import SwiftUI

struct SpectatorSummary: View {
    @Environment(GameDayStore.self) private var store
    let detail: CompetitionDetail
    private var ids: Set<String> { store.spectator.followedIDs(detail.competition.id) }
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            NavigationLink { ParticipantsView(competitionID: detail.competition.id) } label: {
                HStack {
                    Label("Following · \(ids.count)", systemImage: "star")
                    Spacer()
                    Text("Manage").font(.subheadline)
                    Image(systemName: "chevron.right").font(.caption)
                }.frame(minHeight: 44)
            }.buttonStyle(.plain)
            if ids.isEmpty {
                Text("Follow athletes or teams to see their next heats here. Saved on this device; no account needed.")
                    .font(.subheadline).foregroundStyle(.secondary)
            } else if detail.publicAssignments == nil {
                Text("Followed heat assignments aren’t available yet. You can still browse the published schedule.")
                    .font(.subheadline).foregroundStyle(.secondary)
            } else {
                TimelineView(.periodic(from: .now, by: 30)) { timeline in
                    let heats = detail.spectatorHeats(followedIDs: ids).filter { ($0.endsAt ?? .distantFuture) > timeline.date }
                    if let heat = heats.first {
                        Text("Next for your follows").font(.subheadline.weight(.semibold)).frame(maxWidth: .infinity, alignment: .leading).accessibilityAddTraits(.isHeader)
                        SpectatorHeatRow(heat: heat, detail: detail)
                    } else {
                        Text("No upcoming published heats for your follows. Check the full schedule for earlier heats.")
                            .font(.subheadline).foregroundStyle(.secondary)
                    }
                }
            }
        }
    }
}

struct SpectatorHeatRow: View {
    @Environment(GameDayStore.self) private var store
    let heat: Heat
    let detail: CompetitionDetail
    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            HeatRow(heat: heat, competition: detail.competition, lane: detail.lane(for: heat))
            ForEach(detail.followedLaneLabels(for: heat, ids: store.spectator.followedIDs(detail.competition.id)), id: \.self) { label in
                Text(label).font(.subheadline).foregroundStyle(.secondary)
            }
        }
    }
}

struct ParticipantsView: View {
    @Environment(GameDayStore.self) private var store
    let competitionID: String
    @State private var search = ""
    @State private var onlyFollowing = false
    @State private var divisionIDs: Set<String> = []
    private var ids: Set<String> { store.spectator.followedIDs(competitionID) }
    private var detail: CompetitionDetail? {
        store.details[competitionID] ?? store.details.values.first { $0.competition.id == competitionID }
    }
    private var participants: [PublicParticipant] {
        if let participants = detail?.participants { return participants }
        return (store.leaderboards[competitionID]?.entries ?? []).map {
            PublicParticipant(id: $0.id, name: $0.name, divisionId: $0.divisionId, division: $0.divisionLabel, isTeam: $0.teamName != nil)
        }
    }
    private var divisions: [AthleteCompetitionDefaults.Division] {
        var seen: Set<String> = []
        return participants.sorted { ($0.division ?? "") < ($1.division ?? "") }.compactMap {
            guard let id = $0.divisionId, seen.insert(id).inserted else { return nil }
            return .init(id: id, label: $0.division ?? "Division")
        }
    }
    private var filtered: [PublicParticipant] {
        participants.filter {
            (!onlyFollowing || ids.contains($0.id)) &&
            (divisionIDs.isEmpty || $0.divisionId.map { divisionIDs.contains($0) } == true) &&
            (search.isEmpty || $0.name.localizedCaseInsensitiveContains(search))
        }.sorted { $0.name.localizedStandardCompare($1.name) == .orderedAscending }
    }
    var body: some View {
        List {
            Section {
                Picker("Participants", selection: $onlyFollowing) {
                    Text("All participants").tag(false)
                    Text("Following").tag(true)
                }.pickerStyle(.segmented)
                DivisionFilter(divisions: divisions, selected: $divisionIDs)
            } footer: { Text("Follows are saved on this device.").font(.footnote) }
            if let detail, detail.participants == nil {
                Text("Showing participants with published results. The full participant list will appear when available.").font(.footnote).foregroundStyle(.secondary)
            }
            if filtered.isEmpty {
                EmptyState(title: onlyFollowing ? "No follows in this view" : "No participants in this view", message: "Try all participants, clear division filters, or check back when the organizer publishes participants.")
                Button("Show all participants") { onlyFollowing = false; divisionIDs = []; search = "" }
            }
            ForEach(filtered) { participant in
                HStack(spacing: 12) {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(participant.name).font(.headline)
                        Text([participant.isTeam ? "Team" : "Athlete", participant.division].compactMap { $0 }.joined(separator: " · "))
                            .font(.caption).foregroundStyle(.secondary)
                    }
                    Spacer()
                    Button { store.spectator.toggleFollow(participant.id, competitionID: competitionID) } label: {
                        Image(systemName: ids.contains(participant.id) ? "star.fill" : "star").frame(minWidth: 44, minHeight: 44)
                    }.buttonStyle(.borderless)
                        .accessibilityLabel("\(ids.contains(participant.id) ? "Unfollow" : "Follow") \(participant.name)")
                }
            }
            SyncStatus(resource: .competition(competitionID))
            if detail?.participants == nil {
                SyncStatus(resource: .leaderboard(competitionID))
            }
        }.listStyle(.plain).navigationTitle("Athletes & teams").navigationBarTitleDisplayMode(.inline)
            .searchable(text: $search, prompt: "Athlete or team")
            .task {
                if detail == nil { await store.loadCompetition(competitionID) }
                if detail?.participants == nil { await store.loadLeaderboard(competitionID) }
            }
            .refreshable {
                await store.loadCompetition(competitionID)
                if detail?.participants == nil { await store.loadLeaderboard(competitionID) }
            }
    }
}

struct DivisionFilter: View {
    let divisions: [AthleteCompetitionDefaults.Division]
    @Binding var selected: Set<String>
    var body: some View {
        if !divisions.isEmpty {
            Menu {
                Button("All divisions") { selected = [] }
                ForEach(divisions) { division in
                    Toggle(division.label, isOn: Binding(get: { selected.contains(division.id) }, set: { enabled in
                        if enabled { selected.insert(division.id) } else { selected.remove(division.id) }
                    }))
                }
            } label: {
                HStack {
                    Text("Divisions")
                    Spacer()
                    Text(selected.isEmpty ? "All" : "\(selected.count) selected").foregroundStyle(.secondary)
                    Image(systemName: "line.3.horizontal.decrease")
                }.frame(minHeight: 44)
            }.accessibilityLabel("Filter divisions")
        }
    }
}
