# Outreach Engine — Project Handover

## Overview

Outreach Engine is a local-first MVP with three runtime pieces:

- `app/` — Next.js frontend for login, generation, templates, and export
- `backend/` — Express API for health checks, auth, credits, generation, and templates
- `scripts/` — Python scraping and enrichment pipeline used by the backend

The stack depends on Supabase for auth and persistence, Redis for rate limiting and enrichment caching, and Anthropic for message generation.

## Local Setup

### Required services

- Node.js 20+
- pnpm 9+
- Python 3.11+
- Redis on `redis://localhost:6379`
- Supabase project with Email auth enabled
- Anthropic API key

### Environment files

Create and populate:

- `.env.local`
- `backend/.env`
- `.env`

`docs/OWNER_ACTIONS.md` lists the required variables and setup steps. Database objects should be created from `docs/schema.sql`.

### Install commands

```bash
pnpm install
python3 -m venv venv
source venv/bin/activate
pip install playwright beautifulsoup4 httpx anthropic python-dotenv
python -m playwright install chromium
```

## Runbook

Start the backend:

```bash
pnpm backend
```

Start the frontend:

```bash
pnpm dev
```

Useful checks:

```bash
curl http://localhost:3001/health
pnpm typecheck
```

## Application Notes

### Authentication

- Frontend auth uses Supabase email magic links.
- The login flow redirects to `/auth/callback`, which exchanges the Supabase auth code for a session and redirects back to `/`.
- If the callback fails, the dashboard shows an auth error and the user should request a new magic link.

### Backend routes

- `GET /health` — checks Supabase, Redis, and Python pipeline presence
- `POST /api/v1/generate/outreach` — authenticated generation endpoint
- `GET /api/v1/templates` — list templates for the current user
- `POST /api/v1/templates` — save a template
- `DELETE /api/v1/templates/:id` — delete a template owned by the current user

### Credits

- Credits live in the `profiles` table.
- Generation calls use the `decrement_credit` RPC.
- Refunds use the `increment_credit` RPC, with a profile update fallback if the RPC is missing.
- Credit events are written to `credit_events`.

### Enrichment and generation

- Enrichment runs through `scripts/pipeline.py` and is time-boxed.
- Cached enrichment results are stored in Redis.
- Email, LinkedIn, and follow-up outputs are generated in parallel through Anthropic.
- If any individual generation branch fails, the API returns fallback content for the failed branch as long as at least one branch succeeds.

## Validation Checklist

- `pnpm typecheck` passes
- `GET /health` returns `ok` or explains any degraded dependency
- Magic-link login completes and lands back on the dashboard
- A generation request succeeds for an authenticated user
- Credits decrement as expected
- Save Template works
- JSON and CSV export work without runtime errors

## Maintenance Notes

- Keep `docs/schema.sql` aligned with any database-dependent backend changes.
- Do not expose `SUPABASE_SERVICE_ROLE_KEY` to the frontend.
- Redis must be reachable for the expected rate-limit and enrichment-cache behavior.
- If generation starts failing with JSON parse errors, inspect `backend/src/services/generator.ts` first.

## Known Issues For Follow-Up Testing

- Manual UI testing on `http://localhost:3002` has shown `POST /api/v1/generate/outreach` returning `400 Bad Request` during generation. Reproduce from the browser after login and confirm whether the payload, auth session, or backend validation path is responsible.
- `GET /favicon.ico` currently returns `404 Not Found` in local development. Add a favicon asset if that noise should be removed from the browser console.
- Repeated `chrome-extension://invalid/` resource failures were observed in the browser console during testing. Treat these as environment/browser-noise items to verify separately from core application behavior.
