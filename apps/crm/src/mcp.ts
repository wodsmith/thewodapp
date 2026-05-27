import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { McpAgent } from "agents/mcp"
import { z } from "zod"
import {
  createCampaign,
  createCampaignTouch,
  createContact,
  createGym,
  createInteraction,
  deleteCampaign,
  deleteContact,
  deleteGym,
  deleteInteraction,
  readCrmData,
  updateCampaign,
  updateCampaignAudience,
  updateContact,
  updateGym,
  updateInteraction,
} from "@/server-fns/crm"

const ownerSchema = z.enum(["Ian", "Zac"])
const nullableString = z.string().optional()

const gymSchema = z.object({
  action: z.enum(["create", "update", "delete"]),
  id: z.string().optional(),
  name: nullableString,
  location: nullableString,
  website: nullableString,
  crossfitPage: nullableString,
  email: nullableString,
  phone: nullableString,
  instagram: nullableString,
  ownerManager: nullableString,
  status: nullableString,
  priority: nullableString,
  relationship: nullableString,
  notes: nullableString,
})

const contactSchema = z.object({
  action: z.enum(["create", "update", "delete"]),
  id: z.string().optional(),
  fullName: nullableString,
  email: nullableString,
  phone: nullableString,
  status: nullableString,
  companyId: nullableString,
  notes: nullableString,
})

const interactionSchema = z.object({
  action: z.enum(["create", "update", "delete"]),
  id: z.string().optional(),
  source: z.enum(["Meeting", "Outreach"]).optional(),
  title: nullableString,
  date: nullableString,
  channel: nullableString,
  status: nullableString,
  owner: ownerSchema.optional(),
  companyId: nullableString,
  contactId: nullableString,
  campaignId: nullableString,
  notes: nullableString,
  content: nullableString,
})

const campaignSchema = z.object({
  action: z.enum(["create", "update", "delete", "update_audience"]),
  id: z.string().optional(),
  name: nullableString,
  status: nullableString,
  owner: ownerSchema.optional(),
  goal: nullableString,
  startDate: nullableString,
  endDate: nullableString,
  audienceGymIds: z.array(z.string()).optional(),
  audienceContactIds: z.array(z.string()).optional(),
})

function jsonResponse(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(value, null, 2),
      },
    ],
  }
}

function requireValue<T>(value: T | null | undefined, label: string): T {
  if (value === null || value === undefined || value === "") {
    throw new Error(`${label} is required`)
  }
  return value
}

function filterCrmData(
  data: Awaited<ReturnType<typeof readCrmData>>,
  query?: string,
) {
  const normalized = query?.trim().toLowerCase()
  if (!normalized) return data

  const matches = (values: Array<string | null | undefined>) =>
    values.some((value) => value?.toLowerCase().includes(normalized))

  return {
    gyms: data.gyms.filter((gym) =>
      matches([gym.name, gym.location, gym.email, gym.status, gym.notes]),
    ),
    contacts: data.contacts.filter((contact) =>
      matches([
        contact.fullName,
        contact.email,
        contact.phone,
        contact.companyName,
        contact.notes,
      ]),
    ),
    interactions: data.interactions.filter((interaction) =>
      matches([
        interaction.title,
        interaction.companyName,
        interaction.contactName,
        interaction.campaignName,
        interaction.notes,
        interaction.content,
      ]),
    ),
    campaigns: data.campaigns.filter((campaign) =>
      matches([
        campaign.name,
        campaign.status,
        campaign.owner,
        campaign.goal,
        ...campaign.audienceGymNames,
        ...campaign.audienceContactNames,
      ]),
    ),
  }
}

export class CrmMcp extends McpAgent {
  server = new McpServer({
    name: "wodsmith-crm",
    version: "1.0.0",
  })

