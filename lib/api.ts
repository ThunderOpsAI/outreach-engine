import type { GenerateRequest, GenerateResponse } from './types.js'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'

export async function generateOutreach(request: GenerateRequest): Promise<GenerateResponse> {
  const response = await fetch(`${BACKEND_URL}/api/v1/generate/outreach`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || 'Generation failed')
  }

  return response.json()
}

export interface Template {
  id: string
  name: string
  tone: string
  structure: Record<string, unknown>
  created_at: string
  updated_at: string
}

export async function getTemplates(): Promise<Template[]> {
  const response = await fetch(`${BACKEND_URL}/api/v1/templates`, {
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error('Failed to fetch templates')
  }

  return response.json()
}

export async function createTemplate(name: string, tone: string, structure: Record<string, unknown>): Promise<Template> {
  const response = await fetch(`${BACKEND_URL}/api/v1/templates`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ name, tone, structure }),
  })

  if (!response.ok) {
    throw new Error('Failed to create template')
  }

  return response.json()
}

export async function deleteTemplate(id: string): Promise<void> {
  const response = await fetch(`${BACKEND_URL}/api/v1/templates/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error('Failed to delete template')
  }
}