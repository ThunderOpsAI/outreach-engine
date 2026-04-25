'use client'

import { useEffect, useState } from 'react'
import { getTemplates, deleteTemplate } from '@/lib/api'

interface Template {
  id: string
  name: string
  tone: string
  structure: any
}

interface TemplateListProps {
  onSelect: (template: Template) => void
}

export default function TemplateList({ onSelect }: TemplateListProps) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadTemplates()
  }, [])

  const loadTemplates = async () => {
    try {
      const data = await getTemplates()
      setTemplates(data)
    } catch (err) {
      console.error('Failed to load templates:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure?')) return
    try {
      await deleteTemplate(id)
      setTemplates(templates.filter(t => t.id !== id))
    } catch (err) {
      alert('Failed to delete template')
    }
  }

  if (loading) return <div className="text-sm text-gray-500">Loading templates...</div>

  return (
    <div className="space-y-2">
      <h2 className="text-lg font-semibold text-gray-900">Saved Templates</h2>
      {templates.length === 0 ? (
        <p className="text-sm text-gray-500 italic">No templates saved yet.</p>
      ) : (
        <div className="grid gap-2">
          {templates.map((template) => (
            <div
              key={template.id}
              className="flex justify-between items-center p-3 bg-white rounded-lg border border-gray-200 hover:border-blue-300 transition-colors"
            >
              <div
                className="flex-1 cursor-pointer"
                onClick={() => onSelect(template)}
              >
                <p className="text-sm font-medium text-gray-900">{template.name}</p>
                <p className="text-xs text-gray-500 capitalize">{template.tone}</p>
              </div>
              <button
                onClick={() => handleDelete(template.id)}
                className="text-xs text-red-600 hover:text-red-800 p-1"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}