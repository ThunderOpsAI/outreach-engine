'use client'

import { useState } from 'react'

interface OutputCardProps {
  title: string
  content: string
  label?: string
}

export default function OutputCard({ title, content, label }: OutputCardProps) {
  const [copied, setCopied] = useState(false)

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm space-y-2">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <button
          onClick={copyToClipboard}
          className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded border border-gray-300 transition-colors"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      {label && <p className="text-xs text-gray-500 italic">{label}</p>}
      <div className="relative">
        <textarea
          readOnly
          value={content}
          rows={Math.min(10, content.split('\n').length + 1)}
          className="w-full text-sm p-2 bg-gray-50 rounded border border-gray-100 focus:outline-none resize-none"
        />
      </div>
    </div>
  )
}