interface OutputCardProps {
  title: string
  content: string
  onCopy: () => void
}

export function OutputCard({ title, content, onCopy }: OutputCardProps) {
  return (
    <div className="border rounded-lg p-4">
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-medium">{title}</h3>
        <button
          onClick={onCopy}
          className="text-sm bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded"
        >
          Copy
        </button>
      </div>
      <textarea
        value={content}
        readOnly
        className="w-full h-24 resize-none border rounded p-2 text-sm"
      />
    </div>
  )
}