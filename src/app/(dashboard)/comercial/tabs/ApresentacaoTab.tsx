'use client'

import { useState, useRef, useCallback } from 'react'

interface PresentationFile {
  id: string
  name: string
  url: string
  type: string
  size: number
  created_at: string
}

function fmtSize(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`
  if (bytes >= 1_024) return `${(bytes / 1_024).toFixed(0)} KB`
  return `${bytes} B`
}

function FileIcon({ type }: { type: string }) {
  if (type.includes('pdf')) return (
    <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )
  if (type.includes('image')) return (
    <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  )
  return (
    <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  )
}

export function ApresentacaoTab() {
  const [files, setFiles] = useState<PresentationFile[]>([])
  const [dragging, setDragging] = useState(false)
  const [presenting, setPresenting] = useState<PresentationFile | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const addFiles = useCallback((fileList: FileList) => {
    const newFiles: PresentationFile[] = Array.from(fileList).map(f => ({
      id: crypto.randomUUID(),
      name: f.name,
      url: URL.createObjectURL(f),
      type: f.type,
      size: f.size,
      created_at: new Date().toISOString(),
    }))
    setFiles(prev => [...prev, ...newFiles])
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    addFiles(e.dataTransfer.files)
  }, [addFiles])

  const handleRemove = (id: string) => setFiles(prev => prev.filter(f => f.id !== id))

  return (
    <div className="p-6 space-y-5 overflow-auto h-full animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-foreground">Apresentação</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Faça upload de PDFs, imagens e slides para usar em reuniões</p>
        </div>
        <button
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-glow-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          Upload
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.webp,.svg"
          className="hidden"
          onChange={e => e.target.files && addFiles(e.target.files)}
        />
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => files.length === 0 && inputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl transition-all duration-200 ${
          dragging
            ? 'border-primary-500 bg-primary-900/20 scale-[1.01]'
            : files.length === 0
              ? 'border-[#2d3748] bg-[#1a2133]/50 hover:border-primary-700 hover:bg-primary-900/10 cursor-pointer'
              : 'border-[#2d3748]/50 bg-transparent'
        } ${files.length === 0 ? 'py-16' : 'p-0'}`}
      >
        {files.length === 0 && (
          <div className="text-center pointer-events-none">
            <svg className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-sm font-medium text-foreground">Arraste arquivos aqui ou clique para fazer upload</p>
            <p className="text-xs text-muted-foreground mt-1">PDF, PPT, PNG, JPG — sem limite de tamanho</p>
          </div>
        )}
      </div>

      {/* File grid */}
      {files.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {files.map(f => (
            <div key={f.id} className="group relative bg-[#161b22] border border-[#2d3748] rounded-xl overflow-hidden hover:border-primary-700/50 transition-all duration-200 hover:shadow-glow-sm">
              {/* Preview */}
              <div className="h-32 bg-[#0d1117] flex items-center justify-center overflow-hidden">
                {f.type.startsWith('image/') ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={f.url} alt={f.name} className="w-full h-full object-cover" />
                ) : (
                  <FileIcon type={f.type} />
                )}
              </div>

              {/* Info */}
              <div className="p-2.5">
                <p className="text-xs font-medium text-foreground truncate">{f.name}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{fmtSize(f.size)}</p>
              </div>

              {/* Actions overlay */}
              <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <button
                  onClick={() => setPresenting(f)}
                  className="flex items-center gap-1.5 bg-primary-600 hover:bg-primary-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Apresentar
                </button>
                <button onClick={() => handleRemove(f.id)}
                  className="bg-red-900/60 hover:bg-red-900 text-red-300 p-1.5 rounded-lg transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ))}

          {/* Add more */}
          <button
            onClick={() => inputRef.current?.click()}
            className="h-full min-h-[170px] border-2 border-dashed border-[#2d3748] rounded-xl flex items-center justify-center hover:border-primary-700 hover:bg-primary-900/10 transition-all text-muted-foreground hover:text-primary-400"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      )}

      {/* Fullscreen presentation */}
      {presenting && (
        <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center">
          <button
            onClick={() => setPresenting(null)}
            className="absolute top-4 right-4 z-10 bg-white/10 hover:bg-white/20 text-white p-2.5 rounded-xl transition-colors backdrop-blur-sm"
            title="Fechar (ESC)"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="absolute top-4 left-4 z-10">
            <p className="text-white/60 text-xs font-medium bg-black/40 backdrop-blur-sm px-3 py-1.5 rounded-full">{presenting.name}</p>
          </div>

          {presenting.type.startsWith('image/') ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={presenting.url} alt={presenting.name} className="max-w-full max-h-full object-contain" />
          ) : presenting.type === 'application/pdf' ? (
            <iframe src={presenting.url} className="w-screen h-screen" title={presenting.name} />
          ) : (
            <div className="text-center text-white/60">
              <FileIcon type={presenting.type} />
              <p className="mt-4 text-sm">{presenting.name}</p>
              <a href={presenting.url} download={presenting.name}
                className="mt-4 inline-flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-500 transition-colors">
                Baixar arquivo
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
