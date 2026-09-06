import Foundation
import Observation

struct ResourceStatus {
    var updatedAt: Date?
    var isLoading = false
    var error: String?
}

enum GameDayResource: Hashable {
    case home, competition(String), leaderboard(String)
}

@Observable @MainActor
final class GameDayStore {
    var home = HomeResponse.empty
    var details: [String: CompetitionDetail] = [:]
    var leaderboards: [String: LeaderboardResponse] = [:]
    var states: [GameDayResource: ResourceStatus] = [:]
    var error: String?
    var showSignIn = false
    var selectedCompetitionID: String?
    private(set) var token: String?
    private var generation = UUID()
    let api: GameDayAPI
    let reminders = HeatReminderManager()
    let activities = HeatActivityManager()
    let isDemo: Bool

    var isSignedIn: Bool { token != nil || (isDemo && home.profile != nil) }
    var cacheURL: URL { URL.cachesDirectory.appendingPathComponent("gameday-v1.json") }
    func status(_ resource: GameDayResource) -> ResourceStatus { states[resource] ?? ResourceStatus() }

    init(api: GameDayAPI = GameDayAPI(), demo: Bool = false) {
        self.api = api
        self.isDemo = demo
        if demo {
            home = DemoData.home
            details = [DemoData.competition.id: DemoData.detail]
            leaderboards = [DemoData.competition.id: DemoData.leaderboard]
            for resource in [GameDayResource.home, .competition(DemoData.competition.id), .leaderboard(DemoData.competition.id)] {
                states[resource] = ResourceStatus(updatedAt: .now)
            }
        } else {
            token = SessionKeychain.read()
            restoreCache()
        }
    }

    func signIn(email: String, password: String) async throws {
        struct Credential: Decodable { let token: String; let userId: String }
        let credential: Credential = try await api.request("api/auth/token", method: "POST", body: ["email": email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(), "password": password])
        try SessionKeychain.save(credential.token)
        generation = UUID()
        token = credential.token
        home = .empty
        details = [:]
        leaderboards = [:]
        states = [:]
        try? FileManager.default.removeItem(at: cacheURL)
        showSignIn = false
        await refresh()
    }

    func signOut() async {
        let previousToken = token
        generation = UUID()
        token = nil
        SessionKeychain.clear()
        home = .empty
        details = [:]
        leaderboards = [:]
        states = [:]
        selectedCompetitionID = nil
        try? FileManager.default.removeItem(at: cacheURL)
        await reminders.clear()
        await activities.end()
        if let previousToken, !isDemo {
            struct Revocation: Decodable { let signedOut: Bool }
            // Device access is cleared even offline. Revoke only this device's server session.
            let _: Revocation? = try? await api.request("api/gameday/v1/session", token: previousToken, method: "DELETE")
        }
        if !isDemo { await refresh() }
    }

    func refresh() async {
        guard !isDemo, !status(.home).isLoading else { return }
        let current = generation
        states[.home, default: ResourceStatus()].isLoading = true
        do {
            let result: HomeResponse = try await api.request("api/gameday/v1/home", token: token)
            guard current == generation else { return }
            home = result
            states[.home] = ResourceStatus(updatedAt: .now)
            let registeredIDs = Set(result.myCompetitions.map(\.id))
            details = details.filter { $0.value.registrations.isEmpty || registeredIDs.contains($0.key) }
            await syncReminders()
            await activities.reconcile(details: Array(details.values))
            // Past competitions remain browsable; only upcoming registrations need proactive downloads.
            let today = String(ISO8601DateFormatter().string(from: .now.addingTimeInterval(-86400)).prefix(10))
            for competition in result.myCompetitions where competition.endDate >= today {
                await loadCompetition(competition.id)
                guard current == generation else { return }
            }
            saveCache()
        } catch { await handle(error, resource: .home, generation: current) }
    }

