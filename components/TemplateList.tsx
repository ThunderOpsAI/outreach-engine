import { useState, useEffect } from 'react'
import { getTemplates, createTemplate, deleteTemplate, type Template } from '../lib/api.js'

interface TemplateListProps {
  onApplyTemplate: (template: Template) => void
  currentOutput?: any // GenerateOutput or null
}

export function TemplateList({ onApplyTemplate, currentOutput }: TemplateListProps) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [templateName, setTemplateName] = useState('')

  useEffect(() => {
    loadTemplates()
  }, [])

  const loadTemplates = async () => {
    try {
      const data = await getTemplates()
      setTemplates(data)
    } catch (error) {
      console.error('Failed to load templates:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveTemplate = async () => {
    if (!currentOutput || !templateName.trim()) return

    setSaving(true)
    try {
      await createTemplate(templateName, 'direct', currentOutput)
      setTemplateName('')
      await loadTemplates()
    } catch (error) {
      console.error('Failed to save template:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteTemplate = async (id: string) => {
    try {
      await deleteTemplate(id)
      await loadTemplates()
    } catch (error) {
      console.error('Failed to delete template:', error)
    }
  }

  if (loading) {
    return <div>Loading templates...</div>
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium">Templates</h2>

      {currentOutput && (
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Template name"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          />
          <button
            onClick={handleSaveTemplate}
            disabled={saving || !templateName.trim()}
            className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      )}

      <div className="space-y-2">
        {templates.map((template) => (
          <div key={template.id} className="flex justify-between items-center border rounded p-2">
            <span>{template.name}</span>
            <div className="flex gap-2">
              <button
                onClick={() => onApplyTemplate(template)}
                className="text-sm bg-blue-100 hover:bg-blue-200 px-2 py-1 rounded"
              >
                Apply
              </button>
              <button
                onClick={() => handleDeleteTemplate(template.id)}
                className="text-sm bg-red-100 hover:bg-red-200 px-2 py-1 rounded"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}