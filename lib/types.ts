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