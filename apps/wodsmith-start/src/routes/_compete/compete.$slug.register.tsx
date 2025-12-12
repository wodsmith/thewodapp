import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { notFound } from '@tanstack/react-router'
import { useEffect } from 'react'
import { RegistrationForm } from '~/components/compete/registration-form'
import { getCompetitionFn } from '~/server-functions/competitions'
import { getSessionFromCookie } from '~/utils/auth'

export const Route = createFileRoute('/_compete/compete/$slug/register')({
  loader: async ({ params }) => {
    const session = await getSessionFromCookie()
    if (!session) {
      throw new Error('Unauthorized')
    }

    const compResult = await getCompetitionFn({
      data: { idOrSlug: params.slug },
    })

    if (!compResult.success || !compResult.data) {
      throw notFound()
    }

    return {
      competition: compResult.data,
      userId: session.userId,
    }
  },
  component: RegisterPageComponent,
  errorComponent: () => {
    const navigate = useNavigate()
    useEffect(() => {
      navigate({ to: '/sign-in' })
    }, [navigate])
    return null
  },
})

function RegisterPageComponent() {
  const { competition, userId } = Route.useLoaderData()
  const search = Route.useSearch() as { canceled?: string }

  return (
    <div className="mx-auto max-w-2xl">
      <RegistrationForm
        competition={competition}
        userId={userId}
        paymentCanceled={search.canceled === 'true'}
      />
    </div>
  )
}
