'use client'

import {ImageIcon, Loader2, Upload, X} from 'lucide-react'
import * as React from 'react'
import {useCallback, useState} from 'react'
import {cn} from '@/lib/utils'
import {Button} from './button'

type UploadPurpose =
  | 'competition-profile'
  | 'competition-banner'
  | 'competition-sponsor-logo'
  | 'athlete-profile'
  | 'athlete-cover'
  | 'sponsor-logo'

interface ImageUploadProps {
  purpose: UploadPurpose
  entityId?: string
  value?: string
  onChange: (url: string | null) => void
  maxSizeMb?: number
  recommendedDimensions?: {width: number; height: number}
  aspectRatio?: string
  className?: string
  disabled?: boolean
}

export function ImageUpload({
  purpose,
  entityId,
  value,
  onChange,
  maxSizeMb = 2,
  recommendedDimensions,
  aspectRatio = '1/1',
  className,
  disabled,
}: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const handleUpload = useCallback(
    async (file: File) => {
      setError(null)
      setIsUploading(true)

      const formData = new FormData()
      formData.append('file', file)
      formData.append('purpose', purpose)
      if (entityId) {
        formData.append('entityId', entityId)
      }

      try {
        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          const data = (await response.json()) as {error?: string}
          throw new Error(data.error || 'Upload failed')
        }

        const data = (await response.json()) as {url: string}
        onChange(data.url)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed')
      } finally {
        setIsUploading(false)
      }
    },
    [purpose, entityId, onChange],
  )

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        handleUpload(file)
      }
    },
    [handleUpload],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)

      const file = e.dataTransfer.files[0]
      if (file?.type.startsWith('image/')) {
        handleUpload(file)
      }
    },
    [handleUpload],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleRemove = useCallback(() => {
    onChange(null)
    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }, [onChange])

  return (
    <div className={cn('space-y-2', className)}>
      <section
        aria-label="Image upload drop zone"
        className={cn(
          'relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors',
          isDragging && 'border-primary bg-primary/5',
          !isDragging && 'border-muted-foreground/25 hover:border-primary/50',
          disabled && 'pointer-events-none opacity-50',
        )}
        style={{aspectRatio}}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {value ? (
          <>
            <img
              src={value}
              alt="Uploaded content"
              className="absolute inset-0 h-full w-full rounded-lg object-cover"
            />
            {!disabled && (
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute right-2 top-2 h-8 w-8"
                onClick={handleRemove}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </>
        ) : (
          <button
            type="button"
            className="flex h-full w-full flex-col items-center justify-center gap-2 p-6"
            onClick={() => inputRef.current?.click()}
            disabled={disabled || isUploading}
          >
            {isUploading ? (
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            ) : (
              <>
                <div className="rounded-full bg-muted p-3">
                  {isDragging ? (
                    <Upload className="h-6 w-6 text-primary" />
                  ) : (
                    <ImageIcon className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium">
                    {isDragging ? 'Drop image here' : 'Click or drag to upload'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Max {maxSizeMb}MB - JPEG, PNG, WebP, GIF
                  </p>
                </div>
              </>
            )}
          </button>
        )}
      </section>

      {recommendedDimensions && (
        <p className="text-xs text-muted-foreground">
          Recommended: {recommendedDimensions.width} x{' '}
          {recommendedDimensions.height} pixels
        </p>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleFileSelect}
        disabled={disabled || isUploading}
      />
    </div>
  )
}
