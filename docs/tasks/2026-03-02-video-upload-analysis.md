# Video Upload & Storage Analysis: Self-Hosted Competition Submissions

**Date:** 2026-03-02
**Status:** Research / Proposal

## Overview

Currently, WODsmith requires athletes to upload videos to external platforms (YouTube, Vimeo, Streamable) and submit URLs for online competition events. This document evaluates the cost and implementation approach for allowing athletes to upload videos directly to WODsmith, eliminating the dependency on third-party platforms.

---

## Scenario Parameters

| Parameter | Value |
|---|---|
| Events per competition | 4 |
| Athletes per competition | 500 |
| **Total videos per competition** | **2,000** |
| Video length | 10–20 min (avg 15 min) |
| **Total minutes per competition** | **30,000 min** |
| Avg file size (720p–1080p) | ~200 MB |
| **Total storage per competition** | **~400 GB** |
| Views per video | ~7 (handful of public viewers + judge review) |
| **Total delivery minutes per competition** | **~210,000 min** |
| Estimated delivery bandwidth | ~2.1 TB (adaptive bitrate ~150 MB/view) |
| Retention period | ~3 months |
| Competitions per year (busy platform) | 4–6 (use 5) |

---

## Cost Comparison

### Option 1: Cloudflare Stream (Managed Video Platform)

Cloudflare Stream is a fully managed video solution with encoding, adaptive bitrate streaming, and an embeddable player.

**Pricing:**
- **Storage:** $5 per 1,000 minutes stored/month ($0.005/min)
- **Delivery:** $1 per 1,000 minutes delivered ($0.001/min)
- Encoding, transcoding, and player included

**Per-Competition Cost (3-month retention):**

| Line Item | Calculation | Cost |
|---|---|---|
| Storage Month 1 | 30,000 min × $0.005 | $150 |
| Storage Month 2 | 30,000 min × $0.005 | $150 |
| Storage Month 3 | 30,000 min × $0.005 | $150 |
| Delivery (total) | 210,000 min × $0.001 | $210 |
| **Total per competition** | | **~$660** |

**Annual estimate (5 competitions): ~$3,300**

**Pros:**
- Fully managed — no transcoding, CDN, or player to build
- Already in the Cloudflare ecosystem (same account, same dashboard)
- Adaptive bitrate streaming out of the box
- Built-in video player with embed support
- TUS protocol for resumable uploads
- Direct Creator Uploads (generate upload URLs server-side, athletes upload client-side)
- Webhooks for processing status

**Cons:**
- Most expensive option
- Storage priced per minute (not per GB), so short videos with large files still cost the same as long videos
- Prepaid storage — need to estimate capacity upfront

---

### Option 2: Cloudflare R2 (Raw Object Storage)

Store raw video files in R2 and serve them directly without transcoding. Athletes upload MP4 files, viewers download/stream the MP4.

**Pricing:**
- **Storage:** $0.015/GB/month (10 GB free)
- **Class A ops (writes):** $4.50 per million
- **Class B ops (reads):** $0.36 per million
- **Egress: $0 (free!)**

**Per-Competition Cost (3-month retention):**

| Line Item | Calculation | Cost |
|---|---|---|
| Storage Month 1 | 400 GB × $0.015 | $6.00 |
| Storage Month 2 | 400 GB × $0.015 | $6.00 |
| Storage Month 3 | 400 GB × $0.015 | $6.00 |
| Upload operations | ~2,000 writes | ~$0.01 |
| Read operations | ~14,000 reads | ~$0.01 |
| Egress | 2.1 TB | $0.00 |
| **Total per competition** | | **~$18** |

**Annual estimate (5 competitions): ~$90**

**Pros:**
- Extremely cheap
- Zero egress fees
- Already using R2 for images/PDFs in the codebase
- Full control over the files

**Cons:**
- No transcoding — viewers get the raw upload (if someone uploads a 4K 2GB file, everyone downloads 2GB)
- No adaptive bitrate streaming — poor experience on slow connections
- No built-in video player (need to use `<video>` tag with MP4 source)
- Must handle upload size limits, validation, format checking yourself
- Poor mobile playback experience for large files
- No HLS/DASH support without additional tooling

**Verdict:** Best for MVP/prototype where cost is the primary concern and video quality isn't critical. Works well because these are submission videos viewed by judges (not a Netflix experience).

---

### Option 3: Bunny.net Stream

Bunny.net offers a purpose-built video streaming platform at very competitive pricing.

