import XCTest
@testable import GameDay

private final class ResourceURLProtocol: URLProtocol {
    nonisolated(unsafe) static var handler: ((URLRequest) throws -> (Int, Data))?
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        do {
            let (status, data) = try Self.handler!(request)
            let response = HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: nil, headerFields: ["Content-Type": "application/json"])!
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: data)
            client?.urlProtocolDidFinishLoading(self)
        } catch { client?.urlProtocol(self, didFailWithError: error) }
    }
    override func stopLoading() {}
}

@MainActor
final class ResourceStateTests: XCTestCase {
    private func makeStore() -> GameDayStore {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [ResourceURLProtocol.self]
        return GameDayStore(api: GameDayAPI(baseURL: URL(string: "https://fixture.invalid")!, session: URLSession(configuration: configuration)))
    }

    // @lat: [[gameday#Tests#Resource freshness isolation]]
    func testHomeSuccessDoesNotRefreshOrClearAFailedCompetition() async throws {
        let store = makeStore()
        let prior = Date(timeIntervalSince1970: 1_700_000_000)
        let resource = GameDayResource.competition(DemoData.competition.id)
        store.details = [DemoData.competition.id: DemoData.detail]
        store.states[resource] = ResourceStatus(updatedAt: prior)
        ResourceURLProtocol.handler = { request in
            if request.url!.path.hasSuffix("/home") {
                return (200, try GameDayJSON.encoder().encode(HomeResponse.empty))
            }
            throw URLError(.notConnectedToInternet)
        }
        await store.loadCompetition(DemoData.competition.id)
        XCTAssertEqual(store.status(resource).updatedAt, prior)
        XCTAssertNotNil(store.status(resource).error)
        XCTAssertFalse(store.status(resource).isLoading)
        await store.refresh()
        XCTAssertNotNil(store.status(.home).updatedAt)
        XCTAssertEqual(store.status(resource).updatedAt, prior)
        XCTAssertNotNil(store.status(resource).error)
    }

    // @lat: [[gameday#Tests#Contextual retry]]
    func testRetryLoadsTheRequestedPublicCompetitionWithoutReloadingHome() async throws {
        let store = makeStore()
        let resource = GameDayResource.competition(DemoData.competition.id)
        store.states[resource] = ResourceStatus(error: "Previous failure")
        let detail = CompetitionDetail(competition: DemoData.competition, registrations: [], heats: DemoData.heats, assignments: [], workouts: DemoData.detail.workouts, announcements: [])
        ResourceURLProtocol.handler = { request in
            XCTAssertTrue(request.url!.path.hasSuffix("/competitions/demo-summit"))
            return (200, try GameDayJSON.encoder().encode(detail))
        }
        await store.retry(resource)
        XCTAssertNotNil(store.details[DemoData.competition.id])
        XCTAssertNil(store.status(resource).error)
        XCTAssertNotNil(store.status(resource).updatedAt)
        XCTAssertFalse(store.status(resource).isLoading)
    }
    // @lat: [[gameday#Tests#Saved unlisted competitions]]
    func testSavedUnlistedCompetitionLoadsWithoutDiscoveryAndSurvivesCachedRelaunch() async throws {
        let suite = "unlisted-tests-\(UUID())"
        let defaults = try XCTUnwrap(UserDefaults(suiteName: suite))
        defer { defaults.removePersistentDomain(forName: suite) }
        let preferences = SpectatorPreferences(defaults: defaults)
        preferences.setSpectating(DemoData.competition.id, enabled: true)
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [ResourceURLProtocol.self]
        let api = GameDayAPI(baseURL: URL(string: "https://fixture.invalid")!, session: URLSession(configuration: configuration))
        let store = GameDayStore(api: api, spectator: preferences)
        let previousCache = try? Data(contentsOf: store.cacheURL)
        defer {
            if let previousCache { try? previousCache.write(to: store.cacheURL) }
            else { try? FileManager.default.removeItem(at: store.cacheURL) }
        }
        store.home = .empty
        store.details = [:]
        ResourceURLProtocol.handler = { request in
            if request.url!.path.hasSuffix("/home") {
                return (200, try GameDayJSON.encoder().encode(HomeResponse.empty))
            }
            XCTAssertTrue(request.url!.path.hasSuffix("/competitions/demo-summit") || request.url!.path.hasSuffix("/competitions/summit-throwdown"))
            return (200, try GameDayJSON.encoder().encode(DemoData.spectatorDetail))
        }
        await store.loadCompetition(DemoData.competition.slug)
        XCTAssertNotNil(store.details[DemoData.competition.id], "Slug links must cache the canonical ID")
        await store.refresh()
        XCTAssertTrue(store.home.competitions.isEmpty)
        XCTAssertEqual(store.spectatedCompetitions.map(\.id), [DemoData.competition.id])
        let restored = GameDayStore(api: api, spectator: SpectatorPreferences(defaults: defaults))
        XCTAssertEqual(restored.spectatedCompetitions.map(\.id), [DemoData.competition.id])
        restored.home = DemoData.home
        XCTAssertEqual(restored.spectatedCompetitions.count, 1, "Discovery and cache must not duplicate saved events")
        restored.spectator.setSpectating(DemoData.competition.id, enabled: false)
        XCTAssertTrue(restored.spectatedCompetitions.isEmpty)
        preferences.setSpectating(DemoData.competition.id, enabled: true)
        ResourceURLProtocol.handler = { _ in (404, Data("{\"error\":\"Not found\"}".utf8)) }
        await store.loadCompetition(DemoData.competition.id)
        XCTAssertTrue(store.spectatedCompetitions.isEmpty)
        XCTAssertNil(store.details[DemoData.competition.slug], "Revocation removes aliases too")
        XCTAssertNil(GameDayStore(api: api, spectator: preferences).details[DemoData.competition.id])
    }

}
