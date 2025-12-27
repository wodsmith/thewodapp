'use client'

import {zodResolver} from '@hookform/resolvers/zod'
import {useNavigate, useRouter} from '@tanstack/react-router'
import {useForm} from 'react-hook-form'
import {toast} from 'sonner'
import {z} from 'zod'
import {
  createCompetitionGroupFn,
  updateCompetitionGroupFn,
} from '@/server-fns/competition-fns'
import {Button} from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {Input} from '@/components/ui/input'
import {Textarea} from '@/components/ui/textarea'
import type {CompetitionGroup} from '@/db/schemas/competitions'

const formSchema = z.object({
  name: z
    .string()
    .min(1, 'Series name is required')
    .max(255, 'Name is too long'),
  slug: z
    .string()
    .min(2, 'Slug must be at least 2 characters')
    .max(255, 'Slug is too long')
    .regex(
      /^[a-z0-9-]+$/,
      'Slug must be lowercase letters, numbers, and hyphens only',
    ),
  description: z.string().max(1000, 'Description is too long').optional(),
  profileImageUrl: z.string().optional(), // Placeholder for future implementation
})

type FormValues = z.infer<typeof formSchema>

interface OrganizerSeriesFormProps {
  organizingTeamId: string
  series?: CompetitionGroup
  onSuccess?: () => void
  onCancel?: () => void
}

export function OrganizerSeriesForm({
  organizingTeamId,
  series,
  onSuccess,
  onCancel,
}: OrganizerSeriesFormProps) {
  const navigate = useNavigate()
  const router = useRouter()
  const isEditing = !!series

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: series?.name || '',
      slug: series?.slug || '',
      description: series?.description || '',
      profileImageUrl: '',
    },
  })

  // Auto-generate slug from name (only for new series)
  const handleNameChange = (name: string) => {
    if (!isEditing) {
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim()

      form.setValue('slug', slug)
    }
  }

  async function onSubmit(data: FormValues) {
    try {
      if (isEditing) {
        // Update existing series
        await updateCompetitionGroupFn({
          data: {
            groupId: series.id,
            name: data.name,
            slug: data.slug,
            description: data.description || null,
          },
        })
        toast.success('Series updated successfully')
        // Invalidate router cache to ensure fresh data
        await router.invalidate()
      } else {
        // Create new series
        await createCompetitionGroupFn({
          data: {
            organizingTeamId,
            name: data.name,
            slug: data.slug,
            description: data.description,
          },
        })
        toast.success('Series created successfully')
        // Invalidate router cache to ensure fresh data
        await router.invalidate()
      }

      // Call onSuccess callback or navigate to organizer dashboard
      if (onSuccess) {
        onSuccess()
      } else {
        navigate({to: '/compete/organizer'})
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'An error occurred'
      toast.error(
        isEditing
          ? `Failed to update series: ${message}`
          : `Failed to create series: ${message}`,
      )
    }
  }

  const handleCancel = () => {
    if (onCancel) {
      onCancel()
    } else {
      navigate({to: '/compete/organizer'})
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({field}) => (
            <FormItem>
              <FormLabel>Series Name</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g., 2026 Throwdown Series"
                  {...field}
                  onChange={(e) => {
                    field.onChange(e)
                    if (!form.formState.dirtyFields.slug) {
                      handleNameChange(e.target.value)
                    }
                  }}
                />
              </FormControl>
              <FormDescription>
                A descriptive name for your competition series
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="slug"
          render={({field}) => (
            <FormItem>
              <FormLabel>Slug</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g., 2026-throwdown-series"
                  {...field}
                  disabled={isEditing}
                />
              </FormControl>
              <FormDescription>
                URL-friendly identifier (unique per team, lowercase, hyphens
                only)
                {isEditing && ' - Cannot be changed after creation'}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({field}) => (
            <FormItem>
              <FormLabel>Description (Optional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Describe this competition series"
                  {...field}
                  value={field.value || ''}
                  rows={3}
                />
              </FormControl>
              <FormDescription>
                Brief description of this series
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-4">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting
              ? isEditing
                ? 'Updating...'
                : 'Creating...'
              : isEditing
                ? 'Update Series'
                : 'Create Series'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={form.formState.isSubmitting}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  )
}
