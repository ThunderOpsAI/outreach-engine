# Owner Actions & Infrastructure Setup

This document outlines the manual steps required to connect Outreach Engine to real infrastructure before local testing.

## 1. Supabase Setup (Database & Authentication)
1. Go to [supabase.com](https://supabase.com) and create a new project.
2. Once the project is provisioned, go to the **SQL Editor** in the Supabase dashboard.
3. Open `docs/schema.sql` and run the SQL there to create the application tables, RLS policies, signup trigger, and credit RPC helpers.
4. Confirm the following tables exist after the script runs: `profiles`, `projects`, `messages`, `templates`, `credit_events`.
5. In Supabase, go to **Authentication > Providers** and ensure **Email** is enabled. You may want to configure your Site URL and Redirect URLs under **Authentication > URL Configuration** (set Site URL to `http://localhost:3000` for local testing).
6. Go to **Project Settings > API**. You will need three values from here:
   - **Project URL**
   - **Project API Keys > anon / public**
   - **Project API Keys > service_role** (Keep this secret! Never put this in the frontend `.env.local`).

## 2. Anthropic Setup (LLM)
1. Go to the [Anthropic Console](https://console.anthropic.com/).
2. Add a payment method and generate a new API Key.
3. Keep this key safe. It will be used by the Python classifier and the TypeScript generator.

## 3. Redis Setup (Rate Limiting & Caching)
1. For local development, you need Redis running. 
   - On Mac: `brew install redis` and `brew services start redis`.
   - Alternatively, use Docker: `docker run -d -p 6379:6379 redis`.
2. For production, you can use Railway's Redis addon or Upstash.

## 4. Environment Variables Configuration
You need to create and populate three environment files in your project.

### Create `.env.local` (in the root directory for Next.js)
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
```

### Create `backend/.env` (in the backend folder)
```env
NODE_ENV=development
PORT=3001
SUPABASE_URL=your_supabase_project_url_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
REDIS_URL=redis://localhost:6379
ANTHROPIC_API_KEY=your_anthropic_api_key_here
APP_VERSION=1.0.0
```

### Create `.env` (in the root directory for Python scripts)
```env
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

## 5. Python Environment Setup
Since this project uses Python for scraping and classification, ensure your local environment is ready:
1. From the root directory, ensure you have Python 3.11+ installed.
2. Create and activate a local virtual environment:
   - `python3 -m venv venv`
   - `source venv/bin/activate`
3. Install the required packages: `pip install playwright beautifulsoup4 httpx anthropic python-dotenv`
4. Install Playwright browsers: `python -m playwright install chromium`

## 6. Ready for Testing
Once these steps are complete, the local environment is ready for backend, frontend, and end-to-end validation.
