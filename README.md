# Community Pulse

A Farcaster Mini App that shows users their community-building metrics and emotional tone patterns computed from their cast activity.

## Features

### Community Outcomes (Replies-Based)
- **Activation**: New unique repliers in the selected time range
- **Retention**: % of previous period's repliers who came back
- **Conversation Depth**: Average replies per thread you start
- **Reciprocity**: Reply-back rate + mutual conversation partners

### Tone Drivers
- **Positive Rate**: % of your posts with positive sentiment
- **Rage Density**: Anger-flagged posts per 1,000 (with examples)
- **Agency Rate**: % of posts containing calls-to-action or commitments

### Actionable Insights
- "Try This Next Week" suggestions based on your metrics
- Top examples for rage/agency posts with explanations
- Links to view original casts on Warpcast

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: Neon Postgres (serverless)
- **ORM**: Drizzle
- **Cache**: Upstash Redis
- **Jobs**: Upstash QStash
- **Auth**: Neynar Sign-In with Farcaster (SIWF)
- **Data**: Neynar API
- **Classification**: Lexicon + Claude Haiku (batched)
- **Styling**: Tailwind CSS

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm
- Neynar API key ([get one here](https://neynar.com))
- Neon database ([create one here](https://neon.tech))
- Upstash Redis + QStash ([create here](https://upstash.com))
- Anthropic API key ([get one here](https://console.anthropic.com))

### Environment Variables

Create a `.env.local` file:

```bash
# Neynar
NEYNAR_API_KEY=your_neynar_api_key
NEXT_PUBLIC_NEYNAR_CLIENT_ID=your_neynar_client_id

# Database (Neon)
DATABASE_URL=postgres://user:pass@host/db?sslmode=require

# Upstash Redis
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_redis_token

# Upstash QStash
QSTASH_URL=https://qstash.upstash.io
QSTASH_TOKEN=your_qstash_token
QSTASH_CURRENT_SIGNING_KEY=your_signing_key
QSTASH_NEXT_SIGNING_KEY=your_next_signing_key

# Anthropic (for classification)
ANTHROPIC_API_KEY=your_anthropic_key

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
JWT_SECRET=your_random_jwt_secret_min_32_chars
```

### Installation

```bash
# Install dependencies
pnpm install

# Generate database migrations
pnpm db:generate

# Run migrations
pnpm db:migrate

# Start development server
pnpm dev
```

### Deploy to Vercel

```bash
# Install Vercel CLI
pnpm i -g vercel

# Deploy
vercel
```

## Project Structure

```
├── app/
│   ├── page.tsx                 # Landing / Frame entry
│   ├── dashboard/
│   │   └── page.tsx             # Main metrics dashboard
│   ├── api/
│   │   ├── auth/
│   │   │   └── route.ts         # SIWF authentication
│   │   ├── me/
│   │   │   ├── dashboard/
│   │   │   │   └── route.ts     # GET dashboard metrics
│   │   │   ├── refresh/
│   │   │   │   └── route.ts     # POST trigger refresh
│   │   │   └── posts/
│   │   │       └── route.ts     # GET filtered posts
│   │   └── jobs/
│   │       └── ingest/
│   │           └── route.ts     # QStash ingestion job
│   └── layout.tsx
├── components/
│   ├── MetricCard.tsx
│   ├── DriverBar.tsx
│   ├── ExampleTabs.tsx
│   ├── TryNextWeek.tsx
│   └── ...
├── lib/
│   ├── db/
│   │   ├── index.ts             # Drizzle client
│   │   └── schema.ts            # Database schema
│   ├── neynar/
│   │   └── client.ts            # Neynar API wrapper
│   ├── classify/
│   │   ├── index.ts             # Classification pipeline
│   │   ├── lexicon.ts           # Lexicon-based rules
│   │   └── llm.ts               # LLM fallback
│   ├── metrics/
│   │   └── compute.ts           # Metrics computation
│   ├── cache.ts                 # Redis caching
│   └── auth.ts                  # JWT utilities
└── drizzle/
    └── migrations/              # Generated migrations
```

## Architecture

```
User Signs In (SIWF)
       │
       ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Pull 1:    │───▶│  Pull 2:    │───▶│  Classify   │
│  User Casts │    │  Replies    │    │  (Batch)    │
│  (N=500)    │    │  to Roots   │    │             │
└─────────────┘    └─────────────┘    └─────────────┘
                                             │
                                             ▼
                                      ┌─────────────┐
                                      │  Postgres   │
                                      └──────┬──────┘
                                             │
       ┌─────────────────────────────────────┘
       │
       ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Compute    │───▶│   Cache     │───▶│   Render    │
│  On-Demand  │    │  (15 min)   │    │  Dashboard  │
└─────────────┘    └─────────────┘    └─────────────┘
```

## API Reference

### `GET /api/me/dashboard?range=30d`

Returns computed metrics for the authenticated user.

**Query Parameters:**
- `range`: `7d` | `30d` (default: `30d`)

**Response:**
```json
{
  "activation": { "value": 23, "change": 15 },
  "retention": { "value": 72, "change": -3 },
  "conversationDepth": { "avgReplies": 3.2, "pctWithReplies": 45 },
  "reciprocity": { "replyBackRate": 28, "mutualDyads": 34 },
  "agencyRate": { "value": 18, "postsWithActionReplies": 5 },
  "rageDensity": { "value": 35, "count": 12 },
  "positiveRate": { "value": 67 },
  "topExamples": {
    "rage": [...],
    "agency": [...]
  }
}
```

### `POST /api/me/refresh`

Triggers an incremental data refresh for the authenticated user.

**Response:**
```json
{
  "status": "queued",
  "jobId": "job_abc123"
}
```

### `GET /api/me/posts?label=rage&limit=20`

Returns filtered posts by classification label.

**Query Parameters:**
- `label`: `rage` | `agency` | `positive` | `negative`
- `limit`: number (default: 20, max: 100)
- `cursor`: pagination cursor

## Classification Approach

### Anger Detection
1. **Lexicon first**: High-confidence anger words/phrases trigger immediately
2. **LLM fallback**: Ambiguous cases sent to Claude Haiku in batches

### Agency Detection
- Pure rules-based (regex patterns)
- Detects: "I will", "let's", "join us", calls-to-action, commitments

### Sentiment
- LLM-based 3-way classification (positive/negative/neutral)
- Batched (20 posts per request) to minimize cost

### Cost
- ~$0.02 per user for initial classification (500 posts)
- ~$0.002 per refresh (50 new posts)
- Classifications cached forever (immutable)

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `MAX_CASTS` | 500 | Max casts to fetch per user |
| `MAX_REPLIES_PER_ROOT` | 100 | Max replies to fetch per thread |
| `DASHBOARD_CACHE_TTL` | 900 | Dashboard cache TTL in seconds |
| `CLASSIFICATION_BATCH_SIZE` | 20 | Posts per LLM batch |

## Development

```bash
# Run tests
pnpm test

# Type check
pnpm typecheck

# Lint
pnpm lint

# Format
pnpm format
```

## Limitations (MVP)

- English-only classification
- Replies-based metrics only (no likes/recasts)
- No network percentiles/comparisons
- No real-time updates (manual refresh)
- Max 500 casts analyzed per user

## Roadmap

- [ ] Hope Index (future-oriented positive content)
- [ ] Trust Gradient (composite metric)
- [ ] Daily aggregates for faster queries
- [ ] Likes/recasts support
- [ ] Network percentiles
- [ ] Webhook-based real-time updates
- [ ] Multi-language support

## License

MIT
