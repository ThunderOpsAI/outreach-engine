'use client'

import { useState } from 'react'
import type { GenerateRequest, Tone } from '@/lib/types'

interface GenerateFormProps {
  onSubmit: (data: GenerateRequest) => Promise<void>
  loading: boolean
}

export default function GenerateForm({ onSubmit, loading }: GenerateFormProps) {
  const [formData, setFormData] = useState<GenerateRequest>({
    company_name: '',
    offer: '',
    company_url: '',
    target_name: '',
    role: '',
    tone: 'direct'
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev: GenerateRequest) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onSubmit(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <div>
        <label className="block text-sm font-medium text-gray-700">Company Name *</label>
        <input
          required
          name="company_name"
          value={formData.company_name}
          onChange={handleChange}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Offer / Service *</label>
        <textarea
          required
          name="offer"
          value={formData.offer}
          onChange={handleChange}
          rows={3}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Company URL (optional)</label>
          <input
            type="url"
            name="company_url"
            value={formData.company_url}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Target Name (optional)</label>
          <input
            name="target_name"
            value={formData.target_name}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Role/Title (optional)</label>
        <input
          name="role"
          value={formData.role}
          onChange={handleChange}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Tone</label>
        <div className="mt-2 flex space-x-4">
          {(['casual', 'formal', 'direct'] as Tone[]).map((t) => (
            <label key={t} className="inline-flex items-center">
              <input
                type="radio"
                name="tone"
                value={t}
                checked={formData.tone === t}
                onChange={handleChange}
                className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300"
              />
              <span className="ml-2 text-sm text-gray-700 capitalize">{t}</span>
            </label>
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
      >
        {loading ? 'Generating...' : 'Generate →'}
      </button>
    </form>
  )
}