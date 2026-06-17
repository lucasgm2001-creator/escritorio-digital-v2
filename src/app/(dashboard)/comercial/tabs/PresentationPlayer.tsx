'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Menu, X, ChevronLeft, ChevronRight } from 'lucide-react'
import type { PDFDocumentProxy } from 'pdfjs-dist'

export interface PlayerMaterial {
  id: string
  name: string
  url: string
  mime_type: string | null
}

// ─── Fullscreen helpers (com prefixo webkit p/ Safari) ──────────────────────────
function enterFullscreen(el: HTMLElement): Promise<unknown> {
  const fn = el.requestFullscreen || (el as unknown as { webkitRequestFullscreen?: () => Promise<void> }).webkitRequestFullscreen
  if (!fn) return Promise.reject(new Error('sem suporte a fullscreen'))
  try { return Promise.resolve(fn.call(el)) } catch (e) { return Promise.reject(e) }
}
function exitFullscreen() {
  const fn = document.exitFullscreen || (document as unknown as { webkitExitFullscreen?: () => Promise<void> }).webkitExitFullscreen
  if (fn) { try { fn.call(document) } catch { /* noop */ } }
}
function fullscreenElement(): Element | null {
  return document.fullscreenElement || (document as unknown as { webkitFullscreenElement?: Element | null }).webkitFullscreenElement || null
}

// ─── PDF nítido em telas Retina: renderiza via pdf.js num canvas HiDPI ──────────
// O <iframe> nativo borrava em dpr 2/3 porque o Chrome rasteriza o conteúdo do
// iframe a 1x. Aqui o backing store do canvas é viewport × devicePixelRatio (dpr
// limitado a 2 p/ não estourar memória) e o tamanho de exibição (CSS) fica em 1x.
// Páginas renderizam sob demanda (IntersectionObserver) — seguro p/ PDFs grandes.
function PdfView({ url }: { url: string }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    let doc: PDFDocumentProxy | null = null
    const observers: IntersectionObserver[] = []
    const container = containerRef.current
    if (!container) return

    ;(async () => {
      try {
        const pdfjs = await import('pdfjs-dist')
        // Worker casado com a versão instalada (evita config de worker no bundler).
        pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
        doc = await pdfjs.getDocument(url).promise
        if (cancelled || !container) { doc?.destroy(); return }
        container.replaceChildren()

        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        const cw = Math.max(container.clientWidth - 16, 100)

        for (let n = 1; n <= doc.numPages; n++) {
          const page = await doc.getPage(n)
          if (cancelled) return
          const base = page.getViewport({ scale: 1 })
          const cssScale = cw / base.width
          const canvas = document.createElement('canvas')
          // Exibição em tamanho de tela; backing store em dpr → HiDPI/nítido.
          canvas.style.width = '100%'
          canvas.style.aspectRatio = `${base.width} / ${base.height}`
          canvas.className = 'block w-full mb-3 bg-white rounded-sm shadow-lg'
          container.appendChild(canvas)

          let done = false
          const io = new IntersectionObserver(entries => {
            if (done || cancelled || !entries.some(e => e.isIntersecting)) return
            done = true
            io.disconnect()
            const viewport = page.getViewport({ scale: cssScale * dpr })
            canvas.width = Math.floor(viewport.width)
            canvas.height = Math.floor(viewport.height)
            const ctx = canvas.getContext('2d')
            if (ctx) page.render({ canvasContext: ctx, viewport })
          }, { root: container, rootMargin: '400px 0px' })
          io.observe(canvas)
          observers.push(io)
        }
      } catch {
        if (!cancelled && container) {
          container.replaceChildren()
          const p = document.createElement('p')
          p.className = 'text-white/70 text-sm text-center py-10'
          p.textContent = 'Não foi possível renderizar o PDF.'
          container.appendChild(p)
        }
      }
    })()

    return () => {
      cancelled = true
      observers.forEach(o => o.disconnect())
      try { doc?.destroy() } catch { /* noop */ }
    }
  }, [url])

  return <div ref={containerRef} className="w-full h-full overflow-y-auto px-2 py-2" />
}

// ─── Renderiza UMA peça (imagem / PDF limpo / fallback) — reusado na Gaveta ──────
export function MaterialFrame({ material }: { material: PlayerMaterial }) {
  const t = material.mime_type ?? ''
  if (t.startsWith('image/')) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={material.url} alt={material.name} className="max-w-full max-h-full object-contain" />
  }
  if (t === 'application/pdf') {
    // Render próprio em canvas HiDPI (nítido em Retina); o iframe nativo borrava.
    return <PdfView url={material.url} />
  }
  // Tipos sem preview no navegador (ex: PPT/PPTX) → oferece download.
  return (
    <div className="text-center text-white/70 px-6">
      <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
      <p className="mt-4 text-sm">{material.name}</p>
      <a href={material.url} download={material.name}
        className="bento-btn mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-btn text-sm">
        Baixar arquivo
      </a>
    </div>
  )
}

