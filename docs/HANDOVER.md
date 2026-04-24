# Outreach Engine — Agent Handover v1

You are a senior full-stack engineer. Your job is to build the Outreach Engine MVP.

Read **SRS.md** in full before starting. This document tells you *how to work* — the SRS tells you *what to build*. Both are required. Do not begin Phase 1 until you have read both.

---

## RULES (non-negotiable)

- DO NOT over-engineer. Build what the SRS specifies. Nothing extra.
- FOLLOW the folder structure in SRS §3.3 exactly.
- COMMIT after every phase. Do not carry un-committed work into the next phase.
- USE TypeScript strict mode for all backend and frontend code.
- USE ULID (not UUID v4) for request IDs.
- USE pnpm for JS dependencies.
- USE Supabase Auth — do not build your own auth.
- NEVER expose the Supabase service-role key to the frontend.
- NEVER use `any` in TypeScript.
- DO NOT add a UI in Phases 0–5. The UI is Phase 6+.
- FAIL SAFE > clever. If in doubt, return an error, not a guess.

---

## GIT STRATEGY

```
main                  ← stable, deployable
  └─ feature/phase-N  ← one branch per phase
```

After each phase:
1. Run `pnpm typecheck` — must be zero errors
2. Run `pnpm test` — must pass
3. `git add -A && git commit -m "phase N: <summary>"`
4. Merge to `main` only if all checks pass
5. Do NOT start Phase N+1 if Phase N tests are failing

**Rollback:** `git revert` the merge commit. Do not carry broken state forward.

---

## ENVIRONMENT SETUP (do this before Phase 0)

```bash
# 1. Verify tooling
node --version       # must be 20.x
pnpm --version       # must be 9.x
python --version     # must be 3.11+

# 2. Create project
mkdir outreach-engine && cd outreach-engine
git init
pnpm init

# 3. Create folder structure (FIRST TASK — see Phase 0)

# 4. Install JS dependencies
pnpm add next react react-dom
pnpm add express @supabase/supabase-js ioredis ulid zod
pnpm add -D typescript tsx @types/node @types/express vitest

# 5. Install Python dependencies
pip install playwright beautifulsoup4 httpx anthropic python-dotenv
playwright install chromium

# 6. Init Supabase
# Create project at supabase.com, copy URL + anon key + service-role key

# 7. Copy .env files (see §ENV VARIABLES below)
```

Confirm: `npx tsx backend/server.ts` starts without error before Phase 1.

---

## PHASE 0 — Folder Structure + Schema

**This is always the first task. Do not skip it.**

### Task: Build the exact folder structure from SRS §3.3

Create every file and folder listed. For files that don't have content yet, create them with a single comment: `// TODO: Phase N`

```bash
# Folders to create:
mkdir -p app/api/auth
mkdir -p components
mkdir -p lib
mkdir -p backend/src/types
mkdir -p backend/src/middleware
mkdir -p backend/src/routes
mkdir -p backend/src/controllers
mkdir -p backend/src/services
mkdir -p backend/src/db
mkdir -p scripts/jobs
mkdir -p data
mkdir -p docs
mkdir -p public
mkdir -p styles
```

### Task: Create Supabase schema

Run these SQL migrations in Supabase SQL editor (in order):

```sql
-- 1. Profiles (extends Supabase auth.users)
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id),
  email       TEXT NOT NULL,
  plan        TEXT NOT NULL DEFAULT 'free',
  credits     INTEGER NOT NULL DEFAULT 10,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- 2. Projects
CREATE TABLE projects (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company_name  TEXT NOT NULL,
  company_url   TEXT,
  offer         TEXT NOT NULL,
  enrichment    JSONB,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own projects" ON projects FOR ALL USING (auth.uid() = user_id);

-- 3. Messages
CREATE TABLE messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own messages" ON messages FOR ALL USING (
  auth.uid() = (SELECT user_id FROM projects WHERE id = messages.project_id)
);

-- 4. Templates
CREATE TABLE templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  tone          TEXT NOT NULL DEFAULT 'direct',
  structure     JSONB NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own templates" ON templates FOR ALL USING (auth.uid() = user_id);

-- 5. Credit events
CREATE TABLE credit_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  delta       INTEGER NOT NULL,
  reason      TEXT NOT NULL,
  project_id  UUID REFERENCES projects(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE credit_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own credit events" ON credit_events FOR SELECT USING (auth.uid() = user_id);

-- 6. Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
```

