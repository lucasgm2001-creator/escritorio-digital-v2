'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Portal } from '@/components/ui/Portal'
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

// Placeholder de UMA página que falhou (não derruba o PDF inteiro).
function pagePlaceholder(n: number): HTMLDivElement {
  const d = document.createElement('div')
  d.className = 'w-full mb-3 rounded-sm bg-white/5 border border-white/10 text-white/55 text-xs text-center py-10'
  d.textContent = `Página ${n} não pôde ser exibida`
  return d
}
function showPdfError(container: HTMLElement, msg: string) {
  container.replaceChildren()
  const p = document.createElement('p')
  p.className = 'text-white/70 text-sm text-center py-10'
  p.textContent = msg
  container.appendChild(p)
}

// ─── PDF nítido em telas Retina: renderiza via pdf.js num canvas HiDPI ──────────
// O <iframe> nativo borrava em dpr 2/3 porque o Chrome rasteriza o conteúdo do
// iframe a 1x. Aqui o backing store do canvas é viewport × devicePixelRatio (dpr
// limitado a 2), com a escala REDUZIDA por página se estourar o limite de canvas
// do navegador (lado ~16384px / área ~16M px no Safari → mancha preta ou falha).
// Páginas renderizam sob demanda (IntersectionObserver), cada uma isolada.
function PdfView({ url }: { url: string }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    let doc: PDFDocumentProxy | null = null
    const observers: IntersectionObserver[] = []
    const container = containerRef.current
    if (!container) return

    ;(async () => {
      // Só falha de CARREGAR o documento inteiro vira erro geral (zera o preview).
      try {
        const pdfjs = await import('pdfjs-dist')
        // Worker casado com a versão instalada (evita config de worker no bundler).
        pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
        doc = await pdfjs.getDocument(url).promise
      } catch {
        if (!cancelled && container) showPdfError(container, 'Não foi possível abrir o PDF.')
        return
      }
      if (!doc || cancelled || !container) { doc?.destroy(); return }
      container.replaceChildren()

      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      // Limites conservadores (abaixo do máximo do browser) p/ não gerar mancha
      // preta nem falha: por lado e por área total.
      const MAX_SIDE = 8192
      const MAX_AREA = 16_000_000
      const cw = Math.max(container.clientWidth - 16, 100)

      for (let n = 1; n <= doc.numPages; n++) {
        if (cancelled) return
        // Cada página isolada: a que falhar vira placeholder; as outras seguem.
        try {
          const page = await doc.getPage(n)
          const base = page.getViewport({ scale: 1 })
          const canvas = document.createElement('canvas')
          canvas.style.width = '100%'
          canvas.style.aspectRatio = `${base.width} / ${base.height}`
          // Fundo escuro (não branco): antes da página pintar, micro-gap aparece escuro, não em branco.
          canvas.className = 'block w-full max-w-full mb-3 bg-transparent rounded-sm shadow-lg'
          container.appendChild(canvas)

          let done = false
          const io = new IntersectionObserver(entries => {
            if (done || cancelled || !entries.some(e => e.isIntersecting)) return
            done = true
            io.disconnect()
            // Encaixe na largura × dpr, REDUZIDO se estourar lado/área do canvas.
            const fit = cw / base.width
            let scale = fit * dpr
            const w = base.width * scale, h = base.height * scale
            const cap = Math.min(1, MAX_SIDE / w, MAX_SIDE / h, Math.sqrt(MAX_AREA / (w * h)))
            if (cap < 1) scale *= cap
            const viewport = page.getViewport({ scale })
            canvas.width = Math.max(1, Math.floor(viewport.width))
            canvas.height = Math.max(1, Math.floor(viewport.height))
            const ctx = canvas.getContext('2d')
            if (!ctx) { canvas.replaceWith(pagePlaceholder(n)); return }
            page.render({ canvasContext: ctx, viewport }).promise.catch(() => {
              canvas.replaceWith(pagePlaceholder(n))
            })
          }, { root: container, rootMargin: '400px 0px' })
          io.observe(canvas)
          observers.push(io)
        } catch {
          container.appendChild(pagePlaceholder(n))
        }
      }
    })()

    return () => {
      cancelled = true
      observers.forEach(o => o.disconnect())
      try { doc?.destroy() } catch { /* noop */ }
    }
  }, [url])

  // overflow-x-hidden: o overflow-y-auto faz o overflow-x virar 'auto' (regra CSS) → sem isto,
  // qualquer sobra de sub-pixel do canvas do PDF gera scroll lateral no mobile. max-w-full no canvas evita a sobra.
  return <div ref={containerRef} className="w-full h-full max-w-full overflow-y-auto overflow-x-hidden px-2 py-2" />
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
  // Deck montado: cada slide visitado (+ vizinhos) fica MONTADO; só alterna a opacity → troca
  // instantânea, sem remontar nem rebuscar o PDF/imagem. reduce = troca sem fade (Acessibilidade).
  const [mounted, setMounted] = useState<Set<number>>(() => new Set<number>([0, 1].filter(i => i < materials.length)))
  const [reduce] = useState(() => typeof document !== 'undefined' && document.documentElement.classList.contains('a11y-reduce-motion'))

  const total = materials.length

  // Troca = só muda o índice (estado). Sem navegação, sem remontar, sem refetch.
  const change = useCallback((i: number) => {
    const t = Math.max(0, Math.min(total - 1, i))
    if (t !== index) setIndex(t)
  }, [total, index])
  const go = change
  const next = useCallback(() => change(index + 1), [change, index])
  const prev = useCallback(() => change(index - 1), [change, index])

  // Mantém montados o slide atual + vizinhos (preload). O que já montou FICA montado (Set só
  // cresce) → voltar a um slide é instantâneo, sem recarregar PDF/imagem.
  useEffect(() => {
    setMounted(prev => {
      const next = new Set(prev)
      for (const i of [index - 1, index, index + 1]) if (i >= 0 && i < total) next.add(i)
      return next
    })
  }, [index, total])

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

  // Swipe horizontal no celular: arrastar p/ esquerda = próximo, p/ direita = anterior. O limiar +
  // a checagem "predominantemente horizontal" evitam conflito com o scroll vertical do PDF.
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const onTouchStart = (e: React.TouchEvent) => { const t = e.touches[0]; touchStart.current = { x: t.clientX, y: t.clientY } }
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touchStart.current; touchStart.current = null
    if (!s) return
    const t = e.changedTouches[0]
    const dx = t.clientX - s.x, dy = t.clientY - s.y
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) { if (dx < 0) next(); else prev() }
  }

  return (
    <Portal>
    <div ref={rootRef} className="fixed inset-0 z-[300] bg-black flex flex-col select-none">
      {/* Topbar fina: menu + nome/cliente + contador + fechar. Desce com o safe-area (não fica sob o notch). */}
      <div className="shrink-0 flex items-center gap-3 min-h-12 px-3 pt-[env(safe-area-inset-top)] bg-black/70 backdrop-blur-sm border-b border-white/10">
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

        <div className="relative flex-1 min-w-0 bg-black overflow-hidden" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          {/* Deck: cada slide montado é uma camada fixa; só o atual fica opaco. Trocar = alternar
              opacity (sem remontar nem rebuscar). Fundo preto sempre atrás → nunca branco no gap.
              Vizinhos já montados = troca instantânea; reduce-motion = sem fade. */}
          {total === 0 && (
            <div className="absolute inset-0 flex items-center justify-center"><p className="text-white/60 text-sm">Sem material disponível.</p></div>
          )}
          {materials.map((m, i) => mounted.has(i) && (
            <div key={i} aria-hidden={i !== index}
              className={cn('absolute inset-0 flex items-center justify-center p-4 sm:p-8', reduce ? '' : 'transition-opacity duration-200')}
              style={{ opacity: i === index ? 1 : 0, pointerEvents: i === index ? 'auto' : 'none', zIndex: i === index ? 1 : 0 }}>
              <MaterialFrame material={m} />
            </div>
          ))}
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
    </Portal>
  )
}
