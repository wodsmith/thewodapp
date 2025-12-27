'use client'

import {Badge} from '@/components/ui/badge'

interface CredentialBadgeProps {
  credentials?: string
  className?: string
}

/**
 * Color-coded badge displaying judge credential level (L1, L2, Medical, etc.)
 */
export function CredentialBadge({
  credentials,
  className,
}: CredentialBadgeProps) {
  if (!credentials) {
    return (
      <Badge variant="outline" className={className}>
        No Credential
      </Badge>
    )
  }

  // Parse common credential patterns for color coding
  const credLower = credentials.toLowerCase()

  // Determine variant based on credential level
  let variant: 'default' | 'secondary' | 'destructive' | 'outline' = 'outline'

  if (credLower.includes('l2') || credLower.includes('level 2')) {
    variant = 'default' // Highest level judges
  } else if (credLower.includes('l1') || credLower.includes('level 1')) {
    variant = 'secondary'
  } else if (credLower.includes('medical') || credLower.includes('emt')) {
    variant = 'destructive' // Red for medical (high visibility)
  }

  return (
    <Badge variant={variant} className={className}>
      {credentials}
    </Badge>
  )
}