**Success criteria:**
- All folders exist as per SRS §3.3
- All tables visible in Supabase dashboard with correct columns
- RLS enabled on all tables
- `pnpm typecheck` runs without error (even with empty files)

**Commit:** `git commit -m "phase 0: folder structure, schema, RLS"`

---

## PHASE 1 — Backend Skeleton + Health Route

**Files to create:**

- `backend/src/types/index.ts` — all shared types (see SRS §6 for shapes)
- `backend/src/middleware/requestId.ts` — ULID injection
- `backend/src/middleware/auth.ts` — Supabase JWT validation
- `backend/src/middleware/rateLimit.ts` — Redis sliding window
- `backend/src/db/client.ts` — Supabase service-role client
- `backend/src/routes/health.ts` — `GET /health`
- `backend/server.ts` — Express app, register middleware + routes

### `backend/src/types/index.ts`

Define ALL of these types — no others needed for MVP:

```typescript
export type Tone = 'casual' | 'formal' | 'direct'
export type Plan = 'free' | 'pro' | 'agency'

export interface GenerateRequest {
  company_name: string
  offer: string
  company_url?: string
  target_name?: string
  role?: string
  tone?: Tone
  template_id?: string
}

export interface EnrichmentResult {
  industry: string
  pain_points: string[]
  signals: string[]
  company_summary: string
}

export interface EmailOutput {
  subjects: [string, string, string]
  body_short: string
  body_long: string
}

export interface LinkedInOutput {
  connect: string
  followup_1: string
  followup_2: string
  followup_3: string
}

export interface FollowUp {
  day: number
  subject: string
  body: string
}

export interface GenerateOutput {
  email: EmailOutput
  linkedin: LinkedInOutput
  followups: FollowUp[]
}

export interface GenerateResponse {
  request_id: string
  project_id: string
  enrichment_used: boolean
  generation_time_ms: number
  output: GenerateOutput
  credits_remaining: number
}

export type ErrorCode =
  | 'INVALID_REQUEST'
  | 'UNAUTHORISED'
  | 'NO_CREDITS'
  | 'RATE_LIMITED'
  | 'GENERATION_FAILED'
  | 'SERVICE_UNAVAILABLE'

export interface GatewayError {
  code: ErrorCode
  message: string
  request_id: string
}

export interface UserContext {
  user_id: string
  plan: Plan
  credits: number
}
```

### `backend/src/middleware/auth.ts`

```typescript
// 1. Extract Bearer token from Authorization header
// 2. Call supabase.auth.getUser(token)
// 3. On error: return 401 { code: 'UNAUTHORISED' }
// 4. Fetch profile from profiles table (need plan + credits)
// 5. Attach { user_id, plan, credits } to req.user
// 6. Call next()
```

### `backend/src/middleware/rateLimit.ts`

```typescript
// Redis sliding window: key = ratelimit:{user_id}
// Limits by plan: free=5rpm, pro=20rpm, agency=60rpm
// On breach: return 429 { code: 'RATE_LIMITED', retryAfter: N }
// Redis down: log warning, allow request (fail open)
```

### `backend/server.ts`

```typescript
// Express app
// Register: cors, helmet, json body parser
// Register middleware: requestId, auth (on all routes except /health)
// Mount routes: /health, /api/v1/generate, /api/v1/templates
// Listen on process.env.PORT || 3001
```

**Success criteria:**
- `curl localhost:3001/health` returns `{"status":"ok",...}`
- Request without auth header returns `401`
- `pnpm typecheck` zero errors

**Commit:** `git commit -m "phase 1: backend skeleton, health, auth, rate limit"`

---

## PHASE 2 — Scraper + Enrichment

**Files to create:**

- `scripts/scraper.py`
- `scripts/classifier.py`
- `scripts/pipeline.py`
- `backend/src/services/enrichment.ts`

### `scripts/scraper.py`

```python
# Input (argv or stdin JSON): { "url": "https://..." }
# Uses Playwright (headless Chromium)
# Timeout: 3000ms
# Extracts: title, meta description, h1-h3 headings, first 500 words body
# Validates URL: reject localhost, 127.x, 10.x, 192.168.x (SSRF protection)
# Output (stdout JSON): { "title": "", "meta": "", "headings": [], "body": "" }
# On failure: { "error": "SCRAPE_FAILED", "reason": "..." }
```

