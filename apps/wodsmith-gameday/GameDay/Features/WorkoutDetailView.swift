import SwiftUI

struct WorkoutDetailView: View {
    let workout: Workout
    let detail: CompetitionDetail
    @State private var divisionID: String

    init(workout: Workout, detail: CompetitionDetail) {
        self.workout = workout
        self.detail = detail
        _divisionID = State(initialValue: workout.initialDivisionID(registrations: detail.registrations) ?? "")
    }

    private var division: WorkoutDivision? { workout.divisions?.first { $0.id == divisionID } }
    private var cap: String? {
        guard let seconds = workout.timeCap else { return nil }
        return seconds.isMultiple(of: 60) ? "\(seconds / 60) min" : "\(seconds / 60) min \(seconds % 60) sec"
    }

    var body: some View {
        List {
            Section {
                Text(workout.name).font(.title2.bold()).accessibilityAddTraits(.isHeader)
                LabeledContent("Scoring", value: workout.scheme.replacingOccurrences(of: "-", with: " ").capitalized)
                if let cap { LabeledContent("Time cap", value: cap) }
            }
            if let description = workout.description, !description.isEmpty {
                Section("Workout") { MarkdownText(text: description) }
            }
            if let divisions = workout.divisions, !divisions.isEmpty {
                Section("Division standards") {
                    Picker("Division", selection: $divisionID) {
                        ForEach(divisions) { Text($0.label).tag($0.id) }
                    }
                    if let text = division?.description?.trimmingCharacters(in: .whitespacesAndNewlines), !text.isEmpty {
                        MarkdownText(text: text)
                    } else {
                        Text("No additional standards published for this division. Refer to the workout instructions above.")
                            .foregroundStyle(.secondary)
                    }
                }
            }
            if let notes = workout.notes, !notes.isEmpty {
                Section("Event notes") { MarkdownText(text: notes) }
            }
            Section {
                Link("Open workout on WODsmith", destination: detail.competition.webURL.appendingPathComponent("workouts").appendingPathComponent(workout.id))
            }
        }.navigationTitle("Workout").navigationBarTitleDisplayMode(.inline)
    }
}
