# Outreach Engine — SRS v1

**Product:** Outreach Engine
**Type:** B2B outbound generation tool — backend-first API + minimal UI (Phase 2)
**Stack:** Next.js (App Router) · Node/Express backend · Supabase · Python scripts
**Status:** Pre-build. Agent consumes this + the Handover doc. Do not start without both.

---

## 1. Product Overview

Outreach Engine generates highly personalised cold email and LinkedIn outreach sequences for B2B sellers, founders, and agencies. It takes a target company + offer as input, scrapes and enriches context from the company website, and produces ready-to-use message sequences in under 2 seconds.

### Core value
- Cold email + LinkedIn messages: minutes → seconds
- Personalisation via live website enrichment (not static templates)
- Human-in-the-loop by design — no auto-send in MVP

### What it is NOT in MVP
- A campaign management platform
- An email sending platform
- A LinkedIn automation tool
- A CRM

---

## 2. User Stories

| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| U1 | Founder | Generate a cold email for a target company in seconds | I can spend time selling, not writing |
| U2 | Agency | Create personalised outreach for 10+ leads quickly | I can run campaigns without a copywriter |
| U3 | SDR | Get a full 5-email follow-up sequence | I don't miss follow-ups |
| U4 | User | Save and reuse my best templates | I build a personal playbook over time |
| U5 | User | Export messages as copy/CSV | I can use them in any tool I already have |

---

## 3. System Architecture

### 3.1 High-Level Flow

```
Client (Browser / API consumer)
        ↓
  Next.js App Router (UI + /api routes)
        ↓
  Express Backend (Railway)
        ↓
  ┌─────────────────────────────┐
  │        Request Pipeline     │
  │                             │
  │  1. Input Parser            │
  │  2. Enrichment Layer        │
  │     └─ Website Scraper      │
  │     └─ Metadata Extractor   │
  │     └─ Classifier           │
  │  3. Personalisation Engine  │
  │  4. Message Generator       │
  │     └─ Email (LLM call)     │
  │     └─ LinkedIn (LLM call)  │
  │     └─ Follow-up Sequence   │
  │  5. Output Formatter        │
  └─────────────────────────────┘
        ↓
  Supabase (Postgres + Auth)
        ↓
  Response → Client
```

### 3.2 Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | Next.js 14 (App Router) | Minimal UI in Phase 2 |
| Backend | Node.js + Express | Railway deployment |
| Database | Supabase (Postgres) | Auth + data |
| LLM | Anthropic Claude (claude-haiku-4-5 default) | claude-sonnet-4-6 for complex enrichment |
| Scraping | Python (Playwright + BeautifulSoup) | scripts/pipeline.py |
| Cache | Redis (Railway addon) | Scrape cache only — TTL 24h |
| Auth | Supabase Auth | JWT passed to backend |
| Storage | Supabase Storage | Template exports |

### 3.3 Folder Structure

```
outreach-engine/
│
├── app/                        # Next.js App Router
│   ├── layout.tsx
│   ├── page.tsx                # Landing / generate form (Phase 2)
│   └── api/                   # Next.js API routes (auth passthrough only)
│       └── auth/
│
├── components/                 # Reusable UI components (Phase 2)
│   ├── GenerateForm.tsx
│   ├── OutputCard.tsx
│   └── TemplateList.tsx
│
├── lib/                        # Frontend helpers
│   ├── supabase.ts             # Supabase client (browser)
│   ├── api.ts                  # Typed fetch wrappers to backend
│   └── utils.ts
│
├── backend/                    # Express API
│   ├── src/
│   │   ├── types/
│   │   │   └── index.ts        # ALL shared types
│   │   ├── middleware/
│   │   │   ├── auth.ts         # Supabase JWT validation
│   │   │   ├── rateLimit.ts    # Redis sliding window
│   │   │   └── requestId.ts    # ULID injection
│   │   ├── routes/
│   │   │   ├── generate.ts     # POST /generate/outreach
│   │   │   ├── templates.ts    # CRUD /templates
│   │   │   └── health.ts       # GET /health
│   │   ├── controllers/
│   │   │   └── generateController.ts
│   │   ├── services/
│   │   │   ├── enrichment.ts   # Calls Python scraper, parses result
│   │   │   ├── generator.ts    # LLM calls + prompt assembly
│   │   │   ├── personaliser.ts # Injects enrichment into prompts
│   │   │   └── credits.ts      # Credit check + deduction
│   │   └── db/
│   │       └── client.ts       # Supabase service-role client
│   ├── .env
│   └── server.ts
│
├── scripts/                    # Python scraping pipeline
│   ├── pipeline.py             # Main entry: scrape + classify + return JSON
│   ├── scraper.py              # Playwright + BeautifulSoup scraper
│   ├── classifier.py           # Industry + pain point classification
│   └── jobs/                   # Future: batch enrichment jobs
│
├── data/                       # Local temp outputs / test fixtures
│
├── docs/                       # SRS, handover, diagrams
│   ├── SRS.md                  # This file
│   └── HANDOVER.md
│
├── public/                     # Static assets
├── styles/                     # Tailwind config
│
├── .env.local                  # Frontend env vars (Supabase URL + anon key)
├── .gitignore
├── package.json
├── requirements.txt            # Python deps
└── README.md
```

