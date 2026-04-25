import { useState } from 'react'
import type { GenerateRequest, Tone } from '../lib/types.js'

interface GenerateFormProps {
  onSubmit: (request: GenerateRequest) => void
  loading: boolean
}

export function GenerateForm({ onSubmit, loading }: GenerateFormProps) {
  const [companyName, setCompanyName] = useState('')
  const [offer, setOffer] = useState('')
  const [companyUrl, setCompanyUrl] = useState('')
  const [targetName, setTargetName] = useState('')
  const [role, setRole] = useState('')
  const [tone, setTone] = useState<Tone>('direct')
  const [templateId, setTemplateId] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const request: GenerateRequest = {
      company_name: companyName,
      offer,
      ...(companyUrl && { company_url: companyUrl }),
      ...(targetName && { target_name: targetName }),
      ...(role && { role }),
      tone,
      ...(templateId && { template_id: templateId }),
    }
    onSubmit(request)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      <div>
        <label htmlFor="companyName" className="block text-sm font-medium text-gray-700">
          Company Name *
        </label>
        <input
          type="text"
          id="companyName"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          required
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
        />
      </div>

      <div>
        <label htmlFor="offer" className="block text-sm font-medium text-gray-700">
          Offer / Service *
        </label>
        <textarea
          id="offer"
          value={offer}
          onChange={(e) => setOffer(e.target.value)}
          required
          rows={3}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
        />
      </div>

      <div>
        <label htmlFor="companyUrl" className="block text-sm font-medium text-gray-700">
          Company URL
        </label>
        <input
          type="url"
          id="companyUrl"
          value={companyUrl}
          onChange={(e) => setCompanyUrl(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
        />
      </div>

      <div>
        <label htmlFor="targetName" className="block text-sm font-medium text-gray-700">
          Target Name
        </label>
        <input
          type="text"
          id="targetName"
          value={targetName}
          onChange={(e) => setTargetName(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
        />
      </div>

      <div>
        <label htmlFor="role" className="block text-sm font-medium text-gray-700">
          Role/Title
        </label>
        <input
          type="text"
          id="role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Tone</label>
        <div className="mt-2 space-x-4">
          {(['casual', 'formal', 'direct'] as const).map((t) => (
            <label key={t} className="inline-flex items-center">
              <input
                type="radio"
                value={t}
                checked={tone === t}
                onChange={(e) => setTone(e.target.value as Tone)}
                className="text-indigo-600 focus:ring-indigo-500"
              />
              <span className="ml-2 capitalize">{t}</span>
            </label>
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 disabled:opacity-50"
      >
        {loading ? 'Generating...' : 'Generate'}
      </button>
    </form>
  )
}