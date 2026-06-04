import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
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
const optionalId = z.string().min(1).optional()
const optionalText = (max: number) => z.string().max(max).optional()
const optionalDate = optionalText(20)
const optionalStatus = optionalText(100)

const gymSchema = z.object({
  action: z.enum(["create", "update", "delete"]),
  id: optionalId,
  name: optionalText(255),
  location: optionalText(255),
  website: optionalText(500),
  crossfitPage: optionalText(500),
  email: optionalText(255),
  phone: optionalText(100),
  instagram: optionalText(255),
  ownerManager: optionalText(500),
  status: optionalStatus,
  priority: optionalText(50),
  relationship: optionalText(255),
  notes: optionalText(4000),
})

const contactSchema = z.object({
  action: z.enum(["create", "update", "delete"]),
  id: optionalId,
  fullName: optionalText(255),
  email: optionalText(255),
  phone: optionalText(100),
  status: optionalStatus,
  companyId: optionalId,
  notes: optionalText(4000),
})

const interactionSchema = z.object({
  action: z.enum(["create", "update", "delete"]),
  id: optionalId,
  source: z.enum(["Meeting", "Outreach"]).optional(),
  title: optionalText(255),
  date: optionalDate,
  channel: optionalText(100),
  status: optionalStatus,
  owner: ownerSchema.optional(),
  companyId: optionalId,
  contactId: optionalId,
  campaignId: optionalId,
  notes: optionalText(4000),
  content: optionalText(10000),
})

const campaignInteractionSchema = interactionSchema.extend({
  action: z.enum(["create", "update", "delete"]),
})

const campaignSchema = z.object({
  action: z.enum(["create", "update", "delete", "update_audience", "manage"]),
  id: optionalId,
  name: optionalText(255),
  status: optionalStatus,
  owner: ownerSchema.optional(),
  goal: optionalText(4000),
  startDate: optionalDate,
  endDate: optionalDate,
  audienceGymIds: z.array(z.string().min(1)).optional(),
  audienceContactIds: z.array(z.string().min(1)).optional(),
  interactions: z.array(campaignInteractionSchema).max(100).optional(),
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

async function applyCampaignInteractionActions({
  campaignId,
  interactions,
}: {
  campaignId: string
  interactions: z.infer<typeof campaignInteractionSchema>[]
}) {
  const results: Array<{
    action: "create" | "update" | "delete"
    id: string
    deleted?: boolean
  }> = []

  for (const interaction of interactions) {
    if (interaction.action === "delete") {
      const result = await deleteInteraction({
        id: requireValue(interaction.id, "interaction id"),
      })
      results.push({
        action: "delete",
        id: result.id,
        deleted: result.deleted,
      })
      continue
    }

    if (interaction.action === "create") {
      const result = await createInteraction({
        ...interaction,
        source: interaction.source ?? "Outreach",
        title: requireValue(interaction.title, "interaction title"),
        campaignId,
      })
      results.push({ action: "create", id: result.id })
      continue
    }

    const result = await updateInteraction({
      ...interaction,
      id: requireValue(interaction.id, "interaction id"),
      source: interaction.source ?? "Outreach",
      title: requireValue(interaction.title, "interaction title"),
      campaignId,
    })
    results.push({ action: "update", id: result.id })
  }

  return results
}

export function createCrmMcpServer() {
  const server = new McpServer({
    name: "wodsmith-crm",
    version: "1.0.0",
  })

  // `@lat`: [[architecture]]
  server.tool(
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

  // `@lat`: [[architecture]]
  server.tool(
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

  // `@lat`: [[architecture]]
  server.tool(
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

  // `@lat`: [[architecture]]
  server.tool(
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
        const source = input.source ?? "Outreach"
        return jsonResponse(
          await createInteraction({
            ...input,
            source,
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

  // `@lat`: [[crm-campaigns]]
  server.tool(
    "manage_campaign",
    "Create, update, delete, assign audiences, and bulk create/update/delete campaign interactions based on the user's intent.",
    campaignSchema.shape,
    async (input) => {
      if (input.action === "delete") {
        return jsonResponse(
          await deleteCampaign({ id: requireValue(input.id, "id") }),
        )
      }

      const shouldUpdateAudience =
        input.action === "update_audience" ||
        input.audienceGymIds !== undefined ||
        input.audienceContactIds !== undefined

      if (input.action === "create") {
        const campaign = await createCampaign({
          ...input,
          name: requireValue(input.name, "name"),
          audienceGymIds: input.audienceGymIds ?? [],
          audienceContactIds: input.audienceContactIds ?? [],
        })
        const interactions = await applyCampaignInteractionActions({
          campaignId: campaign.id,
          interactions: input.interactions ?? [],
        })
        return jsonResponse({ campaign, interactions })
      }

      const campaignId = requireValue(input.id, "id")
      const campaign =
        input.action === "update" || input.name !== undefined
          ? await updateCampaign({
              ...input,
              id: campaignId,
              name: requireValue(input.name, "name"),
            })
          : { id: campaignId }

      const audience = shouldUpdateAudience
        ? await updateCampaignAudience({
            campaignId,
            audienceGymIds: input.audienceGymIds ?? [],
            audienceContactIds: input.audienceContactIds ?? [],
          })
        : undefined

      const interactions = await applyCampaignInteractionActions({
        campaignId,
        interactions: input.interactions ?? [],
      })

      return jsonResponse({
        campaign,
        audience,
        interactions,
      })
    },
  )

  // `@lat`: [[crm-campaigns]]
  server.tool(
    "plan_campaign_touch",
    "Add a planned outreach touch to a campaign, optionally tied to a gym/contact.",
    {
      campaignId: z.string().min(1),
      title: z.string().min(1).max(255),
      channel: optionalText(100),
      owner: ownerSchema.optional(),
      status: optionalStatus,
      dueDate: optionalDate,
      companyId: optionalId,
      contactId: optionalId,
      notes: optionalText(4000),
      content: optionalText(10000),
    },
    async (input) => jsonResponse(await createCampaignTouch(input)),
  )

  return server
}
