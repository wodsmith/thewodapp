import XCTest
@testable import GameDay

private final class PushURLProtocol: URLProtocol, @unchecked Sendable {
    nonisolated(unsafe) static var handler: (@MainActor (PushURLProtocol) -> Void)?
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() { Task { @MainActor in Self.handler?(self) } }
    override func stopLoading() {}
    func complete(status: Int = 200) {
        client?.urlProtocol(self, didReceive: HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: nil, headerFields: nil)!, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: Data("{\"registered\":true}".utf8))
        client?.urlProtocolDidFinishLoading(self)
    }
    func offline() { client?.urlProtocol(self, didFailWithError: URLError(.notConnectedToInternet)) }
}

@MainActor
final class AnnouncementPushTests: XCTestCase {
    private let token = Data(repeating: 0xab, count: 32)
    private func api() -> GameDayAPI {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [PushURLProtocol.self]
        return GameDayAPI(baseURL: URL(string: "https://fixture.invalid")!, session: URLSession(configuration: config))
    }
    override func tearDown() {
        PushURLProtocol.handler = nil
        UserDefaults.standard.removeObject(forKey: "announcementPushEnabled")
        super.tearDown()
    }
    // @lat: [[gameday-push#Tests#Native registration ordering]]
    func testSignOutWaitsForPendingRegistrationThenRevokesIt() async {
        var saved: PushSubscription?
        let manager = AnnouncementPushManager(api: api(), subscription: nil, save: { saved = $0 })
        manager.enabled = true
        manager.updateSession("athlete:session")
        await manager.synchronize(allowed: true)
        let started = expectation(description: "Registration in flight")
        var suspended: PushURLProtocol?
        var methods: [String] = []
        PushURLProtocol.handler = { request in
            methods.append(request.request.httpMethod!)
            if request.request.httpMethod == "PUT" { suspended = request; started.fulfill() }
            else { request.complete() }
        }
        let register = Task { await manager.receivedToken(token) }
        await fulfillment(of: [started], timeout: 3)
        XCTAssertNotNil(saved, "Persist before the request so a lost response remains revocable")
        manager.updateSession(nil)
        let clearing = Task { await manager.signOut() }
        await Task.yield()
        suspended?.complete()
        await register.value
        await clearing.value
        XCTAssertEqual(methods, ["PUT", "DELETE"])
        XCTAssertNil(saved)
        XCTAssertFalse(manager.enabled)
    }
    // @lat: [[gameday-push#Tests#Independent home refresh]]
    func testHomeRefreshDoesNotWaitForPushCleanup() async {
        let client = api()
        let old = PushSubscription(credential: "old:session", token: String(repeating: "ab", count: 32), environment: "sandbox", subscriptionId: UUID().uuidString)
        let manager = AnnouncementPushManager(api: client, subscription: old, save: { _ in })
        let store = GameDayStore(api: client, push: manager)
        store.push.enabled = false
        let homeRequested = expectation(description: "Home requested while cleanup is suspended")
        let cleanupRequested = expectation(description: "Cleanup requested")
        let refreshCompleted = expectation(description: "Home refresh completed before cleanup")
        var cleanup: PushURLProtocol?
        PushURLProtocol.handler = { request in
            if request.request.url?.path == "/api/gameday/v1/devices" {
                cleanup = request
                cleanupRequested.fulfill()
            } else {
                homeRequested.fulfill()
                request.offline()
            }
        }
        let refresh = Task { await store.refresh(); refreshCompleted.fulfill() }
        await fulfillment(of: [homeRequested, cleanupRequested, refreshCompleted], timeout: 3)
        cleanup?.complete()
        await refresh.value
        await store.push.synchronize(allowed: false)
    }
    // @lat: [[gameday-push#Tests#Offline revocation recovery]]
    func testOfflineSignOutRetainsCleanupForRelaunchAndDoesNotRestoreLogin() async {
        let original = PushSubscription(credential: "old:session", token: String(repeating: "ab", count: 32), environment: "sandbox", subscriptionId: UUID().uuidString)
        var saved: PushSubscription? = original
        let manager = AnnouncementPushManager(api: api(), subscription: original, save: { saved = $0 })
        PushURLProtocol.handler = { $0.offline() }
        await manager.signOut()
        XCTAssertEqual(saved, original)
        let relaunched = AnnouncementPushManager(api: api(), subscription: saved, save: { saved = $0 })
        var methods: [String] = []
        PushURLProtocol.handler = { request in methods.append(request.request.httpMethod!); request.complete() }
        await relaunched.synchronize(allowed: false)
        XCTAssertNil(saved)
        XCTAssertEqual(methods, ["DELETE"])
        XCTAssertFalse(relaunched.enabled)
    }
    func testAccountChangeRevokesOldBindingBeforeRegisteringNewOwner() async {
        let old = PushSubscription(credential: "old:session", token: String(repeating: "ab", count: 32), environment: "sandbox", subscriptionId: UUID().uuidString)
        var saved: PushSubscription? = old
        var calls: [(String, String)] = []
        let manager = AnnouncementPushManager(api: api(), subscription: old, save: { saved = $0 })
        manager.enabled = true
        manager.updateSession("new:session")
        PushURLProtocol.handler = { request in
            calls.append((request.request.httpMethod!, request.request.value(forHTTPHeaderField: "Authorization")!))
            request.complete()
        }
        await manager.synchronize(allowed: true)
        await manager.receivedToken(token)
        XCTAssertEqual(calls.map(\.0), ["DELETE", "PUT"])
        XCTAssertEqual(calls.map(\.1), ["Bearer old:session", "Bearer new:session"])
        XCTAssertNotEqual(saved?.subscriptionId, old.subscriptionId)
    }
    func testRevokedPermissionCannotBeUndoneByALateAppleTokenCallback() async {
        var saved: PushSubscription?
        let manager = AnnouncementPushManager(api: api(), subscription: nil, save: { saved = $0 })
        manager.enabled = true
        manager.updateSession("athlete:session")
        var methods: [String] = []
        PushURLProtocol.handler = { request in methods.append(request.request.httpMethod!); request.complete() }
        await manager.synchronize(allowed: true)
        await manager.receivedToken(token)
        await manager.synchronize(allowed: false)
        await manager.receivedToken(token)
        XCTAssertEqual(methods, ["PUT", "DELETE"])
        XCTAssertNil(saved)
    }
    func testSessionExpiryRetainsDestinationButExplicitSignOutClearsIt() async {
        let store = GameDayStore(api: api(), demo: true)
        let link = AnnouncementLink(payload: ["competitionID": "competition", "announcementID": "announcement"])
        AnnouncementRouter.shared.pending = link
        await store.signOut(preserveAnnouncement: true)
        XCTAssertEqual(AnnouncementRouter.shared.pending, link)
        XCTAssertFalse(store.isSignedIn)
        await store.signOut()
        XCTAssertNil(AnnouncementRouter.shared.pending)
    }
    // @lat: [[gameday-push#Tests#Native announcement routing]]
    func testNotificationLinkIsRetainedForColdLaunchAndRejectsMalformedPayloads() {
        let link = AnnouncementLink(payload: ["competitionID": "competition", "announcementID": "announcement"])
        XCTAssertNotNil(link)
        AnnouncementRouter.shared.pending = link
        XCTAssertEqual(AnnouncementRouter.shared.pending?.announcementID, "announcement")
        AnnouncementRouter.shared.pending = nil
        XCTAssertNil(AnnouncementLink(payload: ["competitionID": "competition"]))
        XCTAssertNil(AnnouncementLink(payload: ["competitionID": "../private", "announcementID": "announcement"]))
        XCTAssertNil(AnnouncementLink(payload: ["competitionID": 7, "announcementID": "announcement"]))
    }
}
