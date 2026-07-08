// @lat: [[crew#Assignment Confirmations]]
// @lat: [[crew#Volunteer Messaging Composer]]
import { createFileRoute, getRouteApi } from "@tanstack/react-router"
import { getCrewAssignmentCommunicationDashboardFn } from "@/server-fns/crew-confirmation-fns"
import { getCrewMessageComposerFn } from "@/server-fns/crew-message-fns"
import { MessagesComposeTab } from "./-components/messages-compose-tab"
import { MessagesHistoryTab } from "./-components/messages-history-tab"
import { MessagesResponsesTab } from "./-components/messages-responses-tab"

const MESSAGE_TABS = [
  { id: "compose", label: "Compose" },
  { id: "responses", label: "Responses" },
  { id: "history", label: "History" },
] as const

type MessageTabId = (typeof MESSAGE_TABS)[number]["id"]

function isMessageTabId(value: unknown): value is MessageTabId {
  return MESSAGE_TABS.some((tab) => tab.id === value)
}

interface MessagesSearch {
  tab: MessageTabId
}

function validateMessagesSearch(
  search: Record<string, unknown>,
): MessagesSearch {
  return {
    tab: isMessageTabId(search.tab) ? search.tab : "compose",
  }
}

export const Route = createFileRoute("/events/$eventId/messages")({
  validateSearch: validateMessagesSearch,
  loader: async ({ params }) => {
    const [composer, dashboard] = await Promise.all([
      getCrewMessageComposerFn({ data: { eventId: params.eventId } }),
      getCrewAssignmentCommunicationDashboardFn({
        data: { eventId: params.eventId },
      }),
    ])
    return { composer, dashboard }
  },
  component: CrewMessagesPage,
})

const parentRoute = getRouteApi("/events/$eventId")

function CrewMessagesPage() {
  const { eventId } = parentRoute.useParams()
  const { composer, dashboard } = Route.useLoaderData()
  const navigate = Route.useNavigate()
  const { tab: activeTab } = Route.useSearch()

  const timezone =
    composer.event.timezone ?? dashboard.event.timezone ?? "America/Denver"

  function handleTabChange(tab: MessageTabId) {
    void navigate({
      search: (previous) => ({ ...previous, tab }),
      replace: true,
    })
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Messages</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Compose and send email to volunteers, track responses, and review what
          has already gone out.
        </p>
      </div>

      <div
        className="flex flex-wrap gap-2 border-b"
        role="tablist"
        aria-label="Messages sections"
      >
        {MESSAGE_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`messages-tab-${tab.id}`}
            aria-selected={activeTab === tab.id}
            aria-controls={`messages-panel-${tab.id}`}
            onClick={() => handleTabChange(tab.id)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
              activeTab === tab.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "compose" ? (
        <div
          role="tabpanel"
          id="messages-panel-compose"
          aria-labelledby="messages-tab-compose"
        >
          <MessagesComposeTab
            eventId={eventId}
            composer={composer}
            timezone={timezone}
          />
        </div>
      ) : null}
      {activeTab === "responses" ? (
        <div
          role="tabpanel"
          id="messages-panel-responses"
          aria-labelledby="messages-tab-responses"
        >
          <MessagesResponsesTab
            eventId={eventId}
            dashboard={dashboard}
            timezone={timezone}
          />
        </div>
      ) : null}
      {activeTab === "history" ? (
        <div
          role="tabpanel"
          id="messages-panel-history"
          aria-labelledby="messages-tab-history"
        >
          <MessagesHistoryTab history={composer.history} timezone={timezone} />
        </div>
      ) : null}
    </section>
  )
}
