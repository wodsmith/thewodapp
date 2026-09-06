import ActivityKit
import Foundation

struct HeatActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        let eventName: String
        let startsAt: Date
        let endsAt: Date
        let heatNumber: Int
        let lane: Int?
        let venue: String
    }
    let competitionID: String
    let competitionName: String
    let heatID: String
}
