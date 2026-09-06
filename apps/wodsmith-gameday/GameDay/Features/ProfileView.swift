import SwiftUI

struct SignInView: View {
    @Environment(GameDayStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var email = ""
    @State private var password = ""
    @State private var isSubmitting = false
    @State private var error: String?
    var body: some View {
        Form {
            Section {
                VStack(alignment: .leading, spacing: 12) {
                    Image("BrandMark").resizable().scaledToFit().frame(width: 44, height: 44).accessibilityHidden(true)
                    Text("Sign in to WODsmith").font(.title2.bold())
                    Text("Sign in with the WODsmith account you used to register.").foregroundStyle(.secondary)
                }.padding(.vertical, 16).listRowBackground(Color.clear)
            }
            Section("WODsmith account") {
                TextField("Email", text: $email).textContentType(.username).keyboardType(.emailAddress).textInputAutocapitalization(.never).autocorrectionDisabled().accessibilityIdentifier("emailField")
                SecureField("Password", text: $password).textContentType(.password).accessibilityIdentifier("passwordField")
            }
            if let error { Section { Text(error).foregroundStyle(.red).font(.subheadline) } }
            Section {
                Button {
                    isSubmitting = true
                    error = nil
                    Task {
                        defer { isSubmitting = false }
                        do { try await store.signIn(email: email, password: password); password = "" }
                        catch { self.error = error.localizedDescription }
                    }
                } label: { HStack { Spacer(); if isSubmitting { ProgressView("Signing in…") } else { Text("Sign in").bold() }; Spacer() } }
                    .disabled(isSubmitting || email.isEmpty || password.isEmpty).accessibilityIdentifier("submitSignIn")
                Link("Forgot your password?", destination: URL(string: "https://wodsmith.com/forgot-password")!)
            }
            Section { Text("Just watching? You can explore competitions, schedules, workouts, and leaderboards without an account.").font(.footnote).foregroundStyle(.secondary) }
        }.onChange(of: error) { _, value in if let value { UIAccessibility.post(notification: .announcement, argument: value) } }
        .navigationTitle("Athlete sign-in").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } } }
    }
}

struct ProfileView: View {
    @Environment(GameDayStore.self) private var store
    @State private var confirmSignOut = false
    var body: some View {
        List {
            Section {
                HStack(spacing: 16) {
                    Image(systemName: "person.crop.circle").font(.largeTitle).foregroundStyle(.secondary).accessibilityHidden(true)
                    VStack(alignment: .leading, spacing: 5) {
                        Text(store.home.profile?.name ?? "Spectator").font(.title3.bold())
                        Text(store.home.profile?.email ?? "Browse competitions without an account.").font(.subheadline).foregroundStyle(.secondary)
                    }
                }.padding(.vertical, 12)
                if store.isSignedIn { NavigationLink("Edit profile") { EditProfileView() } }
                else { Button("Sign in as an athlete") { store.showSignIn = true } }
            }
            Section("Your game day") {
                NavigationLink { ReminderSettingsView() } label: { Label("Heat reminders", systemImage: "bell.badge") }
                if store.activities.activeHeatID != nil {
                    Button("End Lock Screen countdown") { Task { await store.activities.end() } }
                }
            }
            Section("Help") {
                NavigationLink { LegalView(kind: .support) } label: { Label("Support", systemImage: "questionmark.circle") }
                NavigationLink { LegalView(kind: .privacy) } label: { Label("Privacy policy", systemImage: "hand.raised") }
                Link("Terms of service", destination: URL(string: "https://wodsmith.com/terms")!)
            }
            if store.isSignedIn {
                Section { Button("Sign out", role: .destructive) { confirmSignOut = true } }
            }
            Section { Text("WODsmith Game Day · 1.0").font(.caption).foregroundStyle(.secondary).frame(maxWidth: .infinity).multilineTextAlignment(.center) }
        }.navigationTitle("Profile")
            .confirmationDialog("Sign out? Downloaded athlete data and heat reminders will be cleared from this iPhone.", isPresented: $confirmSignOut, titleVisibility: .visible) {
                Button("Sign out", role: .destructive) { Task { await store.signOut() } }
            }
    }
}

