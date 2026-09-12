import SwiftUI

struct AppShell: View {
    @Environment(GameDayStore.self) private var store
    @Environment(\.scenePhase) private var scenePhase
    @State private var tab = 0
    @State private var linkedCompetition: String?
    var body: some View {
        @Bindable var store = store
        TabView(selection: $tab) {
            Tab("Competitions", systemImage: "flag.checkered", value: 0) { NavigationStack { CompetitionHome() } }
            Tab("My day", systemImage: "timer", value: 1) { NavigationStack { MyDayView() } }
            Tab("Profile", systemImage: "person.crop.circle", value: 2) { NavigationStack { ProfileView() } }
        }
        .sheet(isPresented: $store.showSignIn) { NavigationStack { SignInView() } }
        .sheet(item: Binding(get: { linkedCompetition.map(CompetitionLink.init) }, set: { linkedCompetition = $0?.id })) { link in
            NavigationStack { CompetitionView(competitionID: link.id).toolbar { ToolbarItem(placement: .cancellationAction) { Button("Done") { linkedCompetition = nil } } } }
        }
        .onChange(of: store.selectedCompetitionID) { _, id in linkedCompetition = id; store.selectedCompetitionID = nil }
        .alert("Game Day", isPresented: Binding(get: { store.error != nil }, set: { if !$0 { store.error = nil } })) {
            Button("OK") { store.error = nil }
        } message: { Text(store.error ?? "") }
        .task { await store.refresh() }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { Task { await store.refresh() } }
        }
    }
    private struct CompetitionLink: Identifiable { let id: String }
}

struct SyncStatus: View {
    @Environment(GameDayStore.self) private var store
    var resource: GameDayResource = .home
    private var state: ResourceStatus { store.status(resource) }
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            if let error = state.error {
                Label(error, systemImage: "wifi.exclamationmark").font(.subheadline)
                if state.updatedAt != nil { Text("Showing downloaded information. Schedule changes may be missing.").font(.footnote).foregroundStyle(.secondary) }
                Button("Try again") { Task { await store.retry(resource) } }
                    .frame(minHeight: 44).font(.subheadline.weight(.semibold))
            }
            if let date = state.updatedAt {
                Text("Updated \(date.formatted(date: .abbreviated, time: .shortened))")
                    .font(.footnote).foregroundStyle(Color.gameDaySecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .accessibilityElement(children: .contain)
        .onChange(of: state.error) { _, error in
            if let error { UIAccessibility.post(notification: .announcement, argument: error) }
        }
    }
}

struct CompetitionHome: View {
    @Environment(GameDayStore.self) private var store
    @State private var search = ""
    @State private var includePast = false
    private var competitions: [Competition] {
        return store.home.competitions.filter {
            (includePast || !$0.hasEnded()) && (search.isEmpty || "\($0.name) \($0.location)".localizedCaseInsensitiveContains(search))
        }.sorted { $0.startDate < $1.startDate }
    }
    var body: some View {
        List {
            if store.status(.home).error != nil { Section { SyncStatus() } }
            if store.isSignedIn && search.isEmpty {
                Section {
                    if store.home.myCompetitions.isEmpty {
                        Text("No registrations on this account. Sign in with the email you used to register.").foregroundStyle(.secondary)
                    }
                    ForEach(store.home.myCompetitions) { competition in
                        NavigationLink { CompetitionView(competitionID: competition.id) } label: {
                            CompetitionCard(competition: competition, registered: true)
                        }
                    }
                } header: { Text("Your competitions").foregroundStyle(Color.gameDaySecondary) }
            }
            if search.isEmpty && !store.spectator.competitionIDs.isEmpty {
                Section("Spectating") {
                    ForEach(store.spectatedCompetitions) { competition in
                        NavigationLink { CompetitionView(competitionID: competition.id) } label: {
                            CompetitionCard(competition: competition)
                        }
                    }
                }
            }
            Section {
                if store.status(.home).isLoading && store.home.competitions.isEmpty {
                    ProgressView("Loading competitions…")
                } else if competitions.isEmpty && store.status(.home).error == nil {
                    EmptyState(title: search.isEmpty ? "No upcoming competitions" : "No matches", message: "Try another search or include past competitions.", symbol: "magnifyingglass")
                }
                ForEach(competitions.filter { !search.isEmpty || !store.spectator.competitionIDs.contains($0.id) }) { competition in
                    NavigationLink { CompetitionView(competitionID: competition.id) } label: { CompetitionCard(competition: competition) }
                }
            } header: { Text(store.isSignedIn ? "More competitions" : "Upcoming competitions").foregroundStyle(Color.gameDaySecondary) }
            if store.status(.home).error == nil { Section { SyncStatus() }.listRowBackground(Color.clear) }
        }
        .listStyle(.plain)
        .navigationTitle("Competitions")
        .accessibilityIdentifier("homeHeading")
        .searchable(text: $search, prompt: "Search")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu { Toggle("Include past competitions", isOn: $includePast) } label: {
                    Image(systemName: "line.3.horizontal.decrease").frame(minWidth: 44, minHeight: 44)
                }.accessibilityLabel("Competition filters")
            }
        }
        .refreshable { await store.refresh() }
    }
}

struct MyDayView: View {
    @Environment(GameDayStore.self) private var store
    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 16) {
                if !store.isSignedIn {
                    if store.spectator.competitionIDs.isEmpty {
                        EmptyState(title: "Your spectator day", message: "Open a competition and tap Spectate, then follow athletes or teams to build your day. No account needed.", symbol: "star")
                    }
                    ForEach(store.spectatedCompetitions) { competition in
                        NavigationLink(competition.name) { CompetitionView(competitionID: competition.id) }.font(.headline).frame(minHeight: 44)
                        if let detail = store.details[competition.id] { SpectatorSummary(detail: detail) }
                        SyncStatus(resource: .competition(competition.id))
                            .task { if store.details[competition.id] == nil { await store.loadCompetition(competition.id) } }
                    }
                } else {
                    if store.home.myCompetitions.isEmpty {
                        EmptyState(title: "No registered competitions", message: "Use Competitions to browse events, or check that you signed in with your registration email.")
                    }
                    ForEach(store.home.myCompetitions) { competition in
                        VStack(alignment: .leading, spacing: 12) {
                            NavigationLink { CompetitionView(competitionID: competition.id) } label: {
                                HStack { Text(competition.name).font(.headline); Spacer(); Image(systemName: "chevron.right").font(.subheadline).foregroundStyle(.secondary) }.frame(minHeight: 44)
                            }.buttonStyle(.plain)
                            SyncStatus(resource: .competition(competition.id))
                            if let detail = store.details[competition.id] { AthleteSchedule(detail: detail) }
                            else if store.status(.competition(competition.id)).error == nil {
                                ProgressView("Loading your schedule…").task { await store.loadCompetition(competition.id) }
                            }
                        }
                    }
                }
            }.padding(16)
        }.background(Color(uiColor: .systemBackground)).navigationTitle("My day")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    NavigationLink { ReminderSettingsView() } label: {
                        Image(systemName: "bell").frame(minWidth: 44, minHeight: 44)
                    }.accessibilityLabel("Heat reminders")
                }
            }
            .refreshable { await store.refresh() }
    }
}
