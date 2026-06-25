'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import { ChevronDown, ExternalLink, FolderOpen, Link2 } from 'lucide-react'
import type { Client } from './ClientesClient'

// Dossiê do cliente (Nível 1, read-only): só GUARDA e ABRE links do Drive — não sobe arquivo nem
// escreve no Drive. Persiste na coluna jsonb `dossie` da tabela clients. NÃO toca em dinheiro.

const SECTIONS: { key: string; label: string }[] = [
  { key: 'planejamento', label: 'Planejamento Estratégico' },
  { key: 'briefing', label: 'Briefing' },
  { key: 'materiais', label: 'Materiais & Criativos' },
  { key: 'relatorios', label: 'Relatórios' },
  { key: 'contrato', label: 'Contrato' },
]

// URL http/https válida (senão NÃO salva).
function isValidUrl(s: string): boolean {
  const v = s.trim()
  if (!v) return false
  try { const u = new URL(v); return u.protocol === 'http:' || u.protocol === 'https:' } catch { return false }
}

const inputCls = 'w-full bg-bento-bg border border-bento-border rounded-btn px-3 py-2 text-sm text-bento-text placeholder:text-bento-muted focus:outline-none focus:border-lime font-mono'

export function DossieTab({ client, onSaved }: { client: Client; onSaved: (c: Client) => void }) {
  const supabase = createClient()
  const { toast } = useToast()
  const [folderUrl, setFolderUrl] = useState(client.dossie?.folder_url ?? '')
  const [sections, setSections] = useState<Record<string, string>>(() => {
    const s = client.dossie?.sections ?? {}
    return Object.fromEntries(SECTIONS.map(x => [x.key, s[x.key] ?? '']))
  })
  const [open, setOpen] = useState<Set<string>>(new Set())   // sanfona FECHADA por padrão
  const [busy, setBusy] = useState(false)

  // Grava o dossiê INTEIRO (folder + sections) na coluna jsonb. Reflete no estado do pai (sem fechar).
  const persist = async (folder: string, secs: Record<string, string>): Promise<boolean> => {
    const dossie = { folder_url: folder, sections: secs }
    setBusy(true)
    const { error } = await supabase.from('clients').update({ dossie }).eq('id', client.id)
    setBusy(false)
    if (error) { toast({ type: 'error', message: `Não foi possível salvar: ${error.message}` }); return false }
    onSaved({ ...client, dossie })
    return true
  }

  const saveFolder = async () => {
    const v = folderUrl.trim()
    if (v && !isValidUrl(v)) { toast({ type: 'error', message: 'Link inválido — use uma URL (http/https).' }); return }
    if (v === (client.dossie?.folder_url ?? '')) return
    if (await persist(v, sections) && v) toast({ type: 'success', message: 'Pasta salva.' })
  }

  const saveSection = async (key: string) => {
    const v = (sections[key] ?? '').trim()
    if (v && !isValidUrl(v)) { toast({ type: 'error', message: 'Link inválido — use uma URL (http/https).' }); return }
    if (v === ((client.dossie?.sections ?? {})[key] ?? '')) return
    const next = { ...sections, [key]: v }; setSections(next)
    if (await persist(folderUrl.trim(), next) && v) toast({ type: 'success', message: 'Link salvo.' })
  }

  const toggle = (k: string) => setOpen(p => { const n = new Set(p); if (n.has(k)) n.delete(k); else n.add(k); return n })

  return (
    <div className="space-y-4">
      {/* Faixa: Pasta no Google Drive */}
      <div className="bento-fx p-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 font-display font-semibold text-bento-text text-sm"><FolderOpen className="w-4 h-4 text-lime-fg" />Pasta no Google Drive</span>
          {isValidUrl(folderUrl) && (
            <a href={folderUrl.trim()} target="_blank" rel="noopener noreferrer"
              className="bento-btn flex items-center gap-1.5 px-3 py-1.5 rounded-btn text-xs font-semibold min-h-[36px]"><ExternalLink className="w-3.5 h-3.5" />Abrir pasta</a>
          )}
        </div>
        <input value={folderUrl} onChange={e => setFolderUrl(e.target.value)} onBlur={saveFolder}
          onKeyDown={e => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur() }}
          placeholder="Cole o link da pasta do Drive…" disabled={busy} className={inputCls} />
      </div>

      {/* Seções em sanfona — FECHADAS por padrão; clica no título pra abrir. */}
      <div className="space-y-2">
        {SECTIONS.map(s => {
          const link = sections[s.key] ?? ''
          const valid = isValidUrl(link)
          const isOpen = open.has(s.key)
          return (
            <div key={s.key} className="bento-fx overflow-hidden">
              <button type="button" onClick={() => toggle(s.key)} aria-expanded={isOpen}
                className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left min-h-[48px]">
                <span className="flex items-center gap-2 min-w-0">
                  <span className={cn('w-1.5 h-1.5 rounded-full flex-none', valid ? 'bg-lime' : 'bg-bento-muted/50')} />
                  <span className="font-display font-semibold text-bento-text text-sm truncate">{s.label}</span>
                </span>
                <ChevronDown className={cn('w-4 h-4 text-bento-muted flex-none transition-transform', isOpen && 'rotate-180')} />
              </button>
              {isOpen && (
                <div className="px-4 pb-3 pt-1 border-t border-bento-border/60 space-y-2">
                  {valid ? (
                    <a href={link.trim()} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-lime-fg hover:text-lime"><ExternalLink className="w-3.5 h-3.5" />Abrir no Drive</a>
                  ) : (
                    <p className="inline-flex items-center gap-1.5 font-tech text-[11px] text-bento-muted"><Link2 className="w-3.5 h-3.5" />Vincular link do Drive</p>
                  )}
                  <input value={link} onChange={e => setSections(p => ({ ...p, [s.key]: e.target.value }))} onBlur={() => saveSection(s.key)}
                    onKeyDown={e => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur() }}
                    placeholder="Cole a URL do Drive…" disabled={busy} className={inputCls} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
