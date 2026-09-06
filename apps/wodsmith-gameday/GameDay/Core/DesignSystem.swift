import SwiftUI

extension Color {
    // Darker orange is readable as small text on light system surfaces.
    static let gameDayOrange = Color(uiColor: UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 1, green: 0.53, blue: 0.31, alpha: 1)
            : UIColor(red: 0.70, green: 0.22, blue: 0.04, alpha: 1)
    })
    static let gameDayInk = Color(red: 0.09, green: 0.10, blue: 0.12)
    static let gameDayPaper = Color(uiColor: .systemGroupedBackground)
}

struct SectionEyebrow: View {
    let title: String
    var body: some View {
        Text(title).font(.headline).foregroundStyle(.primary).accessibilityAddTraits(.isHeader)
    }
}

extension View {
    func gameDayCard() -> some View {
        padding(16).frame(maxWidth: .infinity, alignment: .leading)
            .background(Color(uiColor: .secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 16))
    }
}

struct EmptyState: View {
    let title: String
    let message: String
    var symbol = "calendar"
    var body: some View {
        ContentUnavailableView(title, systemImage: symbol, description: Text(message))
    }
}

struct CompetitionCard: View {
    let competition: Competition
    var registered = false
    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            if let source = competition.profileImageUrl, let url = URL(string: source) {
                AsyncImage(url: url) { image in image.resizable().scaledToFill() } placeholder: { Color(uiColor: .tertiarySystemFill) }
                    .frame(width: 56, height: 56).clipShape(RoundedRectangle(cornerRadius: 10)).accessibilityHidden(true)
            }
            VStack(alignment: .leading, spacing: 6) {
                Text(competition.name).font(.headline).foregroundStyle(.primary)
                Text(competition.dateLabel).font(.subheadline).foregroundStyle(.primary)
                Text(competition.location.isEmpty ? competition.competitionType.capitalized : competition.location)
                    .font(.subheadline).foregroundStyle(.secondary)
                if registered { Label("Registered", systemImage: "checkmark.circle").font(.caption).foregroundStyle(.secondary) }
            }
        }.padding(.vertical, 8).accessibilityElement(children: .combine)
    }
}
