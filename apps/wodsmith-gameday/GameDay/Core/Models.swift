import Foundation

struct Competition: Codable, Identifiable, Hashable {
    let id: String
    let slug: String
    let name: String
    let description: String?
    let startDate: String
    let endDate: String
    let timezone: String?
    let competitionType: String
    let bannerImageUrl: String?
    let profileImageUrl: String?
    let city: String?
    let region: String?
    let address: String?

    var timeZone: TimeZone { TimeZone(identifier: timezone ?? "America/Denver") ?? .gmt }
    func hasEnded(at now: Date = .now) -> Bool {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = timeZone
        formatter.dateFormat = "yyyy-MM-dd"
        return endDate < formatter.string(from: now)
    }
    var location: String { [city, region].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: ", ") }
    var dateLabel: String {
        let parser = DateFormatter()
        parser.locale = Locale(identifier: "en_US_POSIX")
        parser.timeZone = .gmt
        parser.dateFormat = "yyyy-MM-dd"
        guard let date = parser.date(from: startDate) else { return startDate }
        parser.setLocalizedDateFormatFromTemplate("MMM d yyyy")
        return parser.string(from: date)
    }
    var webURL: URL { URL(string: "https://wodsmith.com/compete/")!.appendingPathComponent(slug) }
}

struct AthleteProfile: Codable, Equatable {
    let id: String
    let firstName: String?
    let lastName: String?
    let email: String?
    let avatar: String?
    var name: String { [firstName, lastName].compactMap { $0 }.joined(separator: " ") }
}

struct Registration: Codable, Identifiable {
    let id: String
    let competitionId: String
    let divisionId: String?
    let division: String?
    let teamName: String?
    let status: String
    let checkedInAt: Date?
    let paymentStatus: String?
    let registeredAt: Date
}

struct Heat: Codable, Identifiable, Hashable {
    let id: String
    let eventId: String
    let eventName: String
    let heatNumber: Int
    let startsAt: Date?
    let durationMinutes: Int?
    let venue: String?
    let division: String?
    var endsAt: Date? { startsAt?.addingTimeInterval(Double(durationMinutes ?? 10) * 60) }
    func dayLabel(in zone: TimeZone) -> String {
        guard let startsAt else { return "Date to be announced" }
        let formatter = DateFormatter()
        formatter.timeZone = zone
        formatter.setLocalizedDateFormatFromTemplate("EEE MMM d")
        return formatter.string(from: startsAt)
    }
    func timeLabel(in zone: TimeZone) -> String {
        guard let startsAt else { return "Time to be announced" }
        let formatter = DateFormatter()
        formatter.timeZone = zone
        formatter.timeStyle = .short
        return formatter.string(from: startsAt)
    }
}

struct HeatAssignment: Codable {
    let heatId: String
    let registrationId: String
    let lane: Int
}

struct Workout: Codable, Identifiable, Hashable {
    let id: String
    let name: String
    let description: String?
    let scheme: String
    let timeCap: Int?
    let notes: String?
    let order: Int
    var divisions: [WorkoutDivision]? = nil
    func initialDivisionID(registrations: [Registration]) -> String? {
        let registered = Set(registrations.filter { $0.status == "active" }.compactMap(\.divisionId))
        return divisions?.first { registered.contains($0.id) }?.id ?? divisions?.first?.id
    }
}

struct WorkoutDivision: Codable, Identifiable, Hashable {
    let id: String
    let label: String
    let description: String?
}

struct Announcement: Codable, Identifiable {
    let id: String
    let title: String
    let body: String
    let sentAt: Date?
}

struct HomeResponse: Codable {
    let competitions: [Competition]
    let registrations: [Registration]
    let profile: AthleteProfile?
    static let empty = Self(competitions: [], registrations: [], profile: nil)
    var myCompetitions: [Competition] {
        orderedMyCompetitions(at: .now)
    }
    func orderedMyCompetitions(at now: Date) -> [Competition] {
        let ids = Set(registrations.filter { $0.status == "active" }.map(\.competitionId))
        return competitions.filter { ids.contains($0.id) }.sorted {
            let past = $0.hasEnded(at: now)
            let otherPast = $1.hasEnded(at: now)
            if past != otherPast { return !past }
            if $0.startDate != $1.startDate { return past ? $0.startDate > $1.startDate : $0.startDate < $1.startDate }
            return $0.id < $1.id
        }
    }
}