struct EditProfileView: View {
    @Environment(GameDayStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var first = ""
    @State private var last = ""
    @State private var error: String?
    @State private var saving = false
    var body: some View {
        Form {
            TextField("First name", text: $first).textContentType(.givenName)
            TextField("Last name", text: $last).textContentType(.familyName)
            if let error { Text(error).foregroundStyle(.red) }
            Button(saving ? "Saving…" : "Save changes") {
                saving = true
                Task {
                    defer { saving = false }
                    do { try await store.updateProfile(firstName: first, lastName: last); dismiss() }
                    catch { self.error = error.localizedDescription }
                }
            }.disabled(saving || first.trimmingCharacters(in: .whitespaces).count < 2 || last.trimmingCharacters(in: .whitespaces).count < 2 || store.isDemo)
        }.navigationTitle("Edit profile")
            .onAppear { first = store.home.profile?.firstName ?? ""; last = store.home.profile?.lastName ?? "" }
    }
}

struct ReminderSettingsView: View {
    @Environment(GameDayStore.self) private var store
    @State private var error: String?
    var body: some View {
        @Bindable var reminders = store.reminders
        Form {
            Section {
                Toggle("Remind me before my heats", isOn: Binding(get: { reminders.enabled }, set: { enabled in
                    Task {
                        do {
                            if enabled { _ = try await reminders.requestPermission() }
                            else { reminders.enabled = false }
                            await store.syncReminders()
                        } catch { self.error = error.localizedDescription }
                    }
                })).disabled(!store.isSignedIn)
                Picker("Before heat starts", selection: $reminders.minutes) {
                    ForEach([5, 10, 15, 20, 30, 45, 60], id: \.self) { Text("\($0) minutes").tag($0) }
                }.onChange(of: reminders.minutes) { _, _ in Task { await store.syncReminders() } }
            } header: { Text("Heat reminders").foregroundStyle(Color.gameDaySecondary) } footer: {
                Text("Reminders use your downloaded heat assignments. Open Game Day to pick up schedule changes. iPhone notification settings and Focus modes may affect delivery.")
                    .foregroundStyle(Color.gameDaySecondary)
            }
            if !store.isSignedIn { Text("Sign in to set reminders for your assigned heats.").foregroundStyle(.secondary) }
            if reminders.permissionDenied {
                Section { Text("Notifications are turned off for Game Day."); Link("Open iPhone Settings", destination: URL(string: UIApplication.openSettingsURLString)!) }
            }
            if let error { Text(error).foregroundStyle(.red) }
            Section {
                Text("Tap Show on Lock Screen on your next heat to start a Live Activity. It shows your heat, lane, venue, and countdown. Start it within eight hours of your heat.")
                Text("The countdown uses the last downloaded start time. Reopen the app after organizer schedule changes.").font(.footnote).foregroundStyle(Color.gameDaySecondary)
            } header: { Text("Lock Screen countdown").foregroundStyle(Color.gameDaySecondary) }
        }.navigationTitle("Heat reminders").navigationBarTitleDisplayMode(.inline)
    }
}

struct LegalView: View {
    enum Kind { case privacy, support }
    let kind: Kind
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                if kind == .privacy {
                    Text("Game Day privacy").font(.title.bold())
                    Text("Game Day connects to WODsmith to show competitions and, when you sign in, your profile, registrations, heat assignments, and announcements. Your password is sent over HTTPS for authentication. Your session is stored in the iPhone Keychain.")
                    Text("Downloaded schedules and account information are cached on this iPhone so you can read them during connection loss. Signing out clears the app’s athlete cache and heat reminders. Reminder preferences stay on your device.")
                    Text("Notifications are optional. Local heat reminders are scheduled on this iPhone. Live Activities display the heat details you choose on your Lock Screen. Game Day includes no advertising or tracking SDKs.")
                    Text("WODsmith uses server diagnostics to investigate errors and slow requests. These records can include request details and account identifiers when available, and are used for reliability and security.")
                    Link("Read WODsmith’s full privacy policy", destination: URL(string: "https://wodsmith.com/gameday/privacy/")!)
                } else {
                    Text("Game Day support").font(.title.bold())
                    Text("Missing a registration? Sign in with the email you used to register. Team athletes need to accept their team invitation before their heats appear.")
                    Text("No heat yet? Your organizer may still be building the schedule. Only published heats assigned to your registration appear in My day.")
                    Text("Need a lane, score, registration, or schedule correction? Contact your competition organizer from the competition’s WODsmith page.")
                    Text("For app problems, include your iOS version, competition name, and the steps that led to the problem. Never send your password.")
                    Link("Contact WODsmith support", destination: URL(string: "https://wodsmith.com/gameday/support/")!)
                }
            }.padding(24)
        }.navigationTitle(kind == .privacy ? "Privacy" : "Support").navigationBarTitleDisplayMode(.inline)
    }
}
