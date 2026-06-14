'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'

const MAX_BYTES = 25 * 1024 * 1024 // 25 MB — mesmo limite do bucket "materiais"
const COLS = 'id, name, storage_path, url, mime_type, size_bytes, created_at'

interface Material {
  id: string
  name: string
  storage_path: string
  url: string
  mime_type: string | null
  size_bytes: number | null
  created_at: string
}

function fmtSize(bytes: number | null): string {
  if (!bytes) return '—'
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`
  if (bytes >= 1_024) return `${(bytes / 1_024).toFixed(0)} KB`
  return `${bytes} B`
}

function FileIcon({ type }: { type: string | null }) {
  const t = type ?? ''
  if (t.includes('pdf')) return (
    <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )
  if (t.includes('image')) return (
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
  const { toast } = useToast()
  const supabase = createClient()
  const inputRef = useRef<HTMLInputElement>(null)

  const [materials, setMaterials] = useState<Material[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [presenting, setPresenting] = useState<Material | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Lista os materiais já salvos ao abrir a aba (mais recentes primeiro).
  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('presentation_materials')
        .select(COLS)
        .order('created_at', { ascending: false })
      if (error) {
        setFetchError(error.code === '42P01'
          ? 'Tabela presentation_materials não encontrada. Rode a migration 018 no Supabase.'
          : `Erro ao carregar materiais: ${error.message}`)
      } else {
        setMaterials((data ?? []) as Material[])
        setFetchError(null)
      }
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sobe de verdade: bucket "materiais" → URL pública → linha na tabela → card.
  const handleFiles = async (fileList: FileList) => {
    const picked = Array.from(fileList)
    if (picked.length === 0) return

    const tooBig = picked.filter(f => f.size > MAX_BYTES)
    const valid = picked.filter(f => f.size <= MAX_BYTES)
    if (tooBig.length) {
      toast({
        type: 'error',
        message: tooBig.length === 1
          ? `"${tooBig[0].name}" passa de 25 MB e não foi enviado.`
          : `${tooBig.length} arquivos passam de 25 MB e não foram enviados.`,
      })
    }
    if (valid.length === 0) return

    setUploading(true)
    const uploaded: Material[] = []
    for (const file of valid) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-')
      const path = `${crypto.randomUUID()}-${safeName}`

      const { error: upErr } = await supabase.storage
        .from('materiais')
        .upload(path, file, { contentType: file.type || undefined, upsert: false })
      if (upErr) {
        toast({ type: 'error', message: `Falha ao enviar "${file.name}": ${upErr.message}` })
        continue
      }

      const { data: { publicUrl } } = supabase.storage.from('materiais').getPublicUrl(path)

      const { data, error } = await supabase
        .from('presentation_materials')
        .insert({
          name: file.name,
          storage_path: path,
          url: publicUrl,
          mime_type: file.type || null,
          size_bytes: file.size,
        })
        .select(COLS)
        .single()

      if (error || !data) {
        await supabase.storage.from('materiais').remove([path]) // evita arquivo órfão no bucket
        toast({ type: 'error', message: `Falha ao salvar "${file.name}": ${error?.message ?? 'erro'}` })
        continue
      }
      uploaded.push(data as Material)
    }

    if (uploaded.length) {
      setMaterials(prev => [...uploaded.reverse(), ...prev])
      toast({
        type: 'success',
        message: uploaded.length === 1 ? 'Material enviado.' : `${uploaded.length} materiais enviados.`,
      })
    }
    setUploading(false)
  }

  const pickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFiles(e.target.files)
    e.target.value = '' // permite reenviar o mesmo arquivo depois
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    if (!uploading) handleFiles(e.dataTransfer.files)
  }

  // Excluir em 2 toques: apaga o registro (fonte da lista) e depois o arquivo do bucket.
  const handleDelete = async (m: Material) => {
    setDeletingId(m.id)
    const { error } = await supabase.from('presentation_materials').delete().eq('id', m.id)
    if (error) {
      toast({ type: 'error', message: `Não foi possível excluir: ${error.message}` })
      setDeletingId(null)
      return
    }
    await supabase.storage.from('materiais').remove([m.storage_path]) // se falhar, vira só um órfão invisível
    setMaterials(prev => prev.filter(x => x.id !== m.id))
    setConfirmingId(null)
    setDeletingId(null)
    toast({ type: 'success', message: 'Material excluído.' })
  }

  return (
    <div className="p-4 sm:p-6 space-y-5 overflow-auto h-full animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-foreground">Apresentação</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Faça upload de PDFs, imagens e slides para usar em reuniões</p>
        </div>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="bento-btn flex items-center gap-2 px-4 py-2 min-h-[44px] rounded-btn text-sm font-semibold disabled:opacity-50"
        >
          {uploading ? (
            <span className="w-4 h-4 border-2 border-lime-ink/40 border-t-lime-ink rounded-full animate-spin" />
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          )}
          {uploading ? 'Enviando...' : 'Upload'}
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.webp,.svg"
          className="hidden"
          onChange={pickFiles}
        />
      </div>

      {fetchError && (
        <div className="bg-amber-900/20 border border-amber-800/40 rounded-btn px-4 py-3 text-xs text-amber-400">{fetchError}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-3 py-16 text-muted-foreground text-sm">
          <span className="w-5 h-5 border-2 border-muted-foreground/20 border-t-lime rounded-full animate-spin" />
          Carregando...
        </div>
      ) : (
        <>
          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => { if (materials.length === 0 && !uploading) inputRef.current?.click() }}
            className={`border-2 border-dashed rounded-2xl transition-all duration-200 ${
              dragging
                ? 'border-lime bg-lime/10 scale-[1.01]'
                : materials.length === 0
                  ? 'border-bento-border bg-bento-panel hover:border-lime hover:bg-lime/5 cursor-pointer'
                  : 'border-bento-border/50 bg-transparent'
            } ${materials.length === 0 ? 'py-16' : 'p-0'}`}
          >
            {materials.length === 0 && (
              <div className="text-center pointer-events-none">
                <svg className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-sm font-medium text-foreground">Arraste arquivos aqui ou clique para fazer upload</p>
                <p className="text-xs text-muted-foreground mt-1">PDF, PPT, PNG, JPG — máximo 25 MB por arquivo</p>
              </div>
            )}
          </div>

          {/* File grid */}
          {materials.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {materials.map(f => (
                <div key={f.id} className="group relative bento-fx overflow-hidden hover:border-lime/50 transition-colors duration-200">
                  {/* Preview */}
                  <div className="h-32 bg-bento-bg flex items-center justify-center overflow-hidden">
                    {f.mime_type?.startsWith('image/') ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={f.url} alt={f.name} className="w-full h-full object-cover" />
                    ) : (
                      <FileIcon type={f.mime_type} />
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-2.5">
                    <p className="text-xs font-medium text-foreground truncate">{f.name}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{fmtSize(f.size_bytes)}</p>
                  </div>

                  {/* Actions overlay */}
                  <div className={cn(
                    'absolute inset-0 bg-black/70 transition-opacity flex items-center justify-center gap-2 p-2',
                    confirmingId === f.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
                  )}>
                    {confirmingId === f.id ? (
                      <div className="flex flex-col items-center gap-2 text-center px-2">
                        <p className="text-xs font-medium text-red-300">Excluir este material?</p>
                        <div className="flex gap-2">
                          <button onClick={() => setConfirmingId(null)} disabled={deletingId === f.id}
                            className="px-3 py-1.5 rounded-btn text-xs border border-white/30 text-white/80 hover:border-white transition-colors disabled:opacity-50">
                            Cancelar
                          </button>
                          <button onClick={() => handleDelete(f)} disabled={deletingId === f.id}
                            className="px-3 py-1.5 rounded-btn text-xs font-semibold bg-red-500/90 hover:bg-red-500 text-white transition-colors disabled:opacity-50">
                            {deletingId === f.id ? 'Excluindo...' : 'Excluir'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => setPresenting(f)}
                          className="bento-btn flex items-center gap-1.5 px-3 py-1.5 rounded-btn text-xs font-semibold min-h-0"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Apresentar
                        </button>
                        <button onClick={() => setConfirmingId(f.id)} aria-label="Excluir"
                          className="bg-red-900/60 hover:bg-red-900 text-red-300 p-1.5 rounded-lg transition-colors">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}

              {/* Add more */}
              <button
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                className="h-full min-h-[170px] border-2 border-dashed border-bento-border rounded-xl flex items-center justify-center hover:border-lime hover:bg-lime/5 transition-all text-bento-muted hover:text-lime-fg disabled:opacity-50"
              >
                {uploading ? (
                  <span className="w-6 h-6 border-2 border-bento-muted/20 border-t-lime rounded-full animate-spin" />
                ) : (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 4v16m8-8H4" />
                  </svg>
                )}
              </button>
            </div>
          )}
        </>
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

          {presenting.mime_type?.startsWith('image/') ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={presenting.url} alt={presenting.name} className="max-w-full max-h-full object-contain" />
          ) : presenting.mime_type === 'application/pdf' ? (
            <iframe src={presenting.url} className="w-screen h-screen" title={presenting.name} />
          ) : (
            <div className="text-center text-white/60">
              <FileIcon type={presenting.mime_type} />
              <p className="mt-4 text-sm">{presenting.name}</p>
              <a href={presenting.url} download={presenting.name}
                className="bento-btn mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-btn text-sm">
                Baixar arquivo
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