### `scripts/classifier.py`

```python
# Input (argv or stdin JSON): { "scraped": {...} }
# Calls Anthropic API (claude-haiku-4-5)
# System prompt: "You are a B2B intelligence analyst. Return only valid JSON."
# Task: classify industry, extract 2-3 pain points, extract signals
# Output (stdout JSON): EnrichmentResult shape (see SRS §F2)
# On LLM failure: return { "industry": "Unknown", "pain_points": [], "signals": [], "company_summary": "" }
```

### `scripts/pipeline.py`

```python
# Orchestrates scraper → classifier
# Input: { "url": "..." }
# Calls scraper.py → passes output to classifier.py
# Hard timeout: 3000ms total (use asyncio with timeout)
# Output: EnrichmentResult JSON to stdout
# On any failure: return empty EnrichmentResult (never raise to caller)
```

### `backend/src/services/enrichment.ts`

```typescript
// 1. Check Redis cache: key = SHA-256(url), TTL = 24h
// 2. On hit: return cached EnrichmentResult
// 3. On miss: spawn Python process: `python scripts/pipeline.py`
//    Pass input via stdin (JSON)
//    Capture stdout, parse as EnrichmentResult
//    Timeout: 3000ms — kill process on timeout
// 4. Store result in Redis
// 5. Return result (or empty result on any failure — never throw)
```

**SSRF protection (validate before scraping):**
```typescript
// Block: localhost, 127.x.x.x, 10.x.x.x, 192.168.x.x, 169.254.x.x
// Block: non-http/https schemes
// Block: URLs longer than 2048 chars
// If invalid: return empty EnrichmentResult silently
```

**Success criteria:**
- `python scripts/pipeline.py` with a real URL returns valid JSON enrichment
- `enrichment.ts` caches result — second call returns cache hit
- Timeout test: fake URL with 5s delay → falls back within 3s
- SSRF test: `localhost` URL → rejected silently

**Commit:** `git commit -m "phase 2: scraper, classifier, enrichment service"`

---

## PHASE 3 — Message Generator

**Files to create:**

- `backend/src/services/personaliser.ts`
- `backend/src/services/generator.ts`

### `backend/src/services/personaliser.ts`

```typescript
// Assembles the LLM context object from request + enrichment
// Returns: PromptContext (internal type — not exported in API response)
interface PromptContext {
  company_name: string
  offer: string
  tone: Tone
  industry?: string
  pain_points?: string[]
  signals?: string[]
  target_name?: string
  role?: string
  company_summary?: string
}
// Priority: enrichment data > role > target_name > tone > offer
// Sanitise all string inputs before including in prompts:
//   strip HTML tags, truncate to max lengths, trim whitespace
```

### `backend/src/services/generator.ts`

```typescript
// Three functions run in parallel via Promise.all:
// 1. generateEmail(ctx: PromptContext): Promise<EmailOutput>
// 2. generateLinkedIn(ctx: PromptContext): Promise<LinkedInOutput>
// 3. generateFollowUps(ctx: PromptContext): Promise<FollowUp[]>

// Each makes one Anthropic API call (claude-haiku-4-5)
// Response must be valid JSON — prompt must instruct model to return ONLY JSON
// Parse response: strip ```json fences if present, then JSON.parse
// On parse failure: retry ONCE with stricter JSON prompt
// On second failure: throw GenerationError

// Timeout per call: 10s
// All three calls fire simultaneously (Promise.all)
// If one fails: return null for that block, log error
```

**Prompts — include these exact structures:**

Email prompt:
```
Return ONLY a JSON object. No explanation. No markdown.
Schema: { "subjects": [string, string, string], "body_short": string, "body_long": string }

Context: [inject PromptContext]
Write 3 subject line variants and 2 email bodies (short <100 words, long 150-200 words).
Tone: {tone}. No fluff. No generic openers like "I hope this finds you well."
```

LinkedIn prompt:
```
Return ONLY a JSON object. No explanation. No markdown.
Schema: { "connect": string, "followup_1": string, "followup_2": string, "followup_3": string }

