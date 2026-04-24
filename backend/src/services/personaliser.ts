import type { Tone, GenerateRequest, EnrichmentResult } from '../types/index.js'

export interface PromptContext {
  company_name: string
  offer: string
  tone: Tone
  industry?: string | undefined
  pain_points?: string[] | undefined
  signals?: string[] | undefined
  target_name?: string | undefined
  role?: string | undefined
  company_summary?: string | undefined
}

function stripHtml(input: string): string {
  return input.replace(/<[^>]*>?/gm, '')
}

function sanitiseString(input: string | undefined, maxLength: number): string | undefined {
  if (!input) return undefined;
  let clean = stripHtml(input).trim();
  if (clean.length > maxLength) {
    clean = clean.slice(0, maxLength);
  }
  return clean || undefined;
}

export function buildPromptContext(req: GenerateRequest, enrichment?: EnrichmentResult): PromptContext {
  return {
    company_name: sanitiseString(req.company_name, 100) as string,
    offer: sanitiseString(req.offer, 500) as string,
    tone: req.tone || 'direct',
    industry: sanitiseString(enrichment?.industry, 100),
    pain_points: enrichment?.pain_points?.map(p => sanitiseString(p, 200)).filter((p): p is string => !!p),
    signals: enrichment?.signals?.map(s => sanitiseString(s, 200)).filter((s): s is string => !!s),
    target_name: sanitiseString(req.target_name, 100),
    role: sanitiseString(req.role, 100),
    company_summary: sanitiseString(enrichment?.company_summary, 1000)
  }
}
