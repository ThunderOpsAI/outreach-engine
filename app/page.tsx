'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { generateOutreach, saveTemplate } from '@/lib/api'
import type { GenerateResponse, GenerateRequest, Template } from '@/lib/types'
import GenerateForm from '@/components/GenerateForm'
import OutputCard from '@/components/OutputCard'
import TemplateList from '@/components/TemplateList'
import { convertToCSV, downloadFile } from '@/lib/utils'
import type { User } from '@supabase/supabase-js'

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<GenerateResponse | null>(null)
  const [email, setEmail] = useState('')
  const [authError, setAuthError] = useState('')
  const [message, setMessage] = useState('')

  const supabase = createClient()

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user ?? null)
      setLoading(false)
    }

    checkUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: string, session: any) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) setAuthError(error.message)
    else setMessage('Check your email for the magic link!')
    setLoading(false)
  }

  const handleGenerate = async (data: GenerateRequest) => {
    setGenerating(true)
    try {
      const res = await generateOutreach(data)
      setResult(res)
    } catch (err: any) {
      alert(err.message || 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  const handleSaveTemplate = async () => {
    if (!result) return
    const name = prompt('Template Name:')
    if (!name) return

    try {
      await saveTemplate({
        name,
        tone: 'direct', // Default or from result? Result doesn't have tone back
        structure: result.output
      })
      alert('Template saved!')
    } catch (err) {
      alert('Failed to save template')
    }
  }

  const handleDownloadJSON = () => {
    if (!result) return
    downloadFile(JSON.stringify(result.output, null, 2), 'outreach.json', 'application/json')
  }

  const handleDownloadCSV = () => {
    if (!result) return
    const csv = convertToCSV(result.output)
    downloadFile(csv, 'outreach.csv', 'text/csv')
  }

  if (loading) return <div className="p-8 text-center">Loading...</div>

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-md p-8 bg-white rounded-xl shadow-lg border border-gray-100">
          <h1 className="text-2xl font-bold mb-6 text-center">Outreach Engine</h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                placeholder="you@example.com"
              />
            </div>
            {authError && <p className="text-red-500 text-sm">{authError}</p>}
            {message && <p className="text-green-600 text-sm">{message}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium disabled:opacity-50"
            >
              Send Magic Link
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-8">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Outreach Engine</h1>
          <p className="text-sm text-gray-500">{user.email}</p>
        </div>
        <div className="flex items-center space-x-4">
          {result && (
            <div className="text-sm font-medium bg-blue-50 text-blue-700 px-3 py-1 rounded-full border border-blue-100">
              Credits remaining: {result.credits_remaining}
            </div>
          )}
          <button
            onClick={() => supabase.auth.signOut()}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Sign Out
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <GenerateForm onSubmit={handleGenerate} loading={generating} />
          <TemplateList onSelect={(t: Template) => alert('Template selection not implemented in MVP form state')} />
        </div>

        <div className="lg:col-span-2 space-y-6">
          {!result ? (
            <div className="h-64 flex items-center justify-center border-2 border-dashed border-gray-200 rounded-xl text-gray-400 italic">
              Your generated outreach will appear here...
            </div>
          ) : (
            <div className="space-y-8">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-900">Generated Outreach</h2>
                <div className="flex space-x-2">
                  <button onClick={handleSaveTemplate} className="text-sm px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded border">Save Template</button>
                  <button onClick={handleDownloadJSON} className="text-sm px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded border">JSON</button>
                  <button onClick={handleDownloadCSV} className="text-sm px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded border">CSV</button>
                </div>
              </div>

              {/* Email Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">Email Outreach</h3>
                <div className="grid gap-4">
                  {result.output.email.subjects.map((s: string, i: number) => (
                    <OutputCard key={i} title={`Subject Variant ${i + 1}`} content={s} />
                  ))}
                  <OutputCard title="Short Body" content={result.output.email.body_short} label="< 100 words" />
                  <OutputCard title="Long Body" content={result.output.email.body_long} label="150-200 words" />
                </div>
              </div>

              {/* LinkedIn Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">LinkedIn Outreach</h3>
                <div className="grid gap-4">
                  <OutputCard title="Connection Request" content={result.output.linkedin.connect} label="< 300 chars" />
                  <OutputCard title="Follow-up 1" content={result.output.linkedin.followup_1} />
                  <OutputCard title="Follow-up 2" content={result.output.linkedin.followup_2} />
                  <OutputCard title="Follow-up 3 (Breakup)" content={result.output.linkedin.followup_3} />
                </div>
              </div>

              {/* Follow-up Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">Nurture Sequence</h3>
                <div className="grid gap-4">
                  {result.output.followups.map((fu: any, i: number) => (
                    <div key={i} className="space-y-2">
                      <p className="text-sm font-bold text-blue-600">Day {fu.day}</p>
                      <OutputCard title={fu.subject} content={fu.body} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}