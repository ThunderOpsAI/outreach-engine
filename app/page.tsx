'use client'

import { useState, useEffect } from 'react'
import { GenerateForm } from '../components/GenerateForm.js'
import { OutputCard } from '../components/OutputCard.js'
import { TemplateList } from '../components/TemplateList.js'
import { generateOutreach } from '../lib/api.js'
import { convertToCSV, downloadFile } from '../lib/utils.js'
import { supabase } from '../lib/supabase.js'
import type { GenerateRequest, GenerateResponse, GenerateOutput } from '../lib/types.js'

export default function HomePage() {
  const [loading, setLoading] = useState(false)
  const [output, setOutput] = useState<GenerateOutput | null>(null)
  const [credits, setCredits] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [authenticated, setAuthenticated] = useState(false)

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        window.location.href = '/auth'
      } else {
        setAuthenticated(true)
      }
    }
    checkAuth()
  }, [])

  if (!authenticated) {
    return <div>Loading...</div>
  }

  const handleGenerate = async (request: GenerateRequest) => {
    setLoading(true)
    setError(null)
    try {
      const response: GenerateResponse = await generateOutreach(request)
      setOutput(response.output)
      setCredits(response.credits_remaining)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const handleDownloadCSV = () => {
    if (!output) return
    const csv = convertToCSV(output)
    downloadFile(csv, 'outreach.csv', 'text/csv')
  }

  const handleDownloadJSON = () => {
    if (!output) return
    const json = JSON.stringify(output, null, 2)
    downloadFile(json, 'outreach.json', 'application/json')
  }

  const handleApplyTemplate = (template: any) => {
    // For now, just set the output to apply the template structure
    // In a real implementation, this would modify the form or generation
    console.log('Applying template:', template)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Outreach Engine</h1>
          {credits !== null && (
            <p className="text-sm text-gray-600">Credits remaining: {credits}</p>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <GenerateForm onSubmit={handleGenerate} loading={loading} />
            {error && (
              <div className="mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
                {error}
              </div>
            )}
          </div>

          <div>
            <TemplateList onApplyTemplate={handleApplyTemplate} currentOutput={output} />
          </div>
        </div>

        {output && (
          <div className="mt-8 space-y-6">
            <div className="flex gap-4">
              <button
                onClick={handleDownloadCSV}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Download CSV
              </button>
              <button
                onClick={handleDownloadJSON}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              >
                Download JSON
              </button>
            </div>

            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Email</h2>
              {output.email.subjects.map((subject, i) => (
                <OutputCard
                  key={`subject-${i}`}
                  title={`Subject Line ${i + 1}`}
                  content={subject}
                  onCopy={() => handleCopy(subject)}
                />
              ))}
              <OutputCard
                title="Short Body"
                content={output.email.body_short}
                onCopy={() => handleCopy(output.email.body_short)}
              />
              <OutputCard
                title="Long Body"
                content={output.email.body_long}
                onCopy={() => handleCopy(output.email.body_long)}
              />
            </div>

            <div className="space-y-4">
              <h2 className="text-xl font-semibold">LinkedIn</h2>
              <OutputCard
                title="Connect Message"
                content={output.linkedin.connect}
                onCopy={() => handleCopy(output.linkedin.connect)}
              />
              <OutputCard
                title="Follow-up 1"
                content={output.linkedin.followup_1}
                onCopy={() => handleCopy(output.linkedin.followup_1)}
              />
              <OutputCard
                title="Follow-up 2"
                content={output.linkedin.followup_2}
                onCopy={() => handleCopy(output.linkedin.followup_2)}
              />
              <OutputCard
                title="Follow-up 3"
                content={output.linkedin.followup_3}
                onCopy={() => handleCopy(output.linkedin.followup_3)}
              />
            </div>

            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Follow-up Sequence</h2>
              {output.followups.map((followup) => (
                <OutputCard
                  key={`followup-${followup.day}`}
                  title={`Day ${followup.day}: ${followup.subject}`}
                  content={followup.body}
                  onCopy={() => handleCopy(`${followup.subject}\n\n${followup.body}`)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}