connect must be under 300 chars.
followup_1, followup_2 must be under 500 chars.
followup_3 must be under 300 chars (breakup / re-engage).
Tone: {tone}.
Context: [inject PromptContext]
```

Follow-up sequence prompt:
```
Return ONLY a JSON array. No explanation. No markdown.
Schema: Array of { "day": number, "subject": string, "body": string }
5 follow-ups. Days: 3, 7, 14, 21, 30.
Each body under 100 words. Each has a unique angle (do not repeat the original pitch).
Tone: {tone}.
Context: [inject PromptContext]
```

**Success criteria:**
- `generator.ts` returns valid `GenerateOutput` for a test input
- All three sub-calls succeed in < 8s combined
- If one sub-call fails, others still return (partial result, not total failure)
- JSON parse handles model wrapping output in ```json fences
- TypeScript: zero errors

**Commit:** `git commit -m "phase 3: personaliser, generator"`

---

## PHASE 4 — Credits + Generate Route

**Files to create:**

- `backend/src/services/credits.ts`
- `backend/src/controllers/generateController.ts`
- `backend/src/routes/generate.ts`

### `backend/src/services/credits.ts`

```typescript
export async function checkAndDeductCredit(userId: string, plan: Plan): Promise<number>
// If plan === 'agency': return credits without deducting (unlimited)
// Else: attempt atomic decrement via Supabase RPC
// If credits = 0: throw GatewayError { code: 'NO_CREDITS' }
// On success: return new credit balance
// Log credit_events row: delta=-1, reason='generation'

export async function refundCredit(userId: string, projectId: string): Promise<void>
// Increment credits by 1
// Log credit_events row: delta=+1, reason='refund', project_id
```

**Supabase RPC for atomic decrement (create in SQL editor):**

```sql
CREATE OR REPLACE FUNCTION decrement_credit(user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  new_credits INTEGER;
BEGIN
  UPDATE profiles
  SET credits = credits - 1
  WHERE id = user_id AND credits > 0
  RETURNING credits INTO new_credits;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NO_CREDITS';
  END IF;

  RETURN new_credits;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### `backend/src/controllers/generateController.ts`

Full pipeline orchestration:

```typescript
// 1. Validate request body (Zod schema matching SRS §F1)
// 2. Check + deduct credit (credits.ts)
// 3. If company_url: run enrichment (enrichment.ts) — non-blocking, 3s timeout
// 4. Build PromptContext (personaliser.ts)
// 5. Run generator (generator.ts) — all 3 calls in parallel
// 6. Save project + messages to Supabase (async, non-blocking to response)
// 7. Return GenerateResponse
// On any generation error: refund credit, return 500
// Attach X-Request-Id, X-Generation-Time-Ms headers to response
```

**Zod schema:**

```typescript
const GenerateSchema = z.object({
  company_name: z.string().min(2).max(100),
  offer: z.string().min(5).max(500),
  company_url: z.string().url().optional(),
  target_name: z.string().max(100).optional(),
  role: z.string().max(100).optional(),
  tone: z.enum(['casual', 'formal', 'direct']).optional().default('direct'),
  template_id: z.string().uuid().optional()
})
```

**Success criteria:**
- `POST /api/v1/generate/outreach` with valid body returns full `GenerateResponse`
- Credit is deducted from `profiles` table on each call
- Credit is refunded if generation fails
- Agency plan: credits not deducted
- Free plan with 0 credits: returns `402 NO_CREDITS`
- Response time < 5s with enrichment, < 2s without

**Commit:** `git commit -m "phase 4: credits, generate route, full pipeline"`

---

## PHASE 5 — Templates Route + Export

**Files to create:**

- `backend/src/routes/templates.ts`
- Template export endpoints (add to generate route response)

### Templates CRUD

```typescript
GET    /api/v1/templates          → list all for auth user
POST   /api/v1/templates          → create new template
DELETE /api/v1/templates/:id      → delete (verify ownership first)
```

All endpoints validate JWT (already handled by auth middleware).

### Export endpoints (add to generate controller)

After generation, the response already contains the full output. Frontend handles copy/download. No additional backend endpoints needed for MVP export.

For CSV download: add a helper in `lib/utils.ts` (frontend) that converts `GenerateOutput` to CSV string client-side.

**Success criteria:**
- Template CRUD all work with valid auth
- DELETE on another user's template returns `403`
- `pnpm test` covers all template route branches

**Commit:** `git commit -m "phase 5: templates CRUD"`

---

## PHASE 6 — Minimal UI (Next.js)

**Only build what is needed to use the product.** No polish, no animations, no marketing copy.

**Files to create:**

- `app/page.tsx` — Generate form
- `app/layout.tsx` — Supabase auth provider wrapper
- `components/GenerateForm.tsx` — Input form
- `components/OutputCard.tsx` — Displays one message block with copy button
- `components/TemplateList.tsx` — List + apply saved templates
- `lib/supabase.ts` — Supabase browser client
- `lib/api.ts` — Typed fetch wrappers to backend

### Generate form fields (matches SRS §F1)

```
Company Name (required)
Offer / Service (required)
Company URL (optional)
Target Name (optional)
Role/Title (optional)
Tone: [Casual] [Formal] [Direct] (radio buttons, default Direct)
[Generate →] button
```

### Output layout

```
[Email Section]
  Subject Lines: 3 variants with copy buttons
  Short Body: textarea + copy button
  Long Body: textarea + copy button

