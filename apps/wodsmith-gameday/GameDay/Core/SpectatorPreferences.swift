import Foundation
import Observation

struct PublicParticipant: Codable, Identifiable, Equatable {
    let id: String
    let name: String
    let divisionId: String?
    let division: String?
    let isTeam: Bool
}

// @lat: [[gameday#Spectator following]]
@Observable @MainActor
final class SpectatorPreferences {
    private struct Saved: Codable {
        var competitionIDs: Set<String> = []
        var follows: [String: Set<String>] = [:]
    }
    private var saved: Saved
    private let defaults: UserDefaults
    private let key = "gameday.spectator.v1"
    var competitionIDs: Set<String> { saved.competitionIDs }

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        saved = defaults.data(forKey: key).flatMap { try? JSONDecoder().decode(Saved.self, from: $0) } ?? Saved()
    }
    func followedIDs(_ competitionID: String) -> Set<String> { saved.follows[competitionID] ?? [] }
    func setSpectating(_ competitionID: String, enabled: Bool) {
        if enabled { saved.competitionIDs.insert(competitionID) }
        else { saved.competitionIDs.remove(competitionID) }
        save()
    }
    func toggleFollow(_ participantID: String, competitionID: String) {
        if followedIDs(competitionID).contains(participantID) { saved.follows[competitionID]?.remove(participantID) }
        else {
            saved.follows[competitionID, default: []].insert(participantID)
            saved.competitionIDs.insert(competitionID)
        }
        save()
    }
    private func save() {
        if let data = try? JSONEncoder().encode(saved) { defaults.set(data, forKey: key) }
    }
}

extension CompetitionDetail {
    func followedParticipants(_ ids: Set<String>) -> [PublicParticipant] {
        (participants ?? []).filter { ids.contains($0.id) }
    }
    func spectatorHeats(followedIDs: Set<String>?, divisionIDs: Set<String> = []) -> [Heat] {
        let eligible = Set((participants ?? []).filter {
            (followedIDs == nil || followedIDs!.contains($0.id)) &&
            (divisionIDs.isEmpty || $0.divisionId.map { divisionIDs.contains($0) } == true)
        }.map(\.id))
        let assigned = Set((publicAssignments ?? []).filter { eligible.contains($0.registrationId) }.map(\.heatId))
        return heats.filter { followedIDs == nil && divisionIDs.isEmpty || assigned.contains($0.id) }
            .sorted { ($0.startsAt ?? .distantFuture) < ($1.startsAt ?? .distantFuture) }
    }
    func followedLaneLabels(for heat: Heat, ids: Set<String>) -> [String] {
        (publicAssignments ?? []).filter { $0.heatId == heat.id && ids.contains($0.registrationId) }
            .sorted { $0.lane < $1.lane }.compactMap { assignment in
                guard let participant = participants?.first(where: { $0.id == assignment.registrationId }) else { return nil }
                return "\(participant.name) · Lane \(assignment.lane)"
            }
    }
}
