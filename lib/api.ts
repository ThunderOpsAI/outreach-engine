import { createClient } from '@/lib/supabase'
import type { GenerateRequest, GenerateResponse, ErrorCode } from '@/lib/types'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'

async function getAuthHeaders() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) {
    throw new Error('UNAUTHORISED')
  }

  return {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json'
  }
}

export async function generateOutreach(data: GenerateRequest): Promise<GenerateResponse> {
  const headers = await getAuthHeaders()
  
  const response = await fetch(`${BACKEND_URL}/api/v1/generate/outreach`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data)
  })

  if (!response.ok) {
    const error = await response.json()
    throw error
  }

  return response.json()
}

export async function getTemplates() {
  const headers = await getAuthHeaders()
  
  const response = await fetch(`${BACKEND_URL}/api/v1/templates`, {
    headers
  })

  if (!response.ok) {
    const error = await response.json()
    throw error
  }

  return response.json()
}

export async function saveTemplate(data: { name: string, tone: string, structure: any }) {
  const headers = await getAuthHeaders()
  
  const response = await fetch(`${BACKEND_URL}/api/v1/templates`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data)
  })

  if (!response.ok) {
    const error = await response.json()
    throw error
  }

  return response.json()
}

export async function deleteTemplate(id: string) {
  const headers = await getAuthHeaders()
  
  const response = await fetch(`${BACKEND_URL}/api/v1/templates/${id}`, {
    method: 'DELETE',
    headers
  })

  if (!response.ok) {
    const error = await response.json()
    throw error
  }

  return response.json()
}