[LinkedIn Section]
  Connect Message: textarea + copy button
  Follow-up 1/2/3: textarea + copy buttons

[Follow-Up Sequence]
  Day 3 / Day 7 / Day 14 / Day 21 / Day 30 — each with subject + body + copy

[Export]
  [Download JSON] [Download CSV]

[Save as Template]
  Name input + [Save] button
```

**State management:** React `useState` only. No external state library.

**Auth:** Supabase `@supabase/auth-helpers-nextjs`. Show login screen if not authenticated. Magic link email login only (no passwords in MVP).

**Success criteria:**
- Can sign up, log in, generate outreach, see output, copy messages
- Download JSON + CSV both work
- Credits remaining displayed after generation
- Mobile-responsive (basic Tailwind breakpoints, nothing fancy)

**Commit:** `git commit -m "phase 6: minimal UI"`

---

## ENV VARIABLES

### `.env.local` (Next.js frontend)

```plaintext
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
```

### `backend/.env`

```plaintext
NODE_ENV=development
PORT=3001

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx   # NEVER expose to frontend

# Redis
REDIS_URL=redis://localhost:6379

# Anthropic
ANTHROPIC_API_KEY=xxx

# App
APP_VERSION=1.0.0
```

### `.env` (Python scripts)

```plaintext
ANTHROPIC_API_KEY=xxx
```

---

## DEPLOYMENT

### Railway services
- `backend` — Express API (`node dist/server.js`)
- `redis` — Railway Redis addon
- `frontend` — Next.js (or deploy to Vercel)

### Supabase
- Use Supabase cloud (free tier sufficient for MVP)

### GitHub Actions (on push to main)
```yaml
- pnpm install
- pnpm typecheck
- pnpm test
- railway deploy (backend)
- vercel deploy (frontend)  # or railway
```

---

## TESTING REQUIREMENTS

| Type | Tool | What to cover |
|------|------|---------------|
| Unit | Vitest | generator.ts, personaliser.ts, credits.ts |
| Integration | Vitest | generate route (mock Anthropic + Supabase) |
| Manual | curl / Postman | Full pipeline end-to-end |

**Key test cases:**
- Generate with URL → enrichment used = true
- Generate without URL → enrichment used = false
- Free user 0 credits → 402
- Agency user → never 402
- Scraper timeout → fallback, no error
- LLM failure → credit refunded
- Invalid URL in company_url → 400
- SSRF URL (localhost) → blocked, fallback used

---

## FULL MVP SUCCESS CHECKLIST

Before calling this done:

- [ ] `POST /generate/outreach` returns full output (email + LinkedIn + 5 follow-ups)
- [ ] Enrichment runs when URL provided, falls back gracefully when not
- [ ] All three LLM calls run in parallel
- [ ] Credits deducted on generation, refunded on failure
- [ ] Agency plan: never blocked by credits
- [ ] Template save/load works
- [ ] Auth: unauthenticated requests return 401
- [ ] Rate limiting: exceeding RPM returns 429 with Retry-After
- [ ] SSRF: localhost + internal IPs rejected
- [ ] `GET /health` returns 200 with all checks
- [ ] `pnpm typecheck` zero errors
- [ ] All unit tests pass
- [ ] Response < 2s without enrichment, < 5s with enrichment
- [ ] UI: can generate + copy + download + save template

---

## DO NOT

- Add a marketing homepage
- Add analytics tracking
- Add email sending (SMTP) — that is v1.1
- Add LinkedIn automation — that is never in MVP
- Use `any` in TypeScript
- Store Supabase service-role key in frontend env
- Make synchronous DB writes that block the response
- Add any feature not in SRS §13 MVP scope

---

## START WITH PHASE 0