---

## 4. Functional Requirements

### F1 — Input Interface

**Endpoint:** `POST /generate/outreach`

**Required fields:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| company_name | string | Yes | |
| offer | string | Yes | What the user is selling |
| company_url | string | No | Triggers enrichment if provided |
| target_name | string | No | Personalises salutation |
| role | string | No | Adjusts hook angle |
| tone | enum | No | `casual` \| `formal` \| `direct` (default: `direct`) |
| template_id | uuid | No | Apply saved template structure |

**Validation rules:**
- `company_name` min 2 chars, max 100
- `offer` min 5 chars, max 500
- `company_url` must be valid URL if provided
- `tone` must be one of the three enum values if provided

---

### F2 — Enrichment Layer

Triggered when `company_url` is provided. Times out at 3s — falls back to `company_name`-only generation gracefully.

**Scraper (`scripts/scraper.py`):**
- Fetches homepage via Playwright (JS-rendered pages supported)
- Extracts: `<title>`, `<meta description>`, `<h1>`–`<h3>` headings, first 500 words of body copy
- Max page size: 500KB — truncate beyond that
- User-agent: standard browser string (no bot identification)
- Timeout: 3000ms hard limit

**Classifier (`scripts/classifier.py`):**
- Input: raw scraped text
- LLM call (claude-haiku-4-5): classify industry, extract 2–3 inferred pain points, extract any recent signals (product launches, hiring, funding — if detectable from homepage)
- Output:

```json
{
  "industry": "string",
  "pain_points": ["string", "string"],
  "signals": ["string"],
  "company_summary": "string (1 sentence)"
}
```

**Enrichment cache:**
- Key: `SHA-256(company_url)`
- Redis TTL: 24 hours
- On cache hit: skip scraper, use cached enrichment

**Fallback (no URL or scrape failure):**
- Proceed with `company_name` + `offer` only
- Generator uses "inferred" prompting strategy (less specific but still personalised)
- No error returned to client — output is still produced

---

### F3 — Message Generation Engine

**All LLM calls use:** `claude-haiku-4-5` by default. Config flag to upgrade to `claude-sonnet-4-6` for quality mode.

**Three output blocks generated in parallel (Promise.all):**

#### F3a — Cold Email

```
Subject lines: 3 variants
  - Variant 1: curiosity/hook angle
  - Variant 2: direct value prop
  - Variant 3: company-specific reference (uses enrichment)

Body: 2 variants
  - Short (under 100 words): for cold prospects
  - Long (150–200 words): for warm or referred leads
```

#### F3b — LinkedIn Messages

```
Connection request (under 300 chars): 1 variant
Follow-up message 1 (post-connect, under 500 chars)
Follow-up message 2 (value add, under 500 chars)
Follow-up message 3 (breakup / re-engage, under 300 chars)
```

#### F3c — Email Follow-Up Sequence

```
Follow-up 1: Day 3 — reference original, add one new angle
Follow-up 2: Day 7 — social proof / case study angle
Follow-up 3: Day 14 — different value prop
Follow-up 4: Day 21 — ask for referral if not right fit
Follow-up 5: Day 30 — final breakup email
```

Each follow-up includes:
- Suggested send timing (day offset)
- Subject line variant
- Body (under 100 words each)

---

### F4 — Personalisation Engine

**Injection logic (in `services/personaliser.ts`):**

Priority order for what gets injected into the LLM prompt:

1. If enrichment available: company summary + top pain point + any signal
2. If role provided: role-specific hook angle (e.g. "As a Head of Sales, you're probably...")
3. If target_name provided: personalised salutation
4. Tone modifier applied to all outputs
5. Offer is always present as the value core

