'use client'

import {Check, Copy} from 'lucide-react'
import {useState} from 'react'
import {Button} from '@/components/ui/button'

type CopyInviteLinkProps = {
  inviteUrl: string
}

export function CopyInviteLink({inviteUrl}: CopyInviteLinkProps) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = inviteUrl
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleCopy}
      className="flex-shrink-0"
    >
      {copied ? (
        <>
          <Check className="w-4 h-4 mr-1" />
          Copied
        </>
      ) : (
        <>
          <Copy className="w-4 h-4 mr-1" />
          Copy Link
        </>
      )}
    </Button>
  )
}