// ─── Player: tela cheia, sequência com setas + menu lateral pra pular ────────────
export function PresentationPlayer({ name, client, materials, onClose }: {
  name: string
  client?: string | null
  materials: PlayerMaterial[]
  onClose: () => void
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)

  const total = materials.length
  const current = materials[index]

  const go = useCallback((i: number) => setIndex(Math.max(0, Math.min(total - 1, i))), [total])
  const next = useCallback(() => setIndex(i => Math.min(total - 1, i + 1)), [total])
  const prev = useCallback(() => setIndex(i => Math.max(0, i - 1)), [total])

  const close = useCallback(() => {
    if (fullscreenElement()) exitFullscreen()
    onClose()
  }, [onClose])

  // Entra em tela cheia ao abrir; se sair da tela cheia (ESC/F11), fecha o player.
  useEffect(() => {
    const el = rootRef.current
    let entered = false
    if (el) enterFullscreen(el).then(() => { entered = true }).catch(() => { /* fallback: overlay cobre a tela */ })
    const onFsChange = () => { if (entered && !fullscreenElement()) onClose() }
    document.addEventListener('fullscreenchange', onFsChange)
    document.addEventListener('webkitfullscreenchange', onFsChange as EventListener)
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange)
      document.removeEventListener('webkitfullscreenchange', onFsChange as EventListener)
      if (fullscreenElement()) exitFullscreen()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Teclado: setas/espaço navega, Home/End extremos, ESC sai.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight': case 'PageDown': case ' ': e.preventDefault(); next(); break
        case 'ArrowLeft': case 'PageUp': e.preventDefault(); prev(); break
        case 'Home': e.preventDefault(); go(0); break
        case 'End': e.preventDefault(); go(total - 1); break
        case 'Escape': close(); break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, prev, go, close, total])

  const blur = (e: React.MouseEvent<HTMLButtonElement>) => e.currentTarget.blur()
  const progress = total > 0 ? ((index + 1) / total) * 100 : 0

  return (
    <div ref={rootRef} className="fixed inset-0 z-[100] bg-black flex flex-col select-none">
      {/* Topbar fina: menu + nome/cliente + contador + fechar */}
      <div className="shrink-0 flex items-center gap-3 h-12 px-3 bg-black/70 backdrop-blur-sm border-b border-white/10">
        <button onClick={e => { blur(e); setMenuOpen(o => !o) }} title="Materiais" aria-label="Materiais"
          className={cn('flex-none p-2 rounded-lg transition-colors', menuOpen ? 'bg-lime text-lime-ink' : 'bg-white/10 hover:bg-white/20 text-white')}>
          <Menu className="w-4 h-4" />
        </button>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="text-white text-sm font-medium truncate">{name}</p>
          {client && <p className="font-tech text-[10px] uppercase tracking-wider text-white/45 truncate">{client}</p>}
        </div>
        <span className="font-tech text-xs text-white/60 tabular-nums shrink-0">{index + 1} / {total}</span>
        <button onClick={close} title="Fechar (ESC)" aria-label="Fechar"
          className="flex-none p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Corpo: menu lateral (opcional) + material centralizado */}
      <div className="relative flex-1 min-h-0 flex">
        {menuOpen && (
          <aside className="w-72 max-w-[80vw] shrink-0 bg-zinc-900/95 backdrop-blur-sm border-r border-white/15 shadow-2xl overflow-y-auto p-2">
            {materials.map((m, i) => (
              <button key={m.id} onClick={() => { go(i); setMenuOpen(false) }}
                className={cn('w-full text-left flex items-center gap-2 px-2 py-2 rounded-lg text-xs transition-colors',
                  i === index ? 'bg-lime/25 text-lime ring-1 ring-lime/40' : 'text-white/80 hover:bg-white/10')}>
                <span className="flex-none w-5 h-5 rounded bg-white/15 text-white flex items-center justify-center text-[11px] tabular-nums">{i + 1}</span>
                <span className="flex-1 truncate">{m.name}</span>
              </button>
            ))}
          </aside>
        )}

        <div className="relative flex-1 min-w-0 flex items-center justify-center p-4 sm:p-8">
          {current ? <MaterialFrame material={current} /> : <p className="text-white/60 text-sm">Sem material disponível.</p>}
          {total > 1 && (
            <>
              <button onClick={e => { blur(e); prev() }} disabled={index === 0} aria-label="Anterior"
                className="absolute left-3 top-1/2 -translate-y-1/2 z-10 bg-black/60 hover:bg-black/80 disabled:opacity-30 text-white p-3 rounded-full ring-1 ring-white/30 shadow-lg backdrop-blur-sm transition-colors">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button onClick={e => { blur(e); next() }} disabled={index === total - 1} aria-label="Próximo"
                className="absolute right-3 top-1/2 -translate-y-1/2 z-10 bg-black/60 hover:bg-black/80 disabled:opacity-30 text-white p-3 rounded-full ring-1 ring-white/30 shadow-lg backdrop-blur-sm transition-colors">
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Barra de progresso (verde, proporcional ao slide atual) */}
      <div className="shrink-0 h-1 bg-white/10">
        <div className="h-full bg-lime" style={{ width: `${progress}%` }} />
      </div>
    </div>
  )
}