**Prompt construction:**

```
System: You are an expert B2B copywriter. Write in {tone} tone. Be concise. No fluff.

Context:
- Company: {company_name}
- Industry: {industry}
- Pain points: {pain_points}
- Recent signals: {signals}
- Target role: {role}
- Our offer: {offer}

Generate: [task-specific instructions per F3a/b/c]
```

---

### F5 — Output Layer (MVP)

**Export modes:**

| Mode | MVP | Notes |
|------|-----|-------|
| Copy to clipboard | Yes | Per message block |
| Download as JSON | Yes | Full output object |
| Download as CSV | Yes | One row per message |
| Email send (SMTP) | No | v1.1 |
| LinkedIn automation | No | Never in MVP |

**Response shape** (see §6 API Design for full schema)

---

### F6 — Template System

Users can save a generation output as a template.

**Template data structure:**

```typescript
interface Template {
  id: string          // UUID
  user_id: string
  name: string        // user-defined label
  tone: Tone
  structure: {
    email_short: string     // prompt modifier / preferred structure
    email_long: string
    linkedin_connect: string
    followup_style: string
  }
  created_at: string
  updated_at: string
}
```

Templates are applied as structural modifiers to the prompt — they don't override enrichment.

---

## 5. Data Model (Supabase / Postgres)

### users
(Managed by Supabase Auth — extend with profiles table)