    func loadCompetition(_ id: String) async {
        let resource = GameDayResource.competition(id)
        guard !isDemo, !status(resource).isLoading else { return }
        let current = generation
        states[resource, default: ResourceStatus()].isLoading = true
        do {
            let detail: CompetitionDetail = try await api.request("api/gameday/v1/competitions/\(id)", token: token)
            guard current == generation else { return }
            details[id] = detail
            states[resource] = ResourceStatus(updatedAt: .now)
            saveCache()
            await syncReminders()
            await activities.reconcile(details: Array(details.values))
        } catch { await handle(error, resource: resource, generation: current) }
    }

    func loadLeaderboard(_ id: String) async {
        let resource = GameDayResource.leaderboard(id)
        guard !isDemo, !status(resource).isLoading else { return }
        let current = generation
        states[resource, default: ResourceStatus()].isLoading = true
        do {
            let board: LeaderboardResponse = try await api.request("api/gameday/v1/competitions/\(id)/leaderboard", token: token)
            guard current == generation else { return }
            leaderboards[id] = board
            states[resource] = ResourceStatus(updatedAt: .now)
        } catch { await handle(error, resource: resource, generation: current) }
    }

    func retry(_ resource: GameDayResource) async {
        switch resource {
        case .home: await refresh()
        case .competition(let id): await loadCompetition(id)
        case .leaderboard(let id): await loadLeaderboard(id)
        }
    }

    func updateProfile(firstName: String, lastName: String) async throws {
        struct Result: Decodable { let profile: AthleteProfile }
        let current = generation
        let result: Result = try await api.request("api/gameday/v1/profile", token: token, method: "PATCH", body: ["firstName": firstName, "lastName": lastName])
        guard current == generation else { return }
        home = HomeResponse(competitions: home.competitions, registrations: home.registrations, profile: result.profile)
        saveCache()
    }

    func syncReminders() async {
        do { try await reminders.reconcile(details: isSignedIn ? Array(details.values) : []) }
        catch { self.error = "Heat reminders couldn’t be updated: \(error.localizedDescription)" }
    }

    private func handle(_ error: Error, resource: GameDayResource, generation current: UUID) async {
        guard current == generation else { return }
        states[resource, default: ResourceStatus()].isLoading = false
        if (error as? APIError)?.status == 401 {
            await signOut()
            self.error = "Your session expired. Sign in again to see your heats."
        } else if !(error is CancellationError), (error as? URLError)?.code != .cancelled {
            let message: String
            if let apiError = error as? APIError { message = apiError.message }
            else if error is DecodingError { message = "This information couldn’t be read. Try again, or contact support if it continues." }
            else { message = "Couldn’t connect to WODsmith. Check your connection and try again." }
            states[resource, default: ResourceStatus()].error = message
        }
    }

    struct Cache: Codable {
        let userId: String?
        let home: HomeResponse
        let details: [String: CompetitionDetail]
        let homeUpdatedAt: Date?
        let detailUpdatedAt: [String: Date]?
    }
    private var userId: String? { token?.split(separator: ":", maxSplits: 1).first.map(String.init) }
    private func saveCache() {
        let timestamps = details.keys.reduce(into: [String: Date]()) { result, id in result[id] = status(.competition(id)).updatedAt }
        guard let data = try? GameDayJSON.encoder().encode(Cache(userId: userId, home: home, details: details, homeUpdatedAt: status(.home).updatedAt, detailUpdatedAt: timestamps)) else { return }
        try? data.write(to: cacheURL, options: [.atomic, .completeFileProtectionUnlessOpen])
    }
    private func restoreCache() {
        guard let data = try? Data(contentsOf: cacheURL), let cache = try? GameDayJSON.decoder().decode(Cache.self, from: data), cache.userId == userId else { return }
        home = cache.home
        details = cache.details
        states[.home] = ResourceStatus(updatedAt: cache.homeUpdatedAt)
        for (id, date) in cache.detailUpdatedAt ?? [:] { states[.competition(id)] = ResourceStatus(updatedAt: date) }
    }
}