**Pricing:**
- **Storage:** $0.01/GB/month per replication region
- **Bandwidth:** $0.005/GB
- **Transcoding:** Free
- **Min monthly:** $1

**Per-Competition Cost (3-month retention):**

| Line Item | Calculation | Cost |
|---|---|---|
| Storage Month 1 | 400 GB × $0.01 | $4.00 |
| Storage Month 2 | 400 GB × $0.01 | $4.00 |
| Storage Month 3 | 400 GB × $0.01 | $4.00 |
| Bandwidth (delivery) | 2,100 GB × $0.005 | $10.50 |
| Transcoding | Free | $0.00 |
| **Total per competition** | | **~$23** |

**Annual estimate (5 competitions): ~$115**

**Pros:**
- Incredibly cheap — nearly as cheap as raw R2 but with full video platform features
- Free transcoding to HLS adaptive bitrate
- Built-in customizable video player (no branding)
- Global CDN with 119 PoPs
- Up to 4K support
- Simple REST API for uploads
- Webhook support for encoding status

**Cons:**
- External service (not in Cloudflare ecosystem)
- Adds a third-party dependency
- Need to manage API keys and integration
- No TUS (resumable upload) protocol — need to handle large uploads yourself or use their direct upload feature

---

### Option 4: Mux Video

Mux is a developer-focused video platform with excellent APIs and analytics.

**Pricing:**
- **Encoding:** Free at basic quality
- **Storage:** $0.003/min/month (with cold storage auto-enabled at ~60% discount)
- **Delivery:** $0.00096/min (100K free minutes/month)

**Per-Competition Cost (3-month retention):**

| Line Item | Calculation | Cost |
|---|---|---|
| Storage Month 1 | 30,000 min × $0.003 | $90 |
| Storage Month 2 (mostly cold) | 30,000 min × $0.0012 | $36 |
| Storage Month 3 (cold) | 30,000 min × $0.0012 | $36 |
| Delivery (after 100K free) | 110,000 min × $0.00096 | $106 |
| Encoding | Free (basic quality) | $0 |
| **Total per competition** | | **~$268** |

**Annual estimate (5 competitions): ~$1,340**

**Pros:**
- Excellent developer experience (best-in-class API)
- Free encoding at basic quality
- Cold storage auto-discount for old videos
- 100K free delivery minutes/month
- Built-in analytics (Mux Data)
- Excellent documentation
- Webhooks, signed URLs, DRM available

**Cons:**
- More expensive than Bunny.net
- Storage priced per minute (like Cloudflare Stream)
- External service

---

## Cost Summary

| Approach | Per Competition | Annual (5 comps) | Includes Transcoding | Includes Player | Ecosystem Fit |
|---|---|---|---|---|---|
| **Cloudflare Stream** | ~$660 | ~$3,300 | Yes | Yes | Native |
| **Cloudflare R2 (raw)** | ~$18 | ~$90 | No | No | Native |
| **Bunny.net Stream** | ~$23 | ~$115 | Yes | Yes | External |
| **Mux Video** | ~$268 | ~$1,340 | Yes | Yes | External |

### Recommendation

**For production: Cloudflare Stream** — It's the best fit given WODsmith is already fully built on Cloudflare (Workers, R2, D1, KV). The ~$660/competition cost is reasonable for a platform charging registration fees. Staying within one ecosystem simplifies ops, billing, auth, and debugging. The integration with Workers via bindings is seamless.

**Budget-conscious alternative: Bunny.net Stream** — At ~$23/competition, it's 97% cheaper than Cloudflare Stream with nearly identical features. The tradeoff is adding a third-party dependency and managing a separate integration.

**MVP/prototype: Cloudflare R2 raw** — At ~$18/competition, just store the MP4 files and serve them directly. No transcoding, no adaptive bitrate. Good enough for judge review where video quality isn't the primary concern. Can always upgrade to Stream later.

---

## Implementation Plan

### Recommended Approach: Cloudflare Stream

Cloudflare Stream supports "Direct Creator Uploads" — the server generates a one-time upload URL, and the client uploads directly to Cloudflare without the video passing through our Workers (which have a 100MB request body limit).

### Phase 1: Infrastructure Setup

#### 1.1 Enable Cloudflare Stream
- Enable Stream in the Cloudflare dashboard (pay-as-you-go)
- Purchase initial storage minutes (e.g., 50,000 min = $250)
- Stream is accessed via the Cloudflare API (not a Worker binding) using the Account ID + API Token

#### 1.2 Add Configuration
- Add `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_STREAM_API_TOKEN` to `.dev.vars` and production secrets
- Add these to `alchemy.run.ts` as secrets
- Run `pnpm cf-typegen` to update types