```sql
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id),
  email       TEXT NOT NULL,
  plan        TEXT NOT NULL DEFAULT 'free',  -- 'free' | 'pro' | 'agency'
  credits     INTEGER NOT NULL DEFAULT 10,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

### projects

```sql
CREATE TABLE projects (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES profiles(id),
  company_name  TEXT NOT NULL,
  company_url   TEXT,
  offer         TEXT NOT NULL,
  enrichment    JSONB,            -- cached enrichment output
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

### messages

```sql
CREATE TABLE messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id),
  type        TEXT NOT NULL,      -- 'email_short' | 'email_long' | 'linkedin_connect' | 'followup_1'...'followup_5' | 'subject_1'...'subject_3' | 'linkedin_followup_1'...'3'
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

### templates

```sql
CREATE TABLE templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES profiles(id),
  name          TEXT NOT NULL,
  tone          TEXT NOT NULL DEFAULT 'direct',
  structure     JSONB NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
```

### credit_events

```sql
CREATE TABLE credit_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id),
  delta       INTEGER NOT NULL,   -- negative for spend, positive for top-up
  reason      TEXT NOT NULL,      -- 'generation' | 'purchase' | 'refund' | 'signup_bonus'
  project_id  UUID REFERENCES projects(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

### Row Level Security (RLS)
Enable RLS on all tables. Policy: `user_id = auth.uid()` for all SELECT/INSERT/UPDATE/DELETE.

---

## 6. API Design

### Base URL
`/api/v1` (Express backend)

### Authentication
All routes (except `/health`) require: `Authorization: Bearer <supabase_jwt>`

Backend validates JWT against Supabase public key.

---

### POST /generate/outreach

**Request:**

```typescript
{
  company_name: string          // required
  offer: string                 // required
  company_url?: string
  target_name?: string
  role?: string
  tone?: 'casual' | 'formal' | 'direct'
  template_id?: string
}
```

**Response (200):**

```typescript
{
  request_id: string            // ULID
  project_id: string            // UUID — saved to DB
  enrichment_used: boolean
  generation_time_ms: number
  output: {
    email: {
      subjects: [string, string, string]
      body_short: string
      body_long: string
    }
    linkedin: {
      connect: string
      followup_1: string
      followup_2: string
      followup_3: string
    }
    followups: Array<{
      day: number
      subject: string
      body: string
    }>
  }
  credits_remaining: number
}
```

**Error responses:**

| Code | Error code | Condition |
|------|-----------|-----------|
| 400 | INVALID_REQUEST | Validation failure |
| 401 | UNAUTHORISED | Missing/invalid JWT |
| 402 | NO_CREDITS | Credit balance = 0 |
| 429 | RATE_LIMITED | RPM exceeded |
| 500 | GENERATION_FAILED | LLM call failed after retries |
| 503 | SERVICE_UNAVAILABLE | Scraper timeout — should NOT happen (fallback absorbs this) |

---

### GET /templates

Returns all templates for the authenticated user.

**Response:**
```typescript
{ templates: Template[] }
```

---

### POST /templates

Save a new template.

**Request:** `{ name: string, tone: Tone, structure: TemplateStructure }`
**Response:** `{ template: Template }`

---

### DELETE /templates/:id

Delete a template. Returns `204`.

---

### GET /health

No auth required.

```typescript
{
  status: 'ok' | 'degraded',
  version: string,
  uptime: number,
  checks: {
    supabase: 'ok' | 'fail',
    redis: 'ok' | 'fail',
    scraper: 'ok' | 'fail'
  }
}
```

---

## 7. Credits System

### Allocation

| Plan | Monthly credits | Cost per generation |
|------|----------------|---------------------|
| Free | 10 (one-time signup) | 1 credit |
| Pro ($19/mo) | 200/mo | 1 credit |
| Agency ($49/mo) | Unlimited | — |

### Logic

1. On request: check `profiles.credits > 0` (or plan = 'agency')
2. Deduct 1 credit atomically in Supabase before generation
3. If deduction fails (race condition): return `402`
4. On generation failure: refund 1 credit, log `credit_events` with `reason: 'refund'`

---

## 8. Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| Total response time (with enrichment) | < 5s |
| Total response time (without enrichment) | < 2s |
| Scraper timeout | 3s hard limit |
| LLM call timeout | 10s per call |
| Stateless backend | Yes — no in-memory state |
| Concurrent generation per user | Max 2 (enforced by rate limit) |
| Uptime target | 99% (Railway) |

---

## 9. Failure Handling

| Failure | Behaviour |
|---------|-----------|
| Scraper timeout (> 3s) | Fall back to name-only generation — no error to client |
| Scraper returns empty | Same fallback — log warning |
| LLM call fails | Retry once. On second failure: return `500 GENERATION_FAILED`, refund credit |
| Supabase down | Return `503` — do not generate (can't save or debit) |
| Redis down | Continue without cache — log warning, scraper runs fresh |
| All three LLM calls (Promise.all) fail | Return `500`, refund credit |
| One of three LLM calls fails | Return partial response with missing block marked `null`, partial credit refund (0.5) |

---

## 10. Security

- All JWTs validated server-side against Supabase project URL
- Supabase service-role key is backend-only (never exposed to frontend)
- RLS enforced on all tables — users can only access their own data
- Input sanitised before LLM prompt injection (strip HTML, limit length)
- Company URLs validated before scraping (block localhost, internal IPs, private ranges)
- Rate limiting: Free = 5 RPM, Pro = 20 RPM, Agency = 60 RPM
- Scraper runs in isolated Python process — no shell injection possible from user input

---

## 11. Compliance & Risk

| Risk | Mitigation |
|------|-----------|
| CAN-SPAM / GDPR | Tool generates copy only — sending is user's responsibility. ToS must state this. |
| LinkedIn ToS | No automation in MVP. Manual copy only. ToS must state this. |
| Scraping ToS violations | Only scrapes public homepage. Respects 3s timeout. No crawling beyond root URL. |
| Prompt injection via company URL content | Scrape output is summarised by LLM before prompt injection — raw content never directly interpolated. |
| Credit abuse | Atomic deduction before generation. JWT auth on all routes. |

---

## 12. Monetisation

| Tier | Price | Credits | Target user |
|------|-------|---------|-------------|
| Free | $0 | 10 lifetime | Try before buy |
| Pro | $19/mo | 200/mo | Solo founder / SDR |
| Agency | $49/mo | Unlimited | Agencies / power users |

**Revenue mechanics:**
- Stripe for subscription billing
- Credits tracked in Supabase `profiles.credits`
- Webhook from Stripe → update plan + credits on successful payment

---

## 13. MVP Scope

### In scope
- `POST /generate/outreach` — full pipeline
- Enrichment (scrape + classify) with fallback
- All three output types (email, LinkedIn, follow-up)
- Credits system
- Template save/load
- JSON + CSV export
- Auth (Supabase)

### Out of scope (v1.1+)
- Email sending (SMTP)
- LinkedIn automation
- Campaign management / tracking
- Analytics dashboard
- Team/multi-seat accounts
- Bulk generation (CSV input)

---

## 14. Success Metrics

| Metric | Target (30 days post-launch) |
|--------|------------------------------|
| Signups | 100 |
| Paid conversions | 10 |
| Generations per active user | > 5 |
| Average response time | < 3s |
| Credit-to-paid conversion rate | > 15% |

---

## END OF SRS v1