struct CompetitionDetail: Codable {
    let competition: Competition
    let registrations: [Registration]
    let heats: [Heat]
    let assignments: [HeatAssignment]
    let workouts: [Workout]
    let announcements: [Announcement]
    var participants: [PublicParticipant]? = nil
    var publicAssignments: [HeatAssignment]? = nil
    var myHeats: [Heat] {
        let registrations = Set(registrations.filter { $0.status == "active" }.map(\.id))
        let ids = Set(assignments.filter { registrations.contains($0.registrationId) }.map(\.heatId))
        return heats.filter { ids.contains($0.id) }.sorted { ($0.startsAt ?? .distantFuture) < ($1.startsAt ?? .distantFuture) }
    }
    func nextHeat(at now: Date = .now) -> Heat? {
        myHeats.first { ($0.endsAt ?? .distantPast) > now }
    }
    func lane(for heat: Heat) -> Int? {
        let ids = Set(registrations.filter { $0.status == "active" }.map(\.id))
        return assignments.first { $0.heatId == heat.id && ids.contains($0.registrationId) }?.lane
    }
}

struct LeaderboardResponse: Codable {
    let entries: [LeaderboardEntry]
}
struct LeaderboardEntry: Codable, Identifiable {
    let registrationId: String
    let athleteName: String
    let divisionId: String
    let divisionLabel: String
    let totalPoints: Double
    let overallRank: Int
    let teamName: String?
    let eventResults: [EventResult]
    var id: String { registrationId }
    var name: String { teamName ?? athleteName }
}
struct EventResult: Codable, Identifiable {
    let trackWorkoutId: String
    let eventName: String
    let rank: Int
    let formattedScore: String
    var id: String { trackWorkoutId }
}

enum GameDayJSON {
    static func decoder() -> JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let string = try container.decode(String.self)
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            if let date = formatter.date(from: string) { return date }
            formatter.formatOptions = [.withInternetDateTime]
            if let date = formatter.date(from: string) { return date }
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Invalid ISO 8601 date")
        }
        return decoder
    }
    static func encoder() -> JSONEncoder {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        return encoder
    }
}

// @lat: [[gameday#Athlete competition defaults]]
enum AthleteCompetitionDefaults {
    struct Division: Identifiable, Equatable {
        let id: String
        let label: String
    }

    static func registrations(_ registrations: [Registration], competitionID: String) -> [Registration] {
        registrations.filter { $0.competitionId == competitionID && $0.status == "active" }
            .sorted { $0.registeredAt == $1.registeredAt ? $0.id < $1.id : $0.registeredAt < $1.registeredAt }
    }

    static func leaderboardDivisions(entries: [LeaderboardEntry], registrations: [Registration], competitionID: String) -> [Division] {
        var result: [Division] = []
        for registration in self.registrations(registrations, competitionID: competitionID) {
            guard let id = registration.divisionId, !result.contains(where: { $0.id == id }) else { continue }
            let label = registration.division ?? entries.first { $0.divisionId == id }?.divisionLabel ?? "Registered division"
            result.append(Division(id: id, label: label))
        }
        for entry in entries.sorted(by: { $0.divisionLabel == $1.divisionLabel ? $0.divisionId < $1.divisionId : $0.divisionLabel < $1.divisionLabel }) {
            if !result.contains(where: { $0.id == entry.divisionId }) {
                result.append(Division(id: entry.divisionId, label: entry.divisionLabel))
            }
        }
        return result
    }

    static func selectedDivisionID(_ selection: String?, divisions: [Division]) -> String? {
        selection.flatMap { id in divisions.first { $0.id == id }?.id } ?? divisions.first?.id
    }

    static func scheduleHeats(detail: CompetitionDetail, onlyMine: Bool?) -> [Heat] {
        let registered = !registrations(detail.registrations, competitionID: detail.competition.id).isEmpty
        return (onlyMine ?? registered) && registered ? detail.myHeats : detail.heats
    }
}