#### 1.3 Create Server Utility
```typescript
// src/lib/cloudflare-stream.ts
import { createServerOnlyFn } from '@tanstack/react-start'
import { env } from 'cloudflare:workers'

export const getStreamClient = createServerOnlyFn(() => ({
  accountId: env.CLOUDFLARE_ACCOUNT_ID,
  apiToken: env.CLOUDFLARE_STREAM_API_TOKEN,
  baseUrl: `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/stream`,
}))
```

### Phase 2: Database Schema Changes

#### 2.1 Extend Video Submissions Schema

```typescript
// In src/db/schemas/video-submissions.ts — add new columns:

// For direct uploads:
streamVideoUid: text('stream_video_uid'),      // Cloudflare Stream video UID
streamPlaybackUrl: text('stream_playback_url'), // HLS playback URL
streamThumbnailUrl: text('stream_thumbnail_url'), // Auto-generated thumbnail
uploadStatus: text('upload_status', {
  enum: ['pending', 'uploading', 'processing', 'ready', 'error']
}).default('pending'),
uploadType: text('upload_type', {
  enum: ['url', 'direct']                       // 'url' = legacy YouTube/Vimeo, 'direct' = self-hosted
}).default('url'),
fileSizeBytes: integer('file_size_bytes'),       // Track actual file size
durationSeconds: integer('duration_seconds'),    // Auto-detected by Stream
```

### Phase 3: Upload Flow (Server Functions)

#### 3.1 Create Direct Upload URL

```typescript
// src/server-fns/video-upload-fns.ts

export const createVideoUploadUrlFn = createServerFn({ method: 'POST' })
  .validator(z.object({
    registrationId: z.string(),
    trackWorkoutId: z.string(),
    maxDurationSeconds: z.number().default(1200), // 20 min default
  }))
  .handler(async ({ data }) => {
    // 1. Auth check — user must be registered for this competition
    // 2. Check submission window is open
    // 3. Create Direct Creator Upload via Cloudflare Stream API:
    //    POST /stream?direct_user=true
    //    Body: { maxDurationSeconds, meta: { registrationId, trackWorkoutId } }
    // 4. Create video_submissions row with status='pending', uploadType='direct'
    // 5. Return { uploadUrl, submissionId } to client
  })
```

#### 3.2 Webhook for Upload Completion

```typescript
// src/routes/api/stream-webhook.ts

// Cloudflare Stream sends webhooks when:
// - Video upload completes
// - Video transcoding finishes
// - Video is ready for playback

// Handler:
// 1. Verify webhook signature
// 2. Parse event type
// 3. On 'ready': Update video_submissions row with:
//    - streamPlaybackUrl (HLS URL)
//    - streamThumbnailUrl
//    - durationSeconds
//    - uploadStatus = 'ready'
// 4. On 'error': Set uploadStatus = 'error'
```

### Phase 4: Client-Side Upload Component

#### 4.1 Video Upload Component

```typescript
// src/components/compete/video-upload.tsx

// Using TUS protocol for resumable uploads:
// 1. Call createVideoUploadUrlFn to get upload URL
// 2. Use tus-js-client to upload directly to Cloudflare Stream
// 3. Show progress bar during upload
// 4. Poll or use webhook notification to detect processing completion
// 5. Show thumbnail preview when ready

// Key UX:
// - Drag-and-drop or click to select video file
// - File type validation (MP4, MOV, WebM, etc.)
// - File size warning (> 500MB)
// - Upload progress with percentage and ETA
// - Resume capability if connection drops
// - Cancel upload option
// - Processing spinner while transcoding
// - Thumbnail preview when ready
```

#### 4.2 Update Video Submission Form

Modify `src/components/compete/video-submission-form.tsx`:
- Add toggle or tab: "Upload Video" vs "Paste Video URL"
- When "Upload Video" is selected, show the VideoUpload component
- When "Paste URL" is selected, show existing VideoUrlInput
- Both paths lead to the same submission record

### Phase 5: Playback & Review

#### 5.1 Embed Player for Direct Uploads

```typescript
// src/components/compete/video-player.tsx

// For direct uploads (uploadType === 'direct'):
//   Use Cloudflare Stream embed: <Stream src={streamVideoUid} controls />
//   Or use iframe: <iframe src="https://customer-{code}.cloudflarestream.com/{uid}/iframe" />
//   Or use HLS.js with the streamPlaybackUrl

// For URL submissions (uploadType === 'url'):
//   Keep existing embed behavior (YouTube/Vimeo/Streamable oEmbed)
```