  async init() {
    this.server.tool(
      "get_crm_context",
      "List CRM records and navigation targets. Use query to narrow results before updating records.",
      {
        query: z.string().optional(),
        includeCampaignTouches: z.boolean().optional(),
      },
      async ({ query, includeCampaignTouches }) => {
        const data = await readCrmData()
        const filtered = filterCrmData(data, query)
        return jsonResponse({
          ...filtered,
          campaignTouches: includeCampaignTouches
            ? data.campaignTouches
            : undefined,
          navigation: {
            dashboard: "/dashboard",
            gyms: "/gyms",
            contacts: "/contacts",
            interactions: "/interactions",
            campaigns: "/campaigns",
            gymDetail: "/gyms/:gymId",
            contactDetail: "/contacts/:contactId",
            interactionDetail: "/interactions/:interactionId",
            campaignDetail: "/campaigns/:campaignId",
            campaignAudience: "/campaigns/:campaignId/audience",
          },
        })
      },
    )

    this.server.tool(
      "manage_gym",
      "Create, update, or delete a gym/company based on the user's intent.",
      gymSchema.shape,
      async (input) => {
        if (input.action === "delete") {
          return jsonResponse(
            await deleteGym({ id: requireValue(input.id, "id") }),
          )
        }
        if (input.action === "create") {
          return jsonResponse(
            await createGym({
              ...input,
              name: requireValue(input.name, "name"),
            }),
          )
        }
        return jsonResponse(
          await updateGym({
            ...input,
            id: requireValue(input.id, "id"),
            name: requireValue(input.name, "name"),
          }),
        )
      },
    )

    this.server.tool(
      "manage_contact",
      "Create, update, or delete a contact based on the user's intent.",
      contactSchema.shape,
      async (input) => {
        if (input.action === "delete") {
          return jsonResponse(
            await deleteContact({ id: requireValue(input.id, "id") }),
          )
        }
        if (input.action === "create") {
          return jsonResponse(
            await createContact({
              ...input,
              fullName: requireValue(input.fullName, "fullName"),
            }),
          )
        }
        return jsonResponse(
          await updateContact({
            ...input,
            id: requireValue(input.id, "id"),
            fullName: requireValue(input.fullName, "fullName"),
          }),
        )
      },
    )

    this.server.tool(
      "manage_interaction",
      "Create, update, or delete a meeting/outreach interaction based on the user's intent.",
      interactionSchema.shape,
      async (input) => {
        if (input.action === "delete") {
          return jsonResponse(
            await deleteInteraction({ id: requireValue(input.id, "id") }),
          )
        }
        if (input.action === "create") {
          return jsonResponse(
            await createInteraction({
              ...input,
              title: requireValue(input.title, "title"),
            }),
          )
        }
        return jsonResponse(
          await updateInteraction({
            ...input,
            id: requireValue(input.id, "id"),
            source: requireValue(input.source, "source"),
            title: requireValue(input.title, "title"),
          }),
        )
      },
    )

    this.server.tool(
      "manage_campaign",
      "Create, update, delete, or change campaign audience based on the user's intent.",
      campaignSchema.shape,
      async (input) => {
        if (input.action === "delete") {
          return jsonResponse(
            await deleteCampaign({ id: requireValue(input.id, "id") }),
          )
        }
        if (input.action === "update_audience") {
          return jsonResponse(
            await updateCampaignAudience({
              campaignId: requireValue(input.id, "id"),
              audienceGymIds: input.audienceGymIds ?? [],
              audienceContactIds: input.audienceContactIds ?? [],
            }),
          )
        }
        if (input.action === "create") {
          return jsonResponse(
            await createCampaign({
              ...input,
              name: requireValue(input.name, "name"),
              audienceGymIds: input.audienceGymIds ?? [],
              audienceContactIds: input.audienceContactIds ?? [],
            }),
          )
        }
        return jsonResponse(
          await updateCampaign({
            ...input,
            id: requireValue(input.id, "id"),
            name: requireValue(input.name, "name"),
          }),
        )
      },
    )

    this.server.tool(
      "plan_campaign_touch",
      "Add a planned outreach touch to a campaign, optionally tied to a gym/contact.",
      {
        campaignId: z.string(),
        title: z.string(),
        channel: z.string().optional(),
        owner: ownerSchema.optional(),
        status: z.string().optional(),
        dueDate: z.string().optional(),
        companyId: z.string().optional(),
        contactId: z.string().optional(),
        notes: z.string().optional(),
        content: z.string().optional(),
      },
      async (input) => jsonResponse(await createCampaignTouch(input)),
    )
  }
}
