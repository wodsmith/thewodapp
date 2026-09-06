import Foundation

// Fictional fixtures are available only in Debug builds for UI tests and screenshots.
enum DemoData {
    static let competition = Competition(id: "demo-summit", slug: "summit-throwdown", name: "Summit Throwdown", description: "One floor. A community of competitors. Three tests of strength, skill, and grit.\n\nAthlete briefing at 8:00 AM. Bring your gear and your best effort.", startDate: "2026-09-05", endDate: "2026-09-06", timezone: "America/Boise", competitionType: "in-person", bannerImageUrl: nil, profileImageUrl: nil, city: "Boise", region: "ID", address: "Competition floor · Main hall")
    static let second = Competition(id: "demo-fall", slug: "fall-classic", name: "The Fall Classic", description: "A full day of functional fitness.", startDate: "2026-10-17", endDate: "2026-10-17", timezone: "America/Denver", competitionType: "in-person", bannerImageUrl: nil, profileImageUrl: nil, city: "Salt Lake City", region: "UT", address: nil)
    static let registration = Registration(id: "demo-registration", competitionId: competition.id, divisionId: "rx", division: "Individual RX", teamName: nil, status: "active", checkedInAt: .now.addingTimeInterval(-7200), paymentStatus: "PAID", registeredAt: .now.addingTimeInterval(-86400 * 30))
    static let home = HomeResponse(competitions: [competition, second], registrations: [registration], profile: AthleteProfile(id: "demo-athlete", firstName: "Alex", lastName: "Morgan", email: "alex@example.com", avatar: nil))
    static let heats = [
        Heat(id: "heat-1", eventId: "event-1", eventName: "Engine Room", heatNumber: 3, startsAt: .now.addingTimeInterval(31 * 60), durationMinutes: 12, venue: "Main floor", division: "Individual RX"),
        Heat(id: "heat-2", eventId: "event-2", eventName: "Heavy Intentions", heatNumber: 3, startsAt: .now.addingTimeInterval(130 * 60), durationMinutes: 8, venue: "Lifting stage", division: "Individual RX"),
        Heat(id: "heat-3", eventId: "event-3", eventName: "Leave No Doubt", heatNumber: 3, startsAt: .now.addingTimeInterval(240 * 60), durationMinutes: 15, venue: "Main floor", division: "Individual RX")
    ]
    static let detail = CompetitionDetail(competition: competition, registrations: [registration], heats: heats,
        assignments: heats.map { HeatAssignment(heatId: $0.id, registrationId: registration.id, lane: 4) },
        workouts: [
            Workout(id: "event-1", name: "Engine Room", description: "3 rounds for time\n\n500 m row\n21 kettlebell swings\n12 burpees over the rower\n\nKeep your transitions sharp. Every second counts.", scheme: "time", timeCap: 720, notes: "Athletes report to staging 10 minutes before their heat.", order: 0, divisions: [WorkoutDivision(id: "rx", label: "Individual RX", description: "Kettlebell: 24 kg / 16 kg.\n\nSwings finish with the kettlebell overhead. Both feet must clear the rower on each burpee."), WorkoutDivision(id: "scaled", label: "Scaled", description: "Kettlebell: 16 kg / 12 kg. Russian swings finish at eye level. Step-overs are permitted.")]),
            Workout(id: "event-2", name: "Heavy Intentions", description: "8 minutes to establish a heavy complex:\n\n1 clean + 1 front squat + 1 jerk", scheme: "load", timeCap: 480, notes: nil, order: 1),
            Workout(id: "event-3", name: "Leave No Doubt", description: "For time\n\n21-15-9\nThrusters\nPull-ups\n\nThen, a 400 m run to the finish.", scheme: "time", timeCap: 900, notes: nil, order: 2)
        ], announcements: [Announcement(id: "announcement-1", title: "Your floor is ready.", body: "Athlete check-in opens at 7:00 AM at the main entrance. Bring a photo ID and head to the briefing at 8:00 AM.\n\nWe can’t wait to see what you bring to the floor.", sentAt: .now.addingTimeInterval(-3600))])
    static let leaderboard = LeaderboardResponse(entries: ["Jordan Lee", "Sam Rivera", "Alex Morgan", "Taylor Brooks", "Casey Ellis", "Jamie Park"].enumerated().map { index, name in
        LeaderboardEntry(registrationId: index == 2 ? registration.id : "athlete-\(index)", athleteName: name, divisionId: "rx", divisionLabel: "Individual RX", totalPoints: Double(15 + index * 8), overallRank: index + 1, teamName: nil, eventResults: [EventResult(trackWorkoutId: "event-1", eventName: "Engine Room", rank: index + 1, formattedScore: "0\(8 + index / 3):\(12 + index * 5)")])
    })
}
