'use client'

import {format} from 'date-fns'
import {ExternalLink, Eye} from 'lucide-react'
import {Badge} from '@/components/ui/badge'
import {Button} from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type {AdminCompetition} from '@/server-fns/admin-fns'

interface AdminCompetitionsTableProps {
  competitions: AdminCompetition[]
}

export function AdminCompetitionsTable({
  competitions,
}: AdminCompetitionsTableProps) {
  if (competitions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Competitions</CardTitle>
          <CardDescription>
            There are no competitions in the system yet.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const getStatusBadge = (status: string, visibility: string) => {
    if (visibility === 'draft') {
      return <Badge variant="outline">Draft</Badge>
    }
    switch (status) {
      case 'published':
        return <Badge variant="default">Published</Badge>
      case 'registration_open':
        return (
          <Badge className="bg-green-600 hover:bg-green-700">
            Registration Open
          </Badge>
        )
      case 'registration_closed':
        return <Badge variant="secondary">Registration Closed</Badge>
      case 'in_progress':
        return (
          <Badge className="bg-blue-600 hover:bg-blue-700">In Progress</Badge>
        )
      case 'completed':
        return <Badge variant="secondary">Completed</Badge>
      case 'cancelled':
        return <Badge variant="destructive">Cancelled</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Competitions ({competitions.length})</CardTitle>
        <CardDescription>
          All competitions across all organizers
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Organizer</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Start Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {competitions.map((comp) => (
              <TableRow key={comp.id}>
                <TableCell className="font-medium">
                  <div>
                    {comp.name}
                    {comp.group && (
                      <div className="text-xs text-muted-foreground">
                        Series: {comp.group.name}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>{comp.organizingTeam?.name || 'Unknown'}</TableCell>
                <TableCell>
                  {getStatusBadge(comp.status, comp.visibility)}
                </TableCell>
                <TableCell>
                  {comp.startDate
                    ? format(new Date(comp.startDate), 'MMM d, yyyy')
                    : 'TBD'}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" asChild>
                      <a href={`/compete/${comp.slug}`} target="_blank">
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </a>
                    </Button>
                    <Button variant="ghost" size="sm" asChild>
                      <a href={`/compete/organizer/${comp.id}`} target="_blank">
                        <ExternalLink className="h-4 w-4 mr-1" />
                        Manage
                      </a>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
