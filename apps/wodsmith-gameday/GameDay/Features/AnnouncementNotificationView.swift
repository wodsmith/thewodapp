import SwiftUI

struct AnnouncementNotificationView: View {
    @Environment(GameDayStore.self) private var store
    let link: AnnouncementLink
    @State private var announcement: Announcement?
    @State private var error: String?
    @State private var loading = false
    @State private var signIn = false
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                if !store.isSignedIn {
                    Text("Sign in to read this announcement.")
                    Button("Sign in") { signIn = true }
                } else if loading { ProgressView("Loading announcement…") }
                else if let announcement {
                    Text(announcement.title).font(.title2.bold())
                    if let date = announcement.sentAt { Text(date.formatted()).font(.caption).foregroundStyle(.secondary) }
                    MarkdownText(text: announcement.body)
                } else if let error {
                    Text(error)
                    Button("Try again") { Task { await load() } }
                }
            }.frame(maxWidth: .infinity, alignment: .leading).padding(20)
        }.navigationTitle("Announcement").navigationBarTitleDisplayMode(.inline)
            .sheet(isPresented: $signIn) { NavigationStack { SignInView() } }
            .task(id: store.token) { await load() }
            .onChange(of: store.isSignedIn) { _, signedIn in if signedIn { signIn = false } else { announcement = nil } }
    }
    private func load() async {
        announcement = nil
        guard store.isSignedIn else { return }
        loading = true
        error = nil
        let token = store.token
        defer { if token == store.token { loading = false } }
        do {
            let detail: CompetitionDetail
            if store.isDemo { detail = DemoData.detail }
            else { detail = try await store.api.request("api/gameday/v1/competitions/\(link.competitionID)", token: token) }
            guard token == store.token, !Task.isCancelled else { return }
            announcement = detail.announcements.first { $0.id == link.announcementID }
            if announcement == nil { error = "This announcement is unavailable for your account." }
        } catch let apiError as APIError where apiError.status == 401 {
            if token == store.token { await store.signOut(preserveAnnouncement: true) }
        } catch {
            guard token == store.token, !Task.isCancelled else { return }
            self.error = "Couldn’t load this announcement. Check your connection and try again."
        }
    }
}

struct AnnouncementSettingsView: View {
    @Environment(GameDayStore.self) private var store
    var body: some View {
        Form {
            Section {
                Toggle("Organizer announcement alerts", isOn: Binding(get: { store.push.enabled }, set: { value in
                    Task { await store.push.setEnabled(value) }
                })).disabled(!store.isSignedIn || store.isDemo)
                Text(store.push.status).font(.footnote).foregroundStyle(.secondary)
            } footer: {
                Text("Receive updates sent to your registered athlete account. You must be signed in, enable alerts here, and allow iPhone notifications. Focus, connectivity, and notification settings may affect delivery.")
            }
            Section {
                Link("Open iPhone notification settings", destination: URL(string: UIApplication.openNotificationSettingsURLString)!)
                Text("Heat reminders are configured separately. Signing out turns announcement alerts off; reopen Game Day online to finish any pending notification cleanup.").font(.footnote).foregroundStyle(.secondary)
            }
        }.navigationTitle("Announcement alerts")
            .task { if !store.isDemo { await store.push.refreshPermission() } }
    }
}