#### 5.2 Update Organizer Review UI

Modify organizer submission detail page to:
- Render Cloudflare Stream player for direct uploads
- Show upload status badge (pending/processing/ready/error)
- Show video duration and file size metadata
- Keep backward compatibility with URL-based submissions

### Phase 6: Lifecycle Management

#### 6.1 Video Cleanup (Cron)

```typescript
// Add to existing cron handler or create new scheduled function:
// - Query video_submissions where competition ended > 90 days ago
// - Delete videos from Cloudflare Stream via API
// - Update/clear stream fields in database
// - This prevents indefinite storage costs
```

#### 6.2 Competition-Level Settings

Add to competition settings:
- `allowDirectUpload: boolean` — enable/disable video uploads per competition
- `maxVideoDurationSeconds: number` — configurable per competition (default 1200 = 20 min)
- `maxVideoFileSizeMB: number` — configurable (default 2048 = 2GB)

### Implementation Phases Summary

| Phase | Effort | Description |
|---|---|---|
| Phase 1: Infrastructure | 1–2 days | Enable Stream, add secrets, create utility |
| Phase 2: Schema | 0.5 day | Add columns to video_submissions, push to D1 |
| Phase 3: Upload Server Fns | 2–3 days | Upload URL generation, webhook handler |
| Phase 4: Client Upload | 3–4 days | Upload component, progress UI, form integration |
| Phase 5: Playback | 1–2 days | Stream player component, organizer review updates |
| Phase 6: Lifecycle | 1–2 days | Cleanup cron, competition settings |
| **Total estimate** | **~9–13 days** | |

---

## Alternative: R2 Raw Storage (MVP Approach)

If cost is a primary concern, a simpler MVP using existing R2 infrastructure:

1. **Upload:** Extend existing `/api/upload` route with a `video-submission` purpose
   - Increase max file size to 2GB
   - Use multipart upload via R2's S3-compatible API
   - Store directly in R2 bucket under `videos/{competitionId}/{registrationId}/{timestamp}.mp4`
2. **Playback:** Serve MP4 directly from R2 public URL
   - Use HTML5 `<video>` tag — browsers handle MP4 progressive download natively
   - No adaptive bitrate, but works fine for judge review
3. **Cost:** ~$18 per competition vs ~$660 with Stream

**Tradeoffs:**
- No transcoding (athletes must upload compatible formats)
- No adaptive bitrate (slow on mobile with large files)
- No thumbnail generation
- Cloudflare Workers have a 100MB request body limit — need to use presigned URLs for direct R2 upload from the client, bypassing Workers entirely

**R2 + Cloudflare Containers (DIY transcoding):** If you want adaptive bitrate with R2, you could use Cloudflare Containers to run ffmpeg for transcoding. At ~$0.00002/vCPU-second, transcoding 2,000 videos would add ~$36–75 in compute costs, bringing the total to ~$55–95/competition. However, this requires significant engineering effort to build and maintain the transcoding pipeline, and Containers are still in public beta.

---

## Key Technical Considerations

1. **Workers 100MB Body Limit:** Videos CANNOT be uploaded through Workers. Must use either:
   - Cloudflare Stream Direct Creator Uploads (generates a URL the client uploads to)
   - R2 presigned URLs (S3-compatible, client uploads directly to R2)

2. **TUS Protocol:** Cloudflare Stream supports the TUS resumable upload protocol, critical for large video files over unreliable connections. The `tus-js-client` npm package handles this.

3. **Backward Compatibility:** The existing URL-based submission flow must continue to work. The `uploadType` field distinguishes between `'url'` (legacy) and `'direct'` (self-hosted).

4. **Duration Validation:** Cloudflare Stream can enforce `maxDurationSeconds` at upload time, automatically rejecting videos that exceed the limit.

5. **Signed URLs:** For private videos (pre-release leaderboards), Cloudflare Stream supports signed URLs with expiration — useful if competitions have embargo periods.

---

## Sources

- [Cloudflare Stream Pricing](https://developers.cloudflare.com/stream/pricing/)
- [Cloudflare R2 Pricing](https://developers.cloudflare.com/r2/pricing/)
- [Bunny.net Stream Pricing](https://bunny.net/pricing/stream/)
- [Mux Video Pricing](https://www.mux.com/pricing)
- [R2 Pricing Calculator](https://r2-calculator.cloudflare.com/)
- [Mux Pricing Calculator](https://www.mux.com/pricing/calculator